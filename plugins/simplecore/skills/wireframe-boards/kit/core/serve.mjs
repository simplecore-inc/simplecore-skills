// Serving a board while it is being drawn: build once, rebuild on every change, reload the page.
//
//   node wf.mjs serve [--port 4173] [--host 127.0.0.1] [--open] [--no-watch] [--pdf]
//
// **The board on disk never learns it was served.** The live-reload client is spliced into the
// HTTP RESPONSE and into nothing else, so `board.html` stays the one-file, script-free artifact
// the contract demands — opened from the file system it is exactly what the build wrote. That is
// also why reloading runs over an EventSource instead of rewriting the board with a poller.
//
// **Every rebuild is a CHILD PROCESS of `wfb.mjs build`.** A screen file is an ES module and Node
// caches modules by URL for the life of a process, so rebuilding inside this one would go on
// drawing whatever was on disk when `serve` started. That failure is silent — the board rebuilds,
// reports the same screen count, and shows yesterday's frame — which is the reason a spawn is
// worth more here than the milliseconds an in-process call would save.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBoard, patternDirFor } from './context.mjs';
import { outputFiles } from './split.mjs';

const kitBin = join(dirname(dirname(fileURLToPath(import.meta.url))), 'bin/wfb.mjs');

/** The one address the dev client talks to. Under `__wfb/` so it can never shadow a board file. */
const EVENTS_PATH = '/__wfb/events';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * The live-reload client, spliced into every HTML response and written to no file.
 *
 * <p>It restores the scroll position across a reload by hand. A board is one long page of several
 * hundred frames, so a reload that lands at the top costs the reader the frame they were editing —
 * and the browser's own restoration gives up as soon as the document's height changes, which is
 * what every rebuild does.
 */
const DEV_CLIENT = `
<!-- wireframe-boards dev server: this block exists only in the HTTP response, never in the file. -->
<style>
  #__wfb-bar{position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:min(720px,calc(100vw - 24px));
    margin:0;padding:10px 14px;border-radius:8px;background:#1c1c1c;color:#f4f4f4;
    font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;
    overflow:auto;max-height:40vh;box-shadow:0 6px 24px rgba(0,0,0,.35)}
  #__wfb-bar[hidden]{display:none}
</style>
<pre id="__wfb-bar" hidden></pre>
<script>
(function () {
  var KEY = '__wfb-scroll';
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  try {
    var kept = sessionStorage.getItem(KEY);
    if (kept !== null) {
      sessionStorage.removeItem(KEY);
      addEventListener('load', function () { scrollTo(0, parseFloat(kept) || 0); });
    }
  } catch (e) {}

  var bar = document.getElementById('__wfb-bar');
  function say(text) { bar.textContent = text; bar.hidden = false; }
  function quiet() { bar.hidden = true; bar.textContent = ''; }

  function reload() {
    try { sessionStorage.setItem(KEY, String(scrollY)); } catch (e) {}
    location.reload();
  }

  var down = false;
  var es = new EventSource(${JSON.stringify(EVENTS_PATH)});
  es.addEventListener('hello', function () {
    // Coming back after the server went away means the board was rebuilt while nobody was
    // listening, so the page in front of the reader is older than the file on disk.
    if (down) { down = false; reload(); return; }
    quiet();
  });
  es.addEventListener('building', function () { say('빌드 중…'); });
  es.addEventListener('reload', function () { reload(); });
  es.addEventListener('failed', function (e) {
    var payload = {};
    try { payload = JSON.parse(e.data); } catch (err) {}
    say('빌드에 실패했습니다. 고치면 다시 빌드해 화면을 새로 고칩니다.\\n\\n' + (payload.message || ''));
  });
  es.onerror = function () { down = true; say('서버와 연결이 끊겼습니다. 다시 연결하는 중…'); };
})();
</script>
`;

function injectDevClient(html) {
  const at = html.lastIndexOf('</body>');
  return at < 0 ? html + DEV_CLIENT : html.slice(0, at) + DEV_CLIENT + html.slice(at);
}

/** The page a reader gets when the board has not been built yet, or the build is failing. */
function statusPage({ title, detail }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>`
    + `<style>body{margin:0;padding:48px;background:#f7f7f7;color:#1c1c1c;`
    + `font:14px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif}`
    + `h1{font-size:18px;margin:0 0 16px}pre{white-space:pre-wrap;font:12px/1.6 ui-monospace,Menlo,monospace;`
    + `background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;overflow:auto}</style></head>`
    + `<body><h1>${escapeHtml(title)}</h1>`
    + (detail ? `<pre>${escapeHtml(detail)}</pre>` : '')
    + `</body></html>`;
}

/**
 * Run one build, as a child process, and collect what it said.
 *
 * @returns `{ ok, output }` — the output is stdout and stderr interleaved, which is what a reader
 *   staring at a failed gate needs to see in one piece
 */
function runBuild(boardDir, { pdf }) {
  return new Promise((done) => {
    const args = [kitBin, 'build', '--board', boardDir, ...(pdf ? [] : ['--no-pdf'])];
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (stream, sink) => stream.on('data', (chunk) => {
      output += chunk;
      sink.write(chunk);
    });
    collect(child.stdout, process.stdout);
    collect(child.stderr, process.stderr);
    child.on('error', (err) => done({ ok: false, output: `${output}${err.message}` }));
    child.on('close', (code) => done({ ok: code === 0, output }));
  });
}

/** A change with no usable name is rebuilt for rather than skipped — missing one is the worse half. */
function interesting(name) {
  if (!name) return true;
  const base = String(name).split(/[\\/]/).pop();
  if (!base || base.startsWith('.')) return false;
  return !/~$|\.(swp|swx|tmp)$/.test(base);
}

/** Listen, stepping up the port while something else holds it, and answer with the port that took. */
function listen(server, { host, port, tries = 20 }) {
  return new Promise((ok, fail) => {
    let attempt = 0;
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && ++attempt < tries) { start(); return; }
      fail(err);
    };
    const start = () => {
      server.once('error', onError);
      server.listen(port + attempt, host, () => {
        server.removeListener('error', onError);
        ok(port + attempt);
      });
    };
    start();
  });
}

