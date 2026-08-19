// What changed between board contracts, and what a board has to do to cross each one.
//
// A board declares in `board.config.mjs` the contract it was last brought up to (`contract: 3`),
// and the kit declares the one it writes (`BOARD_CONTRACT` in `partials.mjs`). When the two
// differ, this file is the answer to «what do I actually have to change» — written down at the
// moment the change is made, while the reason is still in hand, rather than reconstructed later
// from a diff by somebody who was not there.
//
// **A version whose `steps` a person cannot follow is not recorded yet.** The entry is the
// migration; `/simplecore:board-migrate` reads it and does what it says, so a vague line here
// becomes a vague migration for every board that crosses it.
//
// Add an entry in the SAME change that bumps `BOARD_CONTRACT`. The two are one edit, and a bump
// without an entry leaves every board with a number it cannot act on.

/**
 * One contract, and what crossing INTO it costs.
 *
 * @property contract the number a board carries once this migration is done
 * @property title one line naming what the version is about
 * @property changed what is different about the kit — read to decide whether the move matters
 * @property steps what a board must do, in order, to be on this contract. Imperative, concrete,
 *   and naming files — this is executed, not summarised
 * @property breaking a board that does NOT migrate stops building against this kit
 */
export const MIGRATIONS = [
  {
    contract: 2,
    title: 'Permanent frame ids, and rows that wrap instead of scrolling sideways',
    changed: [
      'A frame\'s id comes from its file name and never changes; the bracketed number beside it is the board position and is recomputed every build.',
      'Rows wrap at `--row-max` rather than scrolling sideways, so reading a board is one vertical scroll.',
      'The built board carries `<meta name="wireframe-board-contract">`.',
    ],
    steps: [
      'Decide which numbering becomes permanent — the file-name ids, or what the board displays today — and rename the drifted screen files to match the decision.',
      'Rewrite every `{{slug}}` note reference that named a renamed file.',
      'Derive the id from the file name in the build; refuse on a missing id, a section-letter mismatch, or a duplicate that is not one screen\'s two viewport halves.',
      'Give `.row` `max-width: var(--row-max)` and wrap it; add the `--frame-zoom` steps and `.scroll-x`.',
      'Add the reading-contract item that explains the id and the position.',
    ],
    breaking: true,
  },
  {
    contract: 3,
    title: 'The kit lives in the skill; the board holds only its own content',
    changed: [
      'The engine, the gates, the exports, the components, the shells and the styles all live in the skill under `kit/`. A board no longer carries `tools/`.',
      'A board declares `pattern:` in `board.config.mjs` and the pattern supplies its components, shells, styles and pattern gates.',
      'Screens keep importing `../components.mjs` and `../chrome.mjs`; both are now one-line shims re-exporting the pattern through the board\'s `.kit` link.',
      'The document gates read paths declared in `board.config.mjs` `documents` rather than naming a product\'s files, so they run on any board that declares them.',
      'A board\'s own gates live in `board.gates.mjs` and are appended to the kit\'s.',
      '`board.config.mjs` carries `contract:`, and `node wf.mjs doctor` reports when it is behind.',
    ],
    steps: [
      'Delete the board\'s `tools/` directory — every script in it now lives in the kit.',
      'Write `wf.mjs` in the board folder: the bootstrap that resolves the kit and forwards to it.',
      'Replace `src/components.mjs`, `src/partials.mjs` and `src/styles.css` with the pattern\'s copies; keep only what the board genuinely added, in `src/styles.css` (appended) and `src/local.mjs`.',
      'Split `src/chrome.mjs`: the shells come from the pattern, and the board keeps its own menu tree, roles and purchase as the data it hands the shell factory.',
      'Move the board\'s own gates — the ones that read this product\'s documents — into `board.gates.mjs`.',
      'Declare `pattern:` and `contract: 3` in `board.config.mjs`, and move the document paths under `documents:`.',
      'Add `.kit` to `.gitignore`.',
      'Run `node wf.mjs build` and confirm the built board is unchanged apart from the contract stamp.',
    ],
    breaking: true,
  },
  {
    contract: 4,
    title: 'A pattern capability is off until a board asks, and two corrections to how simplix-basic draws',
    changed: [
      '`board.config.mjs` may carry `patternOptions`, and the kit hands it to the pattern before any screen module is imported. Everything a pattern gains is off until a board names it, so a board that declares nothing draws exactly what it drew before.',
      '`simplix-basic` declares three: `dismissibleNotices` (a close on the notice cards, and the page header controls that bring a closed one back), `noticeKindMarks` (a glyph beside a message\'s kind word), `chipClearControl` (the control that clears a chip filter once a second chip is lit).',
      'TWO CHANGES ARE NOT BEHIND A SWITCH, because a board wanting the old behaviour wants a defect. `fNum` takes its width from the digits it holds rather than stretching to the form column — a two-digit field at the width of a sentence stops saying what goes in it. The list column of `listDetail` carries its own bottom gutter, so opening a record no longer adds or removes space beneath the rows and the reader keeps the line they were on.',
    ],
    steps: [
      'Read the two unswitched changes above and look at one form frame and one list-detail frame after building — they are the only places the drawing moves.',
      'Where a number field must hold more digits than the value it draws, state `digits` on that `fNum`; the default reads the drawn value.',
      'Decide each `patternOptions` capability and declare the ones you want in `board.config.mjs`. Declaring none is a complete answer and keeps the board as it is.',
      'A board switching `dismissibleNotices` on owes the header controls with it — `pageHeader({ notices, drop })` — or its cards close with no way back.',
      'Raise `contract` to 4 in `board.config.mjs`, build, and confirm the board is unchanged apart from those two.',
    ],
    breaking: false,
  },
];

/** The contract the newest entry describes. The kit's own `BOARD_CONTRACT` must equal this. */
export const LATEST = MIGRATIONS[MIGRATIONS.length - 1].contract;

/**
 * Every migration a board on `from` has to cross to reach `to`.
 *
 * <p>A board on contract 1 moving to 3 gets both entries in order, because the steps compose —
 * skipping the middle one is how a board ends up half-migrated with nothing saying so.
 */
export function stepsBetween(from, to = LATEST) {
  return MIGRATIONS.filter((m) => m.contract > from && m.contract <= to);
}

/** A short human report of what a board owes, or null when it owes nothing. */
export function migrationReport(from, to = LATEST) {
  const pending = stepsBetween(from, to);
  if (!pending.length) return null;
  const lines = [`보드 계약 ${from} · 킷 계약 ${to} — 남은 마이그레이션 ${pending.length}단계`];
  for (const m of pending) {
    lines.push(`\n  계약 ${m.contract} — ${m.title}${m.breaking ? ' (빌드가 멈춥니다)' : ''}`);
    for (const s of m.steps) lines.push(`    · ${s}`);
  }
  lines.push('\n  /simplecore:board-migrate 명령으로 진행합니다.');
  return lines.join('\n');
}
