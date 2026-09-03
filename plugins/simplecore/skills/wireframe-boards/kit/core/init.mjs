// Stand up a new board: the bootstrap, the folder contract, and the pattern's starter frames.
//
// Everything written here is CONTENT — screens, a manifest, an information architecture, the
// rules for this board. No tool is copied, because there is no tool to copy: the engine stays in
// the skill and `wf.mjs` finds it.
//
//   node <kit>/bin/wfb.mjs init --board <dir> --pattern simplix-basic --name "<PRODUCT>"
//
// **Nothing is overwritten.** A file that is already there is left alone and reported, so running
// init twice is safe and running it over a half-set-up board fills in only the gaps.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD_CONTRACT } from './partials.mjs';

const kitDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** The board's only script — a copy of the kit's bootstrap, with nothing board-specific in it. */
const BOOTSTRAP = join(kitDir, 'templates/wf.mjs');

const GITIGNORE = `# Build output that is regenerated rather than reviewed in a diff. \`board.html\` IS tracked —
# it is the artifact people open — and everything here is a by-product of building it.
_catalog.html
_shots/

# Every build's stamped PDF, in a folder of its own. They are kept rather than swept — a copy
# that has already been sent is the only record of what the reader on the other end is looking
# at — and ignored rather than tracked, since each is a large binary and a new one lands every
# time a frame moves.
pdf/

# Machine-local pointer at the skill kit — wf.mjs re-points it on every run.
.kit
`;

const CLAUDE_MD = (name) => `# This folder is the ${name} wireframe board

Read [\`AGENTS.md\`](./AGENTS.md) before working here — it is the authority on the board-reading
contract, where the frames come from, the source layout, and how to build.

- **Do not open \`board.html\` to read it.** It is a thousands-of-lines build output; reading it
  whole just floods context. To find a screen, read \`src/manifest.mjs\` (the table of contents),
  then open the one \`src/screens/<letter>-<nn>-<slug>.mjs\` you need and the components it
  composes from.
- Screens are addressed by their **permanent id** (e.g. \`B-04\`), which lives in the file name and
  never changes — the bracketed number beside it on the board (\`[02]B-04\`) is only the frame's
  current position and moves on every reorder, so never cite it on its own. A new screen = one
  file in \`src/screens/\` + one line in \`manifest.mjs\`. Build with \`node wf.mjs build\`
  (add \`--no-pdf\` to skip the PDF while iterating).
- **There is no build script here.** The engine, the gates, the exports, the components and the
  app shells live in the \`simplecore:wireframe-boards\` skill; \`wf.mjs\` finds them. A change to
  how boards are built belongs in the skill, where every board gets it at once.
- The board is maintained with the \`simplecore:wireframe-boards\` skill — when screens, states,
  or flow change, update the board in the same change.
`;

/**
 * The starter config, stamped with the contract this kit writes.
 *
 * <p>A board created now is on the current contract by definition — there is no step between it
 * and the kit for a migration to carry out. The example file states a number like any other
 * board's config does, so without this it states whatever contract was current the day it was
 * last edited, and every bump of `BOARD_CONTRACT` leaves `init` producing a board that refuses to
 * build until somebody migrates a board that has never been drawn on. The stamp belongs to the
 * writing, not to the example.
 */
function onContract(text) {
  const line = /^(\s*)contract:\s*\d+\s*,\s*$/m;
  if (!line.test(text)) throw new Error('시작 board.config.mjs에 contract 줄이 없습니다');
  return text.replace(line, `$1contract: ${BOARD_CONTRACT},`);
}

/**
 * Write a file unless it is already there.
 *
 * @returns 'written' | 'kept'
 */
function put(path, body, report) {
  if (existsSync(path)) { report.kept.push(path); return 'kept'; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  report.written.push(path);
  return 'written';
}

/**
 * Set up `boardDir` as a board drawn in `pattern`.
 *
 * @param name what the product is called — substituted into the starter files
 * @param examples copy the pattern's starter frames. False for a board whose screens are about
 *   to be authored from a specification, where nine frames about records would be nine frames
 *   somebody has to delete
 */
export function initBoard(boardDir, { pattern = 'simplix-basic', name = '<PRODUCT>', examples = true } = {}) {
  const patternDir = join(kitDir, 'patterns', pattern);
  if (!existsSync(patternDir)) {
    const have = readdirSync(join(kitDir, 'patterns')).join(' · ');
    throw new Error(`공통패턴 '${pattern}'이 킷에 없습니다 — 쓸 수 있는 것: ${have}`);
  }
  const report = { written: [], kept: [], pattern, name };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';
  const fill = (t) => t.replace(/<PRODUCT>/g, name).replace(/<product>/g, slug).replace(/<COMPANY>/g, name);

  mkdirSync(join(boardDir, 'src/screens'), { recursive: true });

  put(join(boardDir, 'wf.mjs'), readFileSync(BOOTSTRAP, 'utf8'), report);
  put(join(boardDir, '.gitignore'), GITIGNORE, report);
  put(join(boardDir, 'CLAUDE.md'), CLAUDE_MD(name), report);
  put(join(boardDir, 'AGENTS.md'), fill(readFileSync(join(kitDir, 'templates/AGENTS.md'), 'utf8')), report);

  const ex = join(patternDir, 'examples');
  if (!existsSync(ex)) throw new Error(`패턴 '${pattern}'에 시작 프레임(examples/)이 없습니다`);

  put(join(boardDir, 'board.config.mjs'), onContract(fill(readFileSync(join(ex, 'board.config.mjs'), 'utf8'))), report);
  // An empty board still has to build, so it gets an empty manifest rather than the starter one
  // pointing at screens that were not copied. It is chosen HERE, before the write, so that a
  // manifest already in the folder is kept like every other file and reported once — writing the
  // empty one afterwards overwrote a board's own table of contents and said `manifest.mjs` twice.
  const EMPTY_MANIFEST =
    '// The table of contents and the build order. One entry per screen, in board order.\n' +
    'export default [];\n';
  for (const f of ['chrome.mjs', 'components.mjs', 'intro.html', 'manifest.mjs']) {
    const body = f === 'manifest.mjs' && !examples
      ? EMPTY_MANIFEST
      : fill(readFileSync(join(ex, 'src', f), 'utf8'));
    put(join(boardDir, 'src', f), body, report);
  }
  if (examples) {
    for (const f of readdirSync(join(ex, 'src/screens'))) {
      put(join(boardDir, 'src/screens', f), fill(readFileSync(join(ex, 'src/screens', f), 'utf8')), report);
    }
  }
  return report;
}
