// What changed between board contracts, and what a board has to do to cross each one.
//
// A board declares in `board.config.mjs` the contract it was last brought up to (`contract: 3`),
// and the kit declares the one it writes (`BOARD_CONTRACT` in `partials.mjs`). When the two
// differ, this file is the answer to «what do I actually have to change» - written down at the
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
 * @property changed what is different about the kit - read to decide whether the move matters
 * @property steps what a board must do, in order, to be on this contract. Imperative, concrete,
 *   and naming files - this is executed, not summarised
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
      'Decide which numbering becomes permanent (the file-name ids, or what the board displays today), and rename the drifted screen files to match the decision.',
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
      'Delete the board\'s `tools/` directory: every script in it now lives in the kit.',
      'Write `wf.mjs` in the board folder: the bootstrap that resolves the kit and forwards to it.',
      'Replace `src/components.mjs`, `src/partials.mjs` and `src/styles.css` with the pattern\'s copies. A style the board genuinely added stays in `src/styles.css`, which the kit appends to the pattern\'s; a component or a gate it added goes into the pattern, and a board whose components are mostly its own takes a pattern of its own with `node wf.mjs pattern adopt`.',
      'Split `src/chrome.mjs`: the shells come from the pattern, and the board keeps its own menu tree, roles and purchase as the data it hands the shell factory.',
      'Move the board\'s own gates (the ones that read this product\'s documents) into `board.gates.mjs`.',
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
      'TWO CHANGES ARE NOT BEHIND A SWITCH, because a board wanting the old behaviour wants a defect. `fNum` takes its width from the digits it holds rather than stretching to the form column: a two-digit field at the width of a sentence stops saying what goes in it. The list column of `listDetail` carries its own bottom gutter, so opening a record no longer adds or removes space beneath the rows and the reader keeps the line they were on.',
    ],
    steps: [
      'Read the two unswitched changes above and look at one form frame and one list-detail frame after building: they are the only places the drawing moves.',
      'Where a number field must hold more digits than the value it draws, state `digits` on that `fNum`; the default reads the drawn value.',
      'Decide each `patternOptions` capability and declare the ones you want in `board.config.mjs`. Declaring none is a complete answer and keeps the board as it is.',
      'A board switching `dismissibleNotices` on owes the header controls with it (`pageHeader({ notices, drop })`), or its cards close with no way back.',
      'Raise `contract` to 4 in `board.config.mjs`, build, and confirm the board is unchanged apart from those two.',
    ],
    // A board still declaring 3 is refused by this kit like any board behind it (`loadBoard`), so
    // not crossing stops the build even though crossing changes nothing a board did not ask for.
    breaking: true,
  },
];

/** The contract the newest entry describes. The kit's own `BOARD_CONTRACT` must equal this. */
export const LATEST = MIGRATIONS[MIGRATIONS.length - 1].contract;

/**
 * What a board may owe without crossing a contract: a key the kit reads differently, or a piece a
 * shipped pattern no longer carries.
 *
 * <p><b>None of these refuses a build.</b> A board that carries the key keeps loading and keeps
 * drawing what it drew; what it loses is a check or a piece it relied on, so the loss is named
 * where somebody looks - `node wf.mjs doctor` lists every entry that applies to the board, the
 * build names a declared document nothing read, and `node wf.mjs migrations` lists them all.
 *
 * @property id the key or piece the entry is about, as a board would write it
 * @property applies `(config) => boolean` - whether this board carries what the entry is about
 * @property documentsKey the `documents.<key>` the entry explains when the build finds it unread
 * @property title one line naming the change
 * @property changed what is different about the kit
 * @property steps what a board that carries the key does, in order. Imperative and concrete
 */
