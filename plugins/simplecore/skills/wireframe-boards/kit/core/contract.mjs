// The reading contract, and the header above it.
//
// **This ships on every board and is never deleted or trimmed.** A board reaches its reader
// stripped of the conversation that produced it, and both people and LLMs otherwise reproduce
// the greyboxes as a design. That is why the standing items live HERE, in the kit, rather than
// in a file each board could edit: a board contributes items, it does not replace them.
//
// Three layers, in this order, and each may only append:
//
//   core     the items below — what a wireframe is and is not, how to read a frame label
//   pattern  `patterns/<name>/intro.html` — what is true of every board drawn that way
//   board    `<board>/src/intro.html` — this product's own rules
//
// Each of the two files holds bare `<li>` elements and nothing else. Handing them a fragment
// rather than a document is what makes «never trim items 1–13» structural instead of a comment
// somebody has to obey.

import { textFor } from './text.mjs';

/** The standing items. Numbered in the rendered list; the order here is the order read. */
const STANDING = [
  '<strong>This is a low-fidelity wireframe, not a design.</strong> It fixes <em>what is on each screen, in which state, and how the user moves between screens</em> — the minimum needed to start building. It says nothing about how the product should look.',
  '<strong>Never reproduce this board\'s appearance.</strong> Greyscale fills, 1px borders, corner radii, paddings, the single accent color, device chrome, and this monospaced notation are board notation. Build with the project\'s own design system and component library, and let it decide color, type, spacing, elevation, and motion.',
  '<strong>Grey bars and boxes are placeholders</strong> (<code>.bar</code>, <code>.img-ph</code>, <code>.qr-ph</code>, <code>.thumb</code>) standing in for real data. They are not grey rectangles in the product.',
  '<strong>Real text is the specified wording — keep it.</strong> Button labels, screen titles, field labels, tab names, empty-state and error copy are the intended strings. Placeholder bars are not strings.',
  '<strong>Every frame is one screen × one state.</strong> States drawn here (empty, error, loading, expired, terminal, permission-gated, overlay) are requirements; implement all of them, not only the happy path.',
  '<strong>The frame label reads <code>[position] ID [chips] route — screen — state</code>.</strong> The <strong>ID</strong> (<code>B-04</code>) is that screen\'s permanent name: it never changes, and it is what to use when referring to a screen anywhere — a plan, a ticket, the parity list, a message. The bracketed <strong>position</strong> (<code>[02]</code>) is only where the frame currently sits on the board and moves whenever the board is reordered, so never cite it on its own. Notes carry <code>AUTH:</code> (entry precondition), <code>DATA:</code> (source endpoint), <code>OPEN:</code> (unresolved question).',
  '<strong>An <code>OPEN:</code> note blocks that part of the implementation.</strong> Resolve it with the board\'s author — never guess, and never let the drawn shape stand in for the missing decision.',
  '<strong>A hatched band and a dashed device mean that frame is not being built now.</strong> The band names the phase and why it waits; the same chip repeats in the frame label and at the head of the notes, so a frame that reaches you alone — a screenshot, one page of the PDF, a link — still says it. A deferred frame is drawn to its full requirement and is <em>decided</em>, not unresolved: do not implement it, and do not treat it as an <code>OPEN:</code> question either. Everything <strong>not</strong> so marked is in scope now.',
  '<strong>An outlined chip beside the id names what has to be BOUGHT before anyone reaches that frame.</strong> It is a second axis and not the band above: the band says the drawing is not there yet, the chip says the drawing is right here and a licence stands between the user and it. The notes repeat the chip, the exact feature key an implementer gates on, and one line saying what buying it opens. A frame with no chip opens in every installation. <strong>Implement a chipped frame now</strong> — it is in scope; what the chip changes is that the screen sits behind a feature check. The catalogue of keys is <code>board.config.mjs</code>.',
  '<strong>Device frames are reference viewports, not breakpoints to hard-code.</strong> Phone and tablet frames are fixed device viewports. Desktop frames pin only the width: the page height is fluid, and the dashed <em>fold</em> line marks the smallest supported window — everything the user must act on belongs above it.',
  '<strong>A narrow/wide pair is one responsive screen, not two screens.</strong> The pair records how the layout reflows between the two viewports; implement a single screen that spans them.',
  '<strong>Arrows, numbered steps, stickies, and fold lines are annotations</strong> describing navigation and intent. Never render them as UI.',
  '<strong>Visual detail is deliberately unspecified; screens and states are not.</strong> A screen or state missing from this board has not been specified — ask, do not invent. Where this board and the project\'s frontend conventions disagree about structure or components, the project\'s conventions win.',
  '<strong>This board carries no emoji.</strong> An icon\'s place is left as an empty square, and anywhere a meaning is needed it is written as a word. What the icon looks like is the product\'s design system to decide.',
];

