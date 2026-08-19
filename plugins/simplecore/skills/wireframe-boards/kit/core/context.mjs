// Loading one board: its settings, the pattern it is drawn in, and every screen module.
//
// Everything downstream — the build, the gates, the catalog, the checks, the exports — reads the
// context this file produces and never reaches into the board folder itself. That is what lets a
// gate written here judge any board: it is handed the board rather than importing one.
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kitCoreDir = dirname(fileURLToPath(import.meta.url));
import { idOf } from './ids.mjs';
import { makePartials, BOARD_CONTRACT } from './partials.mjs';
import { textFor } from './text.mjs';
import { migrationReport } from './migrations.mjs';

/** Import a board-local module by path, or null when the board does not have that file. */
const optional = async (path) =>
  existsSync(path) ? await import(pathToFileURL(path).href) : null;

/**
 * What a board's `board.config.mjs` means when it does not say.
 *
 * <p>A default is only written here when there is one answer every board would give. `pdfName`,
 * `documents` and `requiredSections` are absent on purpose — a board that has not declared them
 * gets no PDF name of its own, no document gates, and no coverage requirement, which is the
 * correct behaviour for a board being started rather than a reason to guess.
 */
const CONFIG_DEFAULTS = {
  pattern: 'simplix-basic',
  phases: {},
  features: {},
  requiredSections: [],
  // What this board switches on in the pattern it is drawn in. Empty is the answer for a board
  // that has declared nothing, and that board draws exactly what it drew before — a capability
  // the pattern gains is off until a board asks for it by name.
  patternOptions: {},
};

/**
 * Read a board and everything it composes from.
 *
 * @param boardDir the folder holding `board.config.mjs` and `src/`
 * @param screens load and import every screen module. False for commands that only need the
 *   settings (`doctor`, `pdf` over an already-built board), which is the difference between
 *   reading one file and importing seven hundred
 */
/**
 * Where the pattern this board is drawn in lives.
 *
 * <p><b>Two kinds, and the difference is a decision rather than a convenience.</b> A NAME is a
 * pattern the kit ships: it resolves through the board's own `.kit` link rather than from this
 * file's location, so a board pinned to a checkout by `WIREFRAME_KIT` loads that checkout's
 * pattern too — one answer to 「which kit」 rather than one for the engine and another for the
 * components. A PATH beginning with `.` is a pattern the BOARD carries, resolved from the board
 * folder and committed with it.
 *
 * <p><b>A board carries its own only when the shipped ones are the wrong vocabulary.</b> A
 * component that would be right in a second product drawn the same way belongs in the shipped
 * pattern, where the second product gets it. A product whose component set is mostly its own has
 * nothing to share, and without this it is outside the contract altogether — no gate reaches it
 * and the board cannot be built by the kit at all. The cost is stated where the procedure is: a
 * board with its own pattern stops receiving the kit's improvements to that pattern, and owns the
 * gates that came with it.
 *
 * @param boardDir the board folder
 * @param pattern the `pattern` field of `board.config.mjs`
 * @returns the directory holding `pattern.mjs`, `components.mjs` and `styles.css`
 */
export function patternDirFor(boardDir, pattern) {
  return pattern.startsWith('.')
    ? resolve(boardDir, pattern)
    : join(boardDir, '.kit', 'patterns', pattern);
}