/**
 * Build the board, serve it over HTTP, and rebuild it whenever a source changes.
 *
 * @param boardDir the board folder
 * @param host the interface to bind. Loopback by default: a board is a local artifact and the
 *   dev server has no notion of who is asking
 * @param watchSources rebuild on change. False serves whatever the one opening build produced
 * @param pdf render the PDF on every rebuild. Off by default — it is the slow half of a build and
 *   nothing the browser is showing comes from it
 */
export async function serveBoard(boardDir, {
  port = 4173, host = '127.0.0.1', open = false, watchSources = true, pdf = false,
} = {}) {
  const { config, patternDir } = await loadBoard(boardDir, { screens: false });
  const entry = outputFiles(config)[0];
  const built = new Set(outputFiles(config));

  /** Everyone currently holding the event stream open. */
  const clients = new Set();
  const send = (event, data) => {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
    for (const res of clients) res.write(frame);
  };

  let lastError = null;

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === EVENTS_PATH) {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      // A retry hint short enough that a rebuild-and-restart is invisible, and a first frame so
      // the client knows it is connected rather than merely not yet failed.
      res.write('retry: 1000\n\n');
      res.write('event: hello\ndata: {}\n\n');
      clients.add(res);
      const beat = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => { clearInterval(beat); clients.delete(res); });
      return;
    }

    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += entry;
    const path = resolve(boardDir, rel);
    // Everything the server hands out is under the board folder. A `..` that climbs out is
    // answered with the same 404 as a name that does not exist.
    if (path !== boardDir && !path.startsWith(boardDir + sep)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
      return;
    }

    const ext = extname(path).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';

    if (!existsSync(path) || statSync(path).isDirectory()) {
      const missingEntry = built.has(rel);
      res.writeHead(missingEntry ? 200 : 404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      // The entry page missing means the build has not produced it yet — which the reader should
      // see as the build error it is, on a page that reloads itself once the build goes green.
      res.end(missingEntry
        ? injectDevClient(statusPage({
          title: lastError ? '빌드에 실패해 아직 보드가 없습니다' : '보드를 빌드하는 중입니다',
          detail: lastError,
        }))
        : statusPage({ title: `${rel} 파일이 없습니다`, detail: null }));
      return;
    }

    if (ext === '.html' || ext === '.htm') {
      const body = injectDevClient(readFileSync(path, 'utf8'));
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
      return;
    }

    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    createReadStream(path).pipe(res);
  });

  const bound = await listen(server, { host, port });
  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  console.log(`${config.boardName} — http://${shown}:${bound}/`);

  // Building and rebuilding. One build at a time, and at most one queued behind it: saving four
  // files in a row is one board, not four builds.
  let building = false;
  let queued = false;
  async function rebuild() {
    if (building) { queued = true; return; }
    building = true;
    send('building');
    const { ok, output } = await runBuild(boardDir, { pdf });
    building = false;
    lastError = ok ? null : output.trim();
    if (queued) { queued = false; return rebuild(); }
    if (ok) send('reload');
    else send('failed', { message: lastError });
  }

  await rebuild();

  const watchers = [];
  if (watchSources) {
    const bump = (() => {
      let timer = null;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(() => { rebuild(); }, 120);
      };
    })();

    const watchTree = (dir) => {
      if (!existsSync(dir)) return null;
      const w = watch(dir, { recursive: true }, (_event, name) => { if (interesting(name)) bump(); });
      watchers.push(w);
      return dir;
    };

    const roots = [watchTree(join(boardDir, 'src')), watchTree(patternDir)].filter(Boolean);

    // The board folder itself is watched WITHOUT recursion and filtered down to the two files that
    // decide how it is drawn. Watching it whole would see `board.html` land and rebuild because of
    // the build that just wrote it — a loop with nothing to stop it.
    const settings = new Set(['board.config.mjs', 'board.gates.mjs']);
    watchers.push(watch(boardDir, { recursive: false }, (_event, name) => {
      if (name && settings.has(String(name))) bump();
    }));

    console.log(`바뀌면 다시 빌드합니다 — ${roots.map((d) => d.replace(`${boardDir}${sep}`, '')).join(' · ')} · ${[...settings].join(' · ')}`);
  } else {
    console.log('변경 감시 없이 한 번만 빌드했습니다 (--no-watch)');
  }
  console.log('멈추려면 Ctrl+C');

  if (open) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(opener, [`http://${shown}:${bound}/`], {
      stdio: 'ignore', detached: true, shell: process.platform === 'win32',
    }).unref();
  }

  const stop = () => {
    for (const w of watchers) w.close();
    for (const res of clients) res.end();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // Nothing to await: the server holds the process open until one of those signals arrives.
  return new Promise(() => {});
}