export const CONFIG_CHANGES = [
  {
    id: 'documents.frameManifest',
    applies: (c) => Boolean(c.documents?.frameManifest),
    documentsKey: 'frameManifest',
    title: 'No kit gate parses the frame manifest',
    changed: [
      'The gate holding a design document\'s per-cluster item lists and its summary table to the manifest parsed one project\'s heading and table shapes, so it is that project\'s gate rather than the kit\'s.',
    ],
    steps: [
      'Write a gate in `board.gates.mjs` that reads `documents.frameManifest` in this project\'s format and compares it with `ctx.manifest`, with one case that trips it and one that does not.',
      'Run `node wf.mjs gates`, then `node wf.mjs build`: the notice for the key is gone once a gate reads it.',
    ],
  },
  {
    id: 'documents.roadmap',
    applies: (c) => Boolean(c.documents?.roadmap),
    documentsKey: 'roadmap',
    title: 'No kit gate parses the roadmap',
    changed: [
      'The gate holding a plan\'s phase lists, its per-phase screen counts and its placement tables to the board parsed one project\'s plan format, so it is that project\'s gate rather than the kit\'s.',
    ],
    steps: [
      'Write a gate in `board.gates.mjs` that reads `documents.roadmap` in this project\'s format, with one case that trips it and one that does not. A directory of plan files arrives as one text when the gate joins its `.md` files in name order.',
      'Run `node wf.mjs gates`, then `node wf.mjs build`: the notice for the key is gone once a gate reads it.',
    ],
  },
  {
    id: 'documents.notFrames',
    applies: (c) => Boolean(c.documents?.scan),
    title: 'docFrameRefGate exempts only the ids the board names',
    changed: [
      '`docFrameRefGate` carries no exemption of its own: an id of another numbering scheme that a scanned document cites (a guide number, a visa class) is a citation of a missing frame unless `documents.notFrames` names it.',
    ],
    steps: [
      'Run `node wf.mjs build`. Where `docFrameRefGate` now refuses on an id that is not a frame, add that id to `documents.notFrames` in `board.config.mjs`.',
    ],
  },
  {
    id: 'requirements',
    applies: (c) => Boolean(c.documents?.frameInventory) && !c.requirements?.id,
    documentsKey: 'frameInventory',
    title: 'The requirement trace reads the requirement id shape from `requirements`',
    changed: [
      'The trace table of `documents.frameInventory` and the requirement ids a frame\'s notes cite are read with `requirements.id`, a regular expression the board declares. A board that declares none draws no requirement line and reads no trace table.',
      '`requirements.outside` names the inventory section listing screens drawn beyond the requirements; its screens carry that text as their answer. `requirements.documents` names the documents a note cites by section number, which the frame spec lists beside the requirement ids.',
    ],
    steps: [
      'Declare `requirements: { id: \'<regular expression matching one requirement id>\', outside: \'<heading text of that section>\', documents: [\'<document name>\'] }` in `board.config.mjs`. Only `id` is needed for the trace table.',
      'Build, and compare one frame\'s requirement line with what it drew before.',
    ],
  },
  {
    id: 'sourceWords',
    applies: (c) => c.pattern === 'simplix-basic' && !c.sourceWords?.length,
    title: 'simplix-basic\'s source-badge vocabulary is the board\'s',
    changed: [
      '`sourceWordGate` holds every `sourceBadge` word to `sourceWords` in `board.config.mjs`. A board that declares no list is not held to one, and `node wf.mjs doctor` names the gate as not configured.',
    ],
    steps: [
      'Declare `sourceWords: [\'<layer word>\', …]` with every word a source badge on this board may carry, or leave it out to switch the gate off.',
    ],
  },
  {
    id: 'site.languages',
    applies: (c) => c.pattern === 'simplix-basic' && !c.site?.languages?.length,
    title: 'simplix-basic\'s language-list gate runs where the site\'s languages are declared',
    changed: [
      '`languageSetGate` holds every `langTabs` list to `site.languages`, and a tab that is not a language name (an all-languages filter, a side-by-side view) to `site.notLanguages`. A board that declares no languages is not held to them, and `node wf.mjs doctor` names the gate as not configured.',
    ],
    steps: [
      'Declare `site: { languages: [\'<language as the tab writes it>\', …], notLanguages: [\'<tab label that is not a language>\', …] }`, or leave it out to switch the gate off.',
    ],
  },
  {
    id: 'fieldLanguages',
    applies: (c) => c.pattern === 'simplix-basic' && !c.fieldLanguages?.length,
    title: 'simplix-basic\'s field-app languages are the board\'s',
    changed: [
      '`workerLangGate` recognises a field-app body written in a language by the letters `fieldLanguages` in `board.config.mjs` declares for it, and asks that frame to hand the shell that language\'s `lang`. A board that declares no languages is not held to any, and `node wf.mjs doctor` names the gate as not configured.',
      'The shell\'s words in a language other than Korean (the offline strip, the required mark, the message kinds, the mail header, the AI badge words) come from each entry\'s `text`. A `lang` the board does not declare draws Korean.',
    ],
    steps: [
      'Declare `fieldLanguages: [{ lang: \'<code>\', name: \'<the language in its own name>\', letters: /<one letter only it writes>/, min: <letters that make a body>, text: { … } }, …]`, or leave it out to switch the gate off and draw every shell in Korean.',
      'Build, and compare a frame that passes `lang` with what it drew before: the words now come from `text`.',
    ],
  },
  {
    id: 'aiWords',
    applies: (c) => c.pattern === 'simplix-basic' && !c.aiWords?.length,
    title: 'simplix-basic\'s AI-badge vocabulary is the board\'s',
    changed: [
      '`aiWordGate` holds every `aiBadge` word to `aiWords` in `board.config.mjs`. A board that declares no list is not held to one, and `node wf.mjs doctor` names the gate as not configured.',
    ],
    steps: [
      'Declare `aiWords: [\'<word>\', …]` with every word an AI badge on this board may carry, or leave it out to switch the gate off.',
    ],
  },
  {
    id: 'aiTiers',
    applies: (c) => c.pattern === 'simplix-basic' && !c.aiTiers?.tiers?.length,
    title: 'simplix-basic\'s AI-card tiers are the board\'s',
    changed: [
      '`aiTierGate` holds every `aiCard` tier to `aiTiers.tiers` in `board.config.mjs`, and refuses a card on a tier `aiTiers.alwaysOn` names. A board that declares no tiers is not held to any, and `node wf.mjs doctor` names the gate as not configured.',
    ],
    steps: [
      'Declare `aiTiers: { tiers: [<tier>, …], alwaysOn: [<tier that cannot be switched off>, …] }`, or leave it out to switch the gate off.',
    ],
  },
  {
    id: "pattern: 'penstock-console'",
    applies: (c) => c.pattern === 'penstock-console',
    title: 'penstock-console carries no answer-and-evidence primitives',
    changed: [
      'The primitives one retrieval product drew its answers with left the shipped pattern: `GRADE_LABEL` with `sentence` and `round`, `TIER_LABEL` with `tier` and `evidence`, `graphCanvas`, `askBox`, `planted`, and `pdfPage` (the PDF page with coordinate boxes), with their styles and catalogue entries.',
    ],
    steps: [
      'A board whose screens import none of them owes nothing.',
      'A board whose screens import one of them takes a pattern of its own: `node wf.mjs pattern fork`, then add those definitions and their styles to the forked `components.mjs` and `styles.css`, and build. The board then owns them.',
    ],
  },
];

