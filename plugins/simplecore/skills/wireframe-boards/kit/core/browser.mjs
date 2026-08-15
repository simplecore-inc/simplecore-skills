// One local Chrome, driven over the DevTools protocol — the browser every tool here shares.
//
// This exists instead of a browser-automation package because the board folder has no
// `package.json` and no `node_modules`, and keeping it that way is what makes every tool
// runnable on a machine that installed nothing. The sweep used to need playwright and
// silently could not run wherever it was absent.
//
//   const browser = await launchBrowser();
//   const page = await browser.newPage({ width: 1900, height: 1200 });
//   await page.goto(fileUrl);  await page.evaluate(() => ...);  await browser.close();
//
// Set CHROME_PATH to pick a specific binary.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The installed browser first, then the ones playwright or puppeteer downloaded — a machine
// that has ever run either has one on disk, and asking for an install that is already there
// is a way to fail a build for no reason.
export function findChrome() {
  const env = process.env;
  const named = [
    env.CHROME_PATH,
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // Windows. The three roots are the per-machine 64-bit and 32-bit installs and the per-user
    // one; Chrome picks between them at install time, so all three have to be looked at.
    ...(process.platform === 'win32'
      ? [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]
        .filter(Boolean)
        .flatMap((root) => [
          join(root, 'Google/Chrome/Application/chrome.exe'),
          join(root, 'Microsoft/Edge/Application/msedge.exe'),
        ])
      : []),
  ].filter(Boolean);
  for (const p of named) if (existsSync(p)) return p;

  const home = homedir();
  const pools = [
    [join(home, 'Library/Caches/ms-playwright'), /^chromium(_headless_shell)?-/],
    [join(home, '.cache/ms-playwright'), /^chromium(_headless_shell)?-/],
    [join(home, '.cache/puppeteer/chrome'), /./],
    [join(home, '.cache/puppeteer/chrome-headless-shell'), /./],
  ];
  const inside = [
    'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chrome-headless-shell-mac-x64/chrome-headless-shell',
    'chrome-linux/chrome',
    'chrome-linux64/chrome',
    'chrome-headless-shell-linux64/chrome-headless-shell',
  ];
  for (const [pool, match] of pools) {
    if (!existsSync(pool)) continue;
    for (const entry of readdirSync(pool).sort().reverse()) {
      if (!match.test(entry)) continue;
      for (const rel of inside) {
        const p = join(pool, entry, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

// ── The protocol client ───────────────────────────────────────────────────────
class Cdp {
  #ws;
  #next = 1;
  #pending = new Map();
  #handlers = new Map();
  #closed = null;

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const client = new Cdp(ws);
      ws.addEventListener('open', () => resolve(client), { once: true });
      ws.addEventListener('error', () => reject(new Error(`cannot reach the browser at ${url}`)), { once: true });
    });
  }

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const waiter = this.#pending.get(msg.id);
        if (!waiter) return;
        this.#pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(`${waiter.method}: ${msg.error.message}`));
        else waiter.resolve(msg.result ?? {});
        return;
      }
      const key = msg.sessionId ? `${msg.sessionId}:${msg.method}` : msg.method;
      for (const fn of this.#handlers.get(key) ?? []) fn(msg.params ?? {});
    });
    ws.addEventListener('close', () => {
      this.#closed = new Error('the browser closed the DevTools connection');
      for (const [, waiter] of this.#pending) waiter.reject(this.#closed);
      this.#pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    if (this.#closed) return Promise.reject(this.#closed);
    const id = this.#next++;
    this.#ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject, method }));
  }

  // Events are keyed by session as well as by name: two pages waiting on `Page.loadEventFired`
  // would otherwise wake each other, and the second navigation would appear to finish instantly.
  once(method, sessionId) {
    const key = sessionId ? `${sessionId}:${method}` : method;
    return new Promise((resolve) => {
      const fn = (params) => {
        const list = this.#handlers.get(key);
        list.splice(list.indexOf(fn), 1);
        resolve(params);
      };
      if (!this.#handlers.has(key)) this.#handlers.set(key, []);
      this.#handlers.get(key).push(fn);
    });
  }

  close() {
    try { this.#ws.close(); } catch { /* already gone */ }
  }
}

// ── One page ──────────────────────────────────────────────────────────────────
class Page {
  #cdp;
  #session;

  constructor(cdp, sessionId) {
    this.#cdp = cdp;
    this.#session = sessionId;
  }

  get sessionId() { return this.#session; }

  send(method, params) { return this.#cdp.send(method, params, this.#session); }

  async setViewport({ width, height, deviceScaleFactor = 1 }) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  }

  async goto(url) {
    const loaded = this.#cdp.once('Page.loadEventFired', this.#session);
    await this.send('Page.navigate', { url });
    await loaded;
    // Fonts and two frames: measuring before the first paint reports the pre-layout numbers.
    await this.evaluate(`document.fonts.ready
      .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      .then(() => 1)`);
  }

  // evaluate(fn, arg) or evaluate('expression'). The function runs in the page, so it may
  // only use what the page has — no closures over anything out here.
  async evaluate(fnOrExpression, arg) {
    const expression = typeof fnOrExpression === 'function'
      ? `(${fnOrExpression.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`
      : fnOrExpression;
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text ?? 'evaluate failed');
    }
    return result?.value;
  }

  addStyle(css) {
    return this.evaluate(`(() => {
      const s = document.createElement('style');
      s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s);
      return 1;
    })()`);
  }

  // clip is {x, y, width, height} in CSS pixels of the page, as `getBoundingClientRect`
  // reports it plus the current scroll offset.
  async screenshot({ path, clip, scale = 1 } = {}) {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      ...(clip ? { clip: { ...clip, scale } } : {}),
    });
    const buf = Buffer.from(data, 'base64');
    if (path) writeFileSync(path, buf);
    return buf;
  }

  async pdf(options) {
    const { stream } = await this.send('Page.printToPDF', { ...options, transferMode: 'ReturnAsStream' });
    // The stream belongs to this page's session — reading it without one answers
    // "Invalid stream handle", which reads like a printing failure and is not.
    const chunks = [];
    for (;;) {
      const { data, base64Encoded, eof } = await this.send('IO.read', { handle: stream, size: 1 << 20 });
      if (data) chunks.push(Buffer.from(data, base64Encoded ? 'base64' : 'utf8'));
      if (eof) break;
    }
    await this.send('IO.close', { handle: stream });
    return Buffer.concat(chunks);
  }
}

// ── The browser ───────────────────────────────────────────────────────────────
export async function launchBrowser({ binary = findChrome() } = {}) {
  if (!binary) {
    throw new Error('no Chrome found. Install Google Chrome, or point CHROME_PATH at a Chrome/Chromium binary.');
  }
  const profile = mkdtempSync(join(tmpdir(), 'wf-board-'));
  const child = spawn(binary, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--allow-file-access-from-files',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  child.stderr.on('data', (b) => { stderr += b.toString(); });
  let exited = null;
  child.on('exit', (code) => { exited = code; });

  // The port file appears once the endpoint is up; reading it beats parsing stderr, whose
  // shape changes between Chrome versions.
  const portFile = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  let endpoint = null;
  while (Date.now() < deadline && exited == null) {
    if (existsSync(portFile)) {
      const [port, path] = readFileSync(portFile, 'utf8').split('\n');
      if (port && path) { endpoint = `ws://127.0.0.1:${port.trim()}${path.trim()}`; break; }
    }
    await sleep(50);
  }
  if (!endpoint) {
    child.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
    const tail = stderr.trim().split('\n').slice(-4).join('\n');
    throw new Error(`Chrome did not start (${binary})${tail ? `\n${tail}` : ''}`);
  }

  const cdp = await Cdp.connect(endpoint);
  return {
    async newPage({ width = 1440, height = 900 } = {}) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(cdp, sessionId);
      await page.send('Page.enable', {});
      await page.setViewport({ width, height });
      return page;
    },
    async close() {
      try { await cdp.send('Browser.close'); } catch { /* it may already be gone */ }
      cdp.close();
      const stop = Date.now() + 5_000;
      while (exited == null && Date.now() < stop) await sleep(50);
      if (exited == null) child.kill('SIGKILL');
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