export async function loadBoard(boardDir, { screens = true } = {}) {
  const configPath = join(boardDir, 'board.config.mjs');
  if (!existsSync(configPath)) {
    throw new Error(`${boardDir}에 board.config.mjs가 없습니다 — 여기는 보드 폴더가 아닙니다`);
  }
  const config = { ...CONFIG_DEFAULTS, ...(await import(pathToFileURL(configPath).href)).default };
  config.boardName ??= config.pdfName ?? basename(boardDir);
  config.title ??= `Wireframe — ${config.boardName}`;

  // Which contract this board was last brought up to. A board that predates the declaration is
  // read as 1 — the contract that had no stamp — rather than as «current», because assuming
  // current is the reading that silently skips a migration the board genuinely owes.
  config.contract ??= 1;
  if (config.contract < BOARD_CONTRACT) {
    // Refused, not warned. The steps between two contracts change what a screen file may say and
    // where the components live, so a build that keeps going produces a board drawn half one way
    // and half the other — and nothing in the artifact would show which halves.
    throw new Error(
      `${migrationReport(config.contract, BOARD_CONTRACT)}\n\n` +
      `board.config.mjs의 contract를 ${BOARD_CONTRACT}로 올리는 것은 마이그레이션의 마지막 단계입니다.`
    );
  }
  if (config.contract > BOARD_CONTRACT) {
    throw new Error(
      `보드는 계약 ${config.contract}을 선언했는데 이 킷이 지원하는 계약은 ${BOARD_CONTRACT}까지입니다 — ` +
      '킷이 오래되었습니다. claude plugin update simplecore@simplecore-skills'
    );
  }

  const patternDir = patternDirFor(boardDir, config.pattern);
  if (!existsSync(patternDir)) {
    throw new Error(
      `공통패턴 '${config.pattern}'을 찾지 못했습니다 (${patternDir}).\n` +
      "킷이 싣고 다니는 패턴은 이름으로 적고(pattern: 'simplix-basic'), 이 보드가 가진 패턴은 " +
      "보드 폴더 기준 경로로 적습니다(pattern: './pattern'). 쓸 수 있는 이름은 " +
      'node wf.mjs patterns, 보드가 제 패턴을 갖는 절차는 node wf.mjs pattern fork입니다.'
    );
  }
  const pattern = (await import(pathToFileURL(join(patternDir, 'pattern.mjs')).href)).default;
  const components = await import(pathToFileURL(join(patternDir, 'components.mjs')).href);
  // A capability the pattern draws only when a board asks for it. This runs BEFORE any screen
  // module is imported — a screen's body is built at import time, so a switch thrown afterwards
  // would reach the gates and not the drawing. Every command comes through here, so `catalog`,
  // `check` and `shots` see the same board `build` does.
  //
  // **The pattern names the capability; the board answers yes or no.** The kit holds neither —
  // it knows only that a pattern may take a declaration and where that declaration lives.
  components.configure?.(config.patternOptions ?? {});

  // What the board itself settles. Each is optional, and each absence means something specific:
  // no roles means the board draws no visibility strip, no crud means the CRUD census is not run,
  // no gates means the board adds nothing to the pattern's.
  const roles = await optional(join(boardDir, 'src/roles.mjs'));
  // Read for the opening overview only: it renders the IA from the same data the shells draw
  // from, so the map at the front and the menu inside every frame cannot disagree.
  const chrome = await optional(join(boardDir, 'src/chrome.mjs'));
  const crud = await optional(join(boardDir, 'src/crud.mjs'));
  const projectGates = await optional(join(boardDir, 'board.gates.mjs'));

  // The board's mark, read once and carried as a data URI. `logo` in `board.config.mjs` is a
  // path relative to the board folder; a path that resolves to nothing leaves the header without
  // a mark rather than stopping the build, because a missing logo is not a broken board.
  if (config.logo) {
    const logoPath = join(boardDir, config.logo);
    if (existsSync(logoPath)) {
      const ext = config.logo.split('.').pop().toLowerCase();
      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      config.logoData = `data:${mime};base64,${readFileSync(logoPath).toString('base64')}`;
    }
  }

  const styles = [
    // The kit's own — the opening overview, which every board has whatever it is drawn in. It
    // goes FIRST so a pattern can override it without having to restate what it agrees with.
    readFileSync(join(kitCoreDir, 'overview.css'), 'utf8'),
    // The chrome the kit's own markup needs. Second, and never a pattern's job: a pattern that a
    // board brought with it has rules for what its screens draw and none for a sidebar it never
    // wrote, and a board in that state builds green with an index filter that hides nothing.
    readFileSync(join(kitCoreDir, 'chrome.css'), 'utf8'),
    readFileSync(join(patternDir, 'styles.css'), 'utf8'),
    // A board's own stylesheet is appended rather than substituted, so it overrides the pattern
    // without having to restate it. Most boards will not have one.
    existsSync(join(boardDir, 'src/styles.css')) ? readFileSync(join(boardDir, 'src/styles.css'), 'utf8') : '',
  ].join('\n');

  // The reading contract's three layers. The pattern and the board contribute `<li>` items and
  // the kit renders the standing ones above them — so neither can drop the standing contract,
  // which is exactly what must never happen (SKILL.md rule 4).
  const introParts = {
    patternItems: existsSync(join(patternDir, 'intro.html'))
      ? readFileSync(join(patternDir, 'intro.html'), 'utf8') : '',
    boardItems: existsSync(join(boardDir, 'src/intro.html'))
      ? readFileSync(join(boardDir, 'src/intro.html'), 'utf8') : '',
  };

  const ctx = {
    boardDir,
    patternDir,
    config,
    pattern,
    components,
    roles,
    chrome,
    crud,
    projectGates,
    styles,
    introParts,
    partials: makePartials({ components, roles, lang: config.boardLang }),
    text: textFor(config.boardLang),
    manifest: [],
    sections: [],
    screens: [],
    loaded: [],
    byId: new Map(),
    componentsSrc: readFileSync(join(patternDir, 'components.mjs'), 'utf8'),
    html: '',
  };
  if (!screens) return ctx;

  const manifest = (await import(pathToFileURL(join(boardDir, 'src/manifest.mjs')).href)).default;
  ctx.manifest = manifest;
  ctx.screens = manifest.flatMap((s) => s.screens);

  for (const sec of manifest) {
    const entries = [];
    for (const sc of sec.screens) {
      const path = join(boardDir, 'src/screens', `${sc.file}.mjs`);
      if (!existsSync(path)) {
        throw new Error(`manifest에 적힌 화면 파일이 없습니다: src/screens/${sc.file}.mjs`);
      }
      const mod = (await import(pathToFileURL(path).href)).default;
      entries.push({ ...sc, mod, id: idOf(sc.file) });
      ctx.loaded.push({ num: idOf(sc.file) ?? sc.file, file: sc.file, label: sc.label, mod });
    }
    ctx.sections.push({ ...sec, entries });
  }

  // Screen sources are read by a dozen gates; reading each file once keeps that from being a
  // dozen reads of the same file.
  const srcCache = new Map();
  ctx.srcOf = (file) => {
    if (!srcCache.has(file)) {
      srcCache.set(file, readFileSync(join(boardDir, `src/screens/${file}.mjs`), 'utf8'));
    }
    return srcCache.get(file);
  };
  return ctx;
}