/** The entries of {@link CONFIG_CHANGES} that apply to one board's config. */
export const configChangesFor = (config) => CONFIG_CHANGES.filter((c) => c.applies(config));

/** The exports a shipped pattern no longer carries, so a failed screen import can name its step. */
export const REMOVED_EXPORTS = {
  'penstock-console': ['GRADE_LABEL', 'sentence', 'round', 'TIER_LABEL', 'tier', 'evidence', 'graphCanvas', 'askBox', 'planted', 'pdfPage'],
};

/**
 * Every migration a board on `from` has to cross to reach `to`.
 *
 * <p>A board on contract 1 moving to 3 gets both entries in order, because the steps compose -
 * skipping the middle one is how a board ends up half-migrated with nothing saying so.
 */
export function stepsBetween(from, to = LATEST) {
  return MIGRATIONS.filter((m) => m.contract > from && m.contract <= to);
}

/** A short human report of what a board owes, or null when it owes nothing. */
export function migrationReport(from, to = LATEST) {
  const pending = stepsBetween(from, to);
  if (!pending.length) return null;
  const lines = [`board contract ${from} · kit contract ${to} - migrations left: ${pending.map((m) => m.contract).join(', ')}`];
  for (const m of pending) {
    lines.push(`\n  contract ${m.contract} - ${m.title}${m.breaking ? ' (the build stops until it is crossed)' : ''}`);
    for (const s of m.steps) lines.push(`    · ${s}`);
  }
  lines.push('\n  Run /simplecore:board-migrate to carry it out.');
  return lines.join('\n');
}
