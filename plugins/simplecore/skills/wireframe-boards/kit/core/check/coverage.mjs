// Compare the board against the code: read every screen's route from the manifest, read the
// routes the apps actually serve, and report which frames have nowhere to land.
//
//   node wf.mjs coverage             → per-section summary
//   node wf.mjs coverage --missing   → only the frames with no route
//   node wf.mjs coverage --section C → one section
//
// What this measures is REACHABILITY, not completeness: a route that exists means the screen
// can be opened, never that every state the board draws for it is built. Frames marked ✔ are
// the ones a person still has to walk and compare; frames marked ✖ need no walking, because
// nothing serves them. Read the number as "how much of the board is unreachable", and take
// the ✔ list as the queue for a by-hand review.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadBoard } from '../context.mjs';

/**
 * Compare a board against the code that serves it.
 *
 * <p>**Where the front ends live is the BOARD's to declare**, in `board.config.mjs` under
 * `code.appRoots` — paths relative to the board folder. Naming a repository's layout in here
 * would make the tool right about one project and quietly wrong about every other, reporting a
 * whole board as unreachable because it looked for apps in a directory that does not exist.
 */
export async function reportCoverage(boardDir, { onlyMissing = false, section = null } = {}) {
  const { config, manifest } = await loadBoard(boardDir);
  const roots = config.code?.appRoots ?? [];
  if (!roots.length) {
    console.log('board.config.mjs에 code.appRoots가 없습니다 — 어느 앱이 라우트를 제공하는지 선언해야 셀 수 있습니다.');
    return null;
  }
  const APP_ROOTS = roots.map((r) => join(boardDir, r));

  /**
   * A frame that draws a state rather than a destination.
   *
   * <p>The 공통 패턴 cluster is not made of screens — it fixes how an empty list, a locked record
   * or a blocked gate is drawn wherever those happen — so its frames carry no route and are not
   * something a route could ever reach. Counting them as unreachable would leave a number that
   * can never fall to zero, which is the same as having no number.
   */
  const isPattern = (route) => !route;

  /**
   * Every route the front ends serve, as paths.
   *
   * <p>Reads the file tree rather than a list kept here, so an app added tomorrow is counted
   * without this script being edited. TanStack's file routing maps `routes/a/index.tsx` to `/a`
   * and `routes/a.tsx` to `/a`; `__root` is chrome and serves nothing on its own.
   *
   * @returns the served paths, e.g. `/sites`
   */
  function servedRoutes() {
    const found = new Set();
    for (const appsDir of APP_ROOTS) {
      if (!existsSync(appsDir)) continue;
      for (const app of readdirSync(appsDir)) {
        const routesDir = join(appsDir, app, 'src', 'routes');
        if (!existsSync(routesDir)) continue;
        const own = new Set();
        walk(routesDir, routesDir, own);
        // An app's routes are relative to where it is mounted. The board writes the address a
        // person types, so a route file only matches once the app's own mount path is in front
        // of it — without this every app but the one mounted at "/" reads as unbuilt.
        const base = basePathOf(join(appsDir, app));
        for (const path of own) {
          found.add(base === '/' ? path : (path === '/' ? base : base + path));
        }
      }
    }
    return found;
  }

  /**
   * Where an app is mounted, as its own Vite config declares it.
   *
   * <p>Read from the config rather than kept in a list here, so an app added tomorrow is measured
   * at the address it actually serves.
   *
   * @param appDir the app's directory
   * @returns its mount path, e.g. `/worker`; `/` when it declares none
   */
  function basePathOf(appDir) {
    const config = join(appDir, 'vite.config.ts');
    if (!existsSync(config)) return '/';
    const declared = readFileSync(config, 'utf8').match(/basePath:\s*["'`]([^"'`]+)["'`]/);
  return declared ? declared[1].replace(/\/$/, '') : '/';
}

/**
 * @param dir the directory being read
 * @param base the routes root the path is measured from
 * @param out collects the served paths
 */
function walk(dir, base, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, base, out);
      continue;
    }
    if (!name.endsWith('.tsx')) continue;
    if (name.startsWith('__')) continue;
    const rel = relative(base, full).replace(/\.tsx$/, '');
    const path = rel === 'index' ? '/' : '/' + rel.replace(/\/index$/, '');
    out.add(fixedPart(path, (seg) => seg.startsWith('$')));
  }
}

/**
 * A path reduced to the segments that name a screen.
 *
 * <p>Parameter segments are dropped and everything else is kept in order. Dropping them is what
 * lets a board route and a route file meet when they disagree only on how the selection travels
 * — `/sites/{id}` against a screen at `/sites` that carries the id in the query string.
 * Keeping everything else is what stops two different screens from collapsing into one:
 * `/sites/{id}/areas` is not the screen at `/sites`, and a matcher that stopped at the first
 * parameter would report the second as serving the first and count an unbuilt screen as
 * reachable — the one thing this script exists to notice.
 *
 * @param path the path to reduce
 * @param isParameter whether a segment names a parameter rather than a screen
 * @returns the fixed segments, joined
 */
function fixedPart(path, isParameter) {
  const fixed = path.split('/').filter(Boolean).filter((seg) => !isParameter(seg));
  return fixed.length === 0 ? '/' : '/' + fixed.join('/');
}

/**
 * Whether a board route can be opened.
 *
 * <p>The board writes path parameters the way a REST resource reads (`/sites/{id}`), while
 * these apps carry the selection in the query string instead. So both sides are reduced to the
 * segments that name a screen and compared as a whole — see {@link fixedPart}.
 *
 * @param route the route a frame declares
 * @param served every path the apps serve, already reduced
 * @returns whether some app serves it
 */
function isServed(route, served) {
  return served.has(fixedPart(route, (seg) => seg.startsWith('{')));
}

const wanted = section ? section.toUpperCase() : null;

// A front end that is not where this looks would report every frame as unreachable, and
// "nothing is built yet" and "the declared path is wrong" print the same number. Say which it
// is, because only one of the two is a coverage result.
const present = APP_ROOTS.filter((dir) => existsSync(dir));
if (!present.length) {
  console.log(`앱을 찾지 못했다 — ${APP_ROOTS.map((d) => relative(boardDir, d)).join(', ')}`);
  console.log('프론트엔드가 아직 없으면 정상이다. 있다면 board.config.mjs의 code.appRoots를 고친다.\n');
}

const served = servedRoutes();
const rows = [];

for (const sec of manifest) {
  if (wanted && sec.letter !== wanted) continue;
  const frames = [];
  for (const screen of sec.screens) {
    const mod = await import(join(boardDir, 'src', 'screens', `${screen.file}.mjs`));
    const route = mod.default?.route ?? '';
    frames.push({
      file: screen.file,
      label: screen.label,
      route,
      state: isPattern(route) ? 'pattern' : isServed(route, served) ? 'served' : 'missing',
    });
  }
  rows.push({ letter: sec.letter, title: sec.title, frames });
}

const width = Math.max(...rows.map((r) => r.title.length));
let totalServed = 0;
let totalFrames = 0;

for (const row of rows) {
  const counted = row.frames.filter((f) => f.state !== 'pattern');
  const ok = counted.filter((f) => f.state === 'served').length;
  totalServed += ok;
  totalFrames += counted.length;

  const missing = row.frames.filter((f) => f.state === 'missing');
  if (!onlyMissing || missing.length) {
    const bar = counted.length ? `${ok}/${counted.length}` : '—';
    console.log(`${row.letter}  ${row.title.padEnd(width)}  ${bar.padStart(7)}`);
  }
  for (const f of missing) {
    console.log(`     ✖ ${f.file.padEnd(32)} ${f.route}`);
  }
}

console.log(`\n도달 가능 ${totalServed}/${totalFrames} · 라우트 없음 ${totalFrames - totalServed}`);
console.log('✖ 표시가 없는 것은 라우트가 있다는 뜻일 뿐이다 — 상태까지 맞는지는 손으로 대조한다.');
return { served: totalServed, frames: totalFrames };
}