/**
 * The board header, and the reading contract — returned apart because they sit apart.
 *
 * <p>**The header goes on top and the contract goes at the foot of the board.** The contract is
 * read once, before implementing, and then never again; at the top it stands between every
 * later reader and the frames they came for, on a board hundreds of frames long. At the foot it
 * is still in the artifact, still complete, and still the first thing a table of contents can
 * point at — it simply stops being a toll on every visit.
 *
 * <p>The PDF does not carry it at all (`renderPdf({ hideReadme })`): implementing is done from
 * the HTML board, and the PDF is the copy that gets read, sent, and printed.
 *
 * @param config the board's settings — `boardName`, `headline`, `tag`, `logo`
 * @param patternItems `<li>` elements the pattern contributes, as one HTML string
 * @param boardItems `<li>` elements the board contributes
 * @param hasPairs whether any frame is half of a narrow/wide pair. The viewport toggle is drawn
 *   only then: a control that changes nothing reads as a broken one
 * @param split the axis this board's output is written along, or null. A split board's contract
 *   gains one standing item, on every file including the entry page: a reader who was handed one
 *   file has to be told the others exist, and that item is the only thing in the artifact that
 *   tells them. It is a STANDING item rather than one the board contributes, because the thing
 *   it explains is the kit's doing
 * @returns `{ header, readme }`
 */
export function renderIntro({ config, patternItems = '', boardItems = '', hasPairs = false, split = null }) {
  const text = textFor(config.boardLang);
  // No toggle in `stacked` mode: both members of every pair are on the page, so there is nothing
  // to switch and a control that switches nothing is worse than no control.
  const toggle = hasPairs && (config.viewportPairs ?? 'narrow-first') !== 'stacked'
    ? `\n  <label class="view-toggle" for="viewport"><span class="opt-narrow">${text.narrow}</span>`
      + `<span class="opt-wide">${text.wide}</span></label>`
    : '';
  // The day every frame stands on, said where a reader meets it. `config.today` already existed
  // and every dated frame was drawn against it; it was simply invisible, so a reader working out
  // what 「30일 남음」 counts from had to open the config. **It is the board's declared basis and
  // never the build's clock** — a board rebuilt on Tuesday is not a board redrawn on Tuesday, and a
  // stamp that moved every build would say the opposite of what it appears to.
  const dateline = config.today ? `<span class="dateline">${text.asOf(config.today)}</span>` : '';
  // Two rows: the board's name alone on the first, and everything that is ABOUT the board —
  // what kind of drawing it is, the viewport toggle, the way to the reading contract — on the
  // second. On one line the title competed with four controls and read as the first of five
  // labels rather than as the name of the thing.
  const header = `<header class="board-header">
  <div class="bh-main">
    <h1>${config.headline ?? config.boardName}</h1>
    <div class="bh-meta">
      <span class="tag">${config.tag ?? 'WIREFRAME · LO-FI'}</span>${toggle}${dateline}
    </div>
  </div>
  ${config.logoData ? `<img class="board-logo" src="${config.logoData}" alt="">` : ''}
</header>`;
  // `id="readme"` so anything that wants to send somebody here has an anchor to name, even
  // though the header no longer carries a link of its own.
  // Written from the split rather than from a board's own words: what a reader needs here is the
  // number of files, their names and where the index is, and all three are facts about the
  // arrangement the kit produced.
  const splitItem = split
    ? [`<strong>This board is delivered as ${split.files.length} files, and they are one board.</strong> `
      + 'The row at the top of every file moves between them, and the entry page '
      + `(<code>${split.entry.file}</code>) carries the index of every frame on the board and the `
      + 'map at the front. Each file still renders on its own with no external resource; what one '
      + 'file alone is not is the whole board, so a frame named in a note may live in another of '
      + 'them and a link that crosses is written <code>&lt;file&gt;#&lt;anchor&gt;</code>.']
    : [];
  const readme = `<section class="readme" id="readme">
  <h2>HOW TO READ THIS BOARD — REQUIRED BEFORE IMPLEMENTING</h2>
  <ol>
${[...STANDING, ...splitItem].map((li) => `    <li>${li}</li>`).join('\n')}
${patternItems.trim()}
${boardItems.trim()}
  </ol>
</section>`;
  return { header, readme };
}
