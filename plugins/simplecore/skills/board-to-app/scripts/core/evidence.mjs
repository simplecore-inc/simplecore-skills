// What a closed chapter leaves behind: one run record per chapter, written by `journeyCommand`,
// and the captures the record shows, in a folder of the same name beside it.
//
// A chapter closes because its journeys pass, and nothing behind that claim outlives the session
// unless something writes it down. The run record is that: one row per journey with its persona,
// its test and its result, and one capture per screen-state a journey visited. **Nothing in it is
// written by hand** - the command writes it, and a record fitted to the pictures records a run that
// did not happen.
//
// These gates hold the record against the chapter file - every journey the chapter names has a
// passing row, every frame it places has a capture - and hold each capture to what its own bytes
// say: the window it was taken through, the scheme, whether anything is drawn on it, and that no
// two captures of one chapter are the same picture.
//
// **The words are the project's and the shapes are the skill's.** Which word a ledger writes for a
// closed chapter is declared and read through `ctx`. What is fixed here is what a project does not
// get to vary without the checks becoming unreadable: one image format, one capture-name grammar,
// and one floor under how much of a canvas a capture covers. A second format would mean a second
// reader for every name; the day a project genuinely needs one, it becomes a schema key rather
// than a second regex.
import { execFileSync } from 'node:child_process';

import { proseLines, tableCells } from './prose.mjs';

/** The only image format a run record shows. */
const CAPTURE_SUFFIX = '.webp';

/**
 * The bytes per megapixel below which a capture holds no more than an empty canvas.
 *
 * <p><b>A blank capture is consistent with everything except the file.</b> The taker read the
 * screen, the screen was right, and what landed on disk is a white rectangle - nothing in the run
 * disagrees with anything else, and the sentence written beside it reads correctly. Only the bytes
 * know: a screenshot of text and borders does not compress, and an empty one has nothing to
 * compress.
 *
 * <p><b>The measure is bytes against the canvas, because bytes alone measure the window and the
 * encoder as much as the screen.</b> Two things vary that nobody declares. Encoding quality moves
 * the same pixels by a third - one sign-in frame runs 5,048 bytes at q40 and 7,848 at q95 - and
 * the canvas moves them by the area, so a blank shot at a device pixel ratio of two costs four
 * times a blank shot at one. Against an absolute count both read as a fuller screen, and the
 * second passes a blank 2880×1800 capture outright at 9,320 bytes.
 *
 * <p><b>Density is flat across both, which is what makes it the right measure.</b> An empty canvas
 * costs a near-fixed number of bytes per macroblock, so it lands at 1,800 to 2,000 bytes per
 * megapixel at every quality and every canvas - 2,394 bytes at q95 and 2,398 at q40 for the same
 * white 1440×900, 1,798 per megapixel for the same page at twice the ratio, 2,017 on a phone
 * canvas. The sparsest legitimate screen sits well above: a sign-in form on a plain ground, about
 * as little as a real screen ever draws, measures 3,895 at q40 and 6,056 at q95, and the console
 * screens beside it 4,660 and 5,452 at that same floor quality. This number is the geometric
 * middle of that gap - 39% above the highest blank reading and 28% under the lowest real one - so
 * a project encoding anywhere in the usual range has room on both sides, and re-encoding a
 * picture larger buys nothing.
 */
const CAPTURE_FLOOR_PER_MPX = 2800;


/**
 * A capture's file name: the frame it shows, and - where the frame draws a content tab strip -
 * which pane of that strip, or which of the states navigation cannot reach.
 *
 * <p><b>The name is the bound.</b> `a-17.webp` is the frame as the board draws it, with the pane
 * the strip marks open; `a-17-t3.webp` is that frame's third pane. A frame therefore holds exactly
 * as many images as the board draws panes for it, and a frame with no strip holds one - so the
 * repository ceiling stays a number read off the board rather than a number that grows with how
 * thorough somebody felt.
 *
 * <p>Which panes a given frame owes needs the board, and nothing here reads one: a project gate
 * that does asks that question, and these gates know only the grammar.
 *
 * <p><b>The frame id carries its state letter, and it belongs to the id rather than to the
 * variant.</b> A board drawn with `simplecore:wireframe-boards` gives every state of a screen its
 * own frame and its own permanent id - `n-02a` is the overview pane, `n-02k` the one with no
 * vendor profile - so a pattern that stopped at the digits read `n-02a.webp` as no capture name at
 * all. That is the quiet direction: a record showing that capture shows no photograph of the frame
 * to the gate counting them, and a folder of such captures holds no frame to the gate asking
 * whether a record was written. The letter goes inside the second group so a caller composing
 * `${g1}-${g2}` still gets the whole id.
 */
export const CAPTURE_NAME = /^([a-z])-(\d{2,}[a-z]?)(?:-t\d+|-empty|-error)?\.webp$/;

/**
 * The heading a chapter file writes for each frame it places: `## <n>. <frame id> <title>`.
 *
 * <p><b>The trailing letter is part of the id, not a suffix on it.</b> A board drawn with
 * `simplecore:wireframe-boards` gives every state of a screen its own frame and its own permanent
 * id - `N-02a` is the overview tab and `N-02k` the one with no vendor profile - so a pattern
 * stopping at the digits reads `N-02` out of `N-02k` and then fails the boundary that follows it.
 * What that costs is silence: the chapter places a frame, the check reads no frame placed, and the
 * gate that would have asked for a capture of it reports the same nothing as a chapter with no
 * screens. It is bounded rather than open - one lowercase letter, and `N-02abc` matches nothing.
 */
const BASE_HEADING = /^## \d+\. ([A-Z]-\d{2,}[a-z]?)(?: |$)/;

/** `![alt](target)`, with an optional quoted title after the target. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)<>\s]+)>?(?:\s+"[^"]*")?\s*\)/g;

/**
 * The names a CHAPTER folder's own index takes.
 *
 * <p>**`00-` is deliberately not one of them.** A project is free to number its first chapter 00 -
 * a foundation chapter that places no frames is exactly the thing a project numbers 00 - and
 * reserving that prefix on this side does not fail, it goes silent: the chapter is read as the
 * folder's index, its journeys are counted by nobody, its run record is opened by nobody, and
 * every gate over it reports the same zero as a chapter with nothing wrong. One project ran that
 * way with its only closed chapter invisible to every evidence gate while `check` printed green
 * over it.
 */
const CHAPTER_INDEX_NAME = /^(_|README)/i;

/**
 * A file in the chapter folder that is a chapter rather than the folder's own index.
 *
 * <p>Read by shape, exactly as `ledgerGate` reads it: a markdown file directly in the folder, and
 * its chapter is the first segment of its name. A project naming chapters `w01-…` gets `W01` and
 * one naming them `stage-1-…` gets `STAGE`, which is why the two readers have to agree - a chapter
 * the ledger names and these gates do not is a chapter nothing holds.
 */
function chapterOf(file) {
  if (!file.endsWith('.md') || file.includes('/')) return null;
  if (CHAPTER_INDEX_NAME.test(file)) return null;
  return file.replace(/\.md$/, '').split('-')[0].toUpperCase();
}

/** Every chapter the chapter folder holds, by the id its file name carries. */
function chapterFiles(ctx) {
  const out = new Map();
  // The chapter folder's own index is not a chapter, and `00-` cannot say so on this side - a
  // project is free to number its first chapter 00. What settles it is that the project DECLARED
  // that file as its chapter overview, so it is excluded by identity rather than by its name.
  // Without this, a project whose index is `00-overview.md` grows a chapter called `00`, and the
  // evidence folder's own index - conventionally the same name - becomes that chapter's run record
  // and is held to journeys the index never names.
  const overview = ctx.at('chapterOverview');
  const indexName = overview ? String(overview).split('/').pop() : null;
  for (const file of [...(ctx.list(ctx.at('chapterDir')) ?? [])].sort()) {
    if (indexName && file === indexName) continue;
    const chapter = chapterOf(file);
    if (chapter) out.set(chapter, file);
  }
  return out;
}

/**
 * The chapters the state ledger records as closed.
 *
 * <p>A row whose first cell is a chapter this folder holds and one of whose later cells is the
 * project's word for closed. The word is declared; without it nothing is closed, every gate here
 * goes quiet, and `doctor` says which key is why - which is the whole point of grading that key
 * `closing`.
 *
 * <p>**Which column carries the state is the project's, not this reader's.** A ledger that writes
 * the chapter's name beside its number, or what is left to do beside its state, is an ordinary
 * shape and a legible one - and a reader anchored on the second cell does not fail on it, it goes
 * silent, which is the state every gate downstream inherits. The comparison is against a whole
 * cell, so a row whose prose happens to contain the word is not read as a closed chapter.
 */
function closedChapters(ctx) {
  return closedRows(ctx).onEvidence;
}

/**
 * The chapters the ledger records as closed, split by what closed them.
 *
 * <p><b>A person can close a chapter, and that is a different fact from a chapter closing on its
 * evidence.</b> Whoever owns the product may decide a chapter is done - the screens are good
 * enough, the round has cost more than it is worth, the work has moved on - and the build has no
 * standing to refuse that. What it does have is a duty not to let the two look alike afterwards: a
 * chapter closed by decision has no verification behind it, and every check that reads a closed
 * chapter's evidence would otherwise report its absence as a defect, which teaches whoever meets
 * that report to disable the check.
 *
 * <p>So the ledger writes a different word, `decidedStatus`, and the evidence checks skip those
 * chapters while the ledger goes on saying plainly which kind each one was. **Undeclared, no
 * chapter is read as decided**, and every closed row is read as closed on its evidence.
 *
 * @param ctx the project
 * @returns `onEvidence` - closed with verification behind it - and `onDecision`
 */
function closedRows(ctx) {
  const onEvidence = new Set();
  const onDecision = new Set();
  const word = ctx.declared('closedStatus');
  const decided = ctx.declared('decidedStatus');
  const text = ctx.read(ctx.at('stateLedger'));
  if (word === null || text === null) return { onEvidence, onDecision };
  const known = new Set(chapterFiles(ctx).keys());
  for (const { line } of proseLines(text)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 2) continue;
    const chapter = cells[0].toUpperCase();
    if (!known.has(chapter)) continue;
    const rest = cells.slice(1);
    // Decision first: a project may write its decided word as the closed word plus a mark, and
    // reading the closed word out of it would put the chapter in both sets.
    if (decided !== null && rest.includes(decided)) onDecision.add(chapter);
    else if (rest.includes(word)) onEvidence.add(chapter);
  }
  return { onEvidence, onDecision };
}

/** The frames one chapter places - the `## <n>. <frame id>` headings its file writes. */
function framesPlaced(ctx, rel) {
  const placed = new Set();
  const text = ctx.read(rel);
  if (text === null) return placed;
  for (const { line } of proseLines(text)) {
    const heading = BASE_HEADING.exec(line);
    if (heading) placed.add(heading[1]);
  }
  return placed;
}

/**
 * The frames one run record shows, as the ids its images are named after.
 *
 * <p>Where in the record the image sits is not this reader's business - a frame is shown once per
 * record, anywhere in it. A pane capture counts as a photograph of its frame: the question is
 * whether a journey ever opened the screen, and it did.
 */
function capturedFrames(text, stem) {
  const shown = new Set();
  for (const { line } of proseLines(text)) {
    for (const [, target] of line.matchAll(MARKDOWN_IMAGE)) {
      if (!target.startsWith(`${stem}/`)) continue;
      const named = CAPTURE_NAME.exec(target.slice(`${stem}/`.length));
      if (named) shown.add(`${named[1].toUpperCase()}-${named[2]}`);
    }
  }
  return shown;
}

/**
 * Which frame each frame is drawn on top of, as the board's own source records it.
 *
 * <p>A board draws a state, a dialog or a companion pane-set by importing the frame it sits on -
 * `import base, { head } from './b-02-site-detail.mjs'` - and that import is the only place the
 * relationship is written down. It is the same kind of board knowledge this file already carries
 * in `CAPTURE_NAME`, which spells a pane as `<frame>-t<pane>`.
 *
 * <p><b>Why an evidence gate needs it.</b> A companion frame has no screen of its own: opening it
 * navigates to its base's address and draws its base's panes. So the picture that proves it is the
 * base's, and a gate holding out for a file bearing the companion's own id is asking for either a
 * byte-for-byte copy of a sibling or a second shot of the same pane. One project filed exactly
 * that copy, and it read in the folder like a second observation.
 */
function drawnOn(ctx) {
  // Its own pattern rather than `BASE_HEADING`'s: board sources name a frame in lower case, and
  // a file name carries no heading around the id.
  const STEM = /^([a-z]-\d{2,})(?:-[a-z0-9-]+)?$/;
  const declared = ctx.declared('boardRoot');
  const base = new Map();
  for (const entry of ctx.list(ctx.at('boardRoot')) ?? []) {
    if (!entry.endsWith('.mjs')) continue;
    const stem = STEM.exec(entry.slice(entry.lastIndexOf('/') + 1, -'.mjs'.length));
    if (!stem) continue;
    const source = ctx.read(`${declared}/${entry}`);
    const from = source && /^import\s+base\b[^;]*?from\s+'\.\/([a-z]-\d{2,}[a-z0-9-]*)\.mjs'/m.exec(source);
    if (!from) continue;
    const parent = STEM.exec(from[1]);
    if (parent) base.set(stem[1].toUpperCase(), parent[1].toUpperCase());
  }
  return base;
}

/**
 * The frames whose module declares no address of its own - no `route` and no `url`.
 *
 * <p>A frame with no address and no base is a shared pattern: a list shape or a confirm dialog
 * drawn inside other screens, which no journey can open on its own and no picture is owed for.
 * A frame with no address that is drawn on a base is a state of that base, and its base's
 * picture stands for it. A frame whose module cannot be read is taken to have an address, so a
 * fixture with no board files still asks for every frame it places.
 */
function unaddressed(ctx) {
  const STEM = /^([a-z]-\d{2,})(?:-[a-z0-9-]+)?$/;
  const declared = ctx.declared('boardRoot');
  const out = new Set();
  for (const entry of ctx.list(ctx.at('boardRoot')) ?? []) {
    if (!entry.endsWith('.mjs')) continue;
    const stem = STEM.exec(entry.slice(entry.lastIndexOf('/') + 1, -'.mjs'.length));
    if (!stem) continue;
    const source = ctx.read(`${declared}/${entry}`);
    if (source === null) continue;
    if (!/(?:^|[\s{,])(?:route|url)\s*:/m.test(source)) out.add(stem[1].toUpperCase());
  }
  return out;
}

/** Every frame a capture of this one also stands for - itself, what it is drawn on, and so on up. */
function upFrom(id, base) {
  const chain = [id];
  const seen = new Set(chain);
  for (let at = base.get(id); at && !seen.has(at); at = base.get(at)) {
    chain.push(at);
    seen.add(at);
  }
  return chain;
}

/** The name a retired reader's error carries, so a run stopped by one says which kind of stop it was. */
export const RETIRED_READER = 'RetiredReaderError';

/**
 * A reader `ctx.evidence` no longer serves, called by a project gate.
 *
 * <p>Both read a run-record shape no declared key describes - sections carrying three labels, and
 * frames under a section a persona line proves - so on every project they could only return an
 * empty list, and a gate reading an empty list reports the same nothing as a project with nothing
 * wrong. Throwing is what stops that: `check` ends on the message, by the reader's name, with the
 * reader that answers the question now.
 */
export class RetiredReaderError extends Error {
  constructor(reader, replacement) {
    super(
      `${RETIRED_READER}: ctx.evidence.${reader} is retired. ${replacement} `
      + '- a project gate calling it read an empty list on every project, which reports the same '
      + 'nothing as a project with nothing wrong'
    );
    this.name = RETIRED_READER;
  }
}

/** What answers each retired reader's question now, as the error states it. */
const RETIRED_READERS = {
  sections:
    'A run record is the table `journeyCommand` writes, one row per journey - read it with '
    + '`ctx.evidence.runRows(text)`, and the captures it shows by the `ctx.evidence.captureName` grammar',
  demandedFrames:
    'Every frame a chapter places is owed a capture - read them with `ctx.evidence.framesPlaced(rel)`',
};

/**
 * What a project's own gates read out of the evidence folder, bound to one repository.
 *
 * <p>A project keeps gates of its own over the same documents - whether the frame a capture shows
 * can be reached again, whether every pane the board draws was photographed - and those gates
 * cannot import this file: the skill is installed somewhere different on every machine. So the
 * readers arrive on `ctx`, one definition, and a project gate never writes a second copy that
 * drifts from this one.
 *
 * <p>`demandedFrames` and `sections` are retired and throw `RetiredReaderError` with the reader
 * that replaced each; the other readers read the chapter files, the ledger, the record and the
 * folder as they are.
 */
export function evidenceReaders(ctx) {
  return {
    dir: ctx.declared('evidenceDir'),
    captureName: CAPTURE_NAME,
    captureSuffix: CAPTURE_SUFFIX,
    chapterOf,
    chapterFiles: () => chapterFiles(ctx),
    closedChapters: () => closedChapters(ctx),
    framesPlaced: (rel) => framesPlaced(ctx, rel),
    runRows,
    demandedFrames: () => {
      throw new RetiredReaderError('demandedFrames', RETIRED_READERS.demandedFrames);
    },
    sections: () => {
      throw new RetiredReaderError('sections', RETIRED_READERS.sections);
    },
  };
}


// ── Captures with no run record beside them ─────────────────────────────────
//
// **`closedChapterHasAJourneyRun` reads a chapter's status, so nothing else watches a chapter that
// is still open.** A journey test writes its captures into the chapter's folder as it runs, and
// `journeyCommand` writes the record beside them when the run ends - so a folder of captures with
// no record is a run whose record was never written: the tests were run by something other than
// the command, or the command stopped before the end. Every other check here asks about a record
// that exists, so this is the one place that state is seen.
//
// **The answer is always the command, never a hand-written record.** A record written to match
// the pictures records a run that did not happen, which is the one thing the record exists to
// rule out.
//
// A warning rather than an error: a run in progress holds exactly this state until it ends, and
// the gate cannot tell the two apart.

export const evidenceKeepsPaceWithItsCaptures = {
  id: 'evidenceKeepsPaceWithItsCaptures',
  title: 'captures in a chapter\'s folder with no run record beside them, so the journey command did not write one',
  grade: 'warning',
  needs: ['chapterDir', 'evidenceDir'],
  run: (ctx) => {
    const dir_ = ctx.declared('evidenceDir');
    const chapters = chapterFiles(ctx);
    if (!chapters.size) return [];
    const findings = [];
    for (const [chapter, file] of [...chapters].sort()) {
      // A chapter whose record exists is `closedChapterHasAJourneyRun`'s from here on.
      if (ctx.read(`${dir_}/${file}`) !== null) continue;
      const stem = file.slice(0, -'.md'.length);
      const frames = new Set();
      for (const image of ctx.list(ctx.inRoot(`${dir_}/${stem}`)) ?? []) {
        const shot = CAPTURE_NAME.exec(image.split('/').pop() ?? '');
        if (shot) frames.add(`${shot[1].toUpperCase()}-${shot[2]}`);
      }
      if (!frames.size) continue;
      findings.push(
        `${dir_}/${stem}/: ${chapter} has captures of ${frames.size === 1 ? 'one frame' : `${frames.size} frames`} `
        + `(${[...frames].sort().join(' · ')}) and ${dir_}/${file} does not exist. The journey tests `
        + 'ran and nothing wrote the record they belong to - they were run by something other than '
        + '`journeyCommand`, or it stopped before the end. Run `journeyCommand` for the chapter: the '
        + 'record is its output and is never written by hand, because a record fitted to the '
        + 'pictures records a run that did not happen'
      );
    }
    return findings;
  },
};

// ── The screen that was built and never opened ──────────────────────────────
//
// A chapter can pass every check a machine has - typecheck, lint, the frontend audit, the language
// audit, every endpoint probed against a running server - and still hand over screens that render
// the application shell and nothing inside it. Every request answers 200, no console error is
// raised, and the route measures the length of the shell exactly. None of those checks opens a
// browser, so none of them can tell a built screen apart from an empty one.
//
// A journey opens the browser, and the capture it takes is what is left of that. So a closed
// chapter's run record shows a capture of every frame the chapter places: a frame shown nowhere in
// the record was opened by no journey, whatever else came out green.
//
// **What this gate deliberately does not catch.** A capture of the right frame showing an empty
// shell passes it. Whether the picture shows the frame it is named after is a reading for eyes,
// and no script here judges it. This gate proves a journey opened the frame; it never proves the
// screen works, and reading it as that proof puts the defect above straight back.
//
// **A frame with no address of its own is outside this.** A shared pattern - drawn inside other
// screens and opened by no journey on its own - owes no picture under its name, and a frame drawn
// on top of another is covered by its base's picture. The board's sources say which frames those
// are, so this needs no list of letters.
//
// It judges only a chapter the ledger records as closed. A chapter being built takes its captures
// over hours, so judging an open one would hold the tree red for the whole of it; and a closed
// chapter with no record at all is `closedChapterHasAJourneyRun`'s finding, named once rather than
// once per frame.

export const everyPlacedFrameIsCaptured = {
  id: 'everyPlacedFrameIsCaptured',
  title: 'a closed chapter whose run record shows no capture of a frame it placed, so no journey opened that screen',
  needs: ['chapterDir', 'stateLedger', 'evidenceDir', 'closedStatus', 'boardRoot'],
  run: (ctx) => {
    const dir_ = ctx.declared('evidenceDir');
    const closed = closedChapters(ctx);
    if (!closed.size) return [];

    const dir = ctx.declared('chapterDir');
    const closedWord = ctx.declared('closedStatus');
    const base = drawnOn(ctx);
    const pattern = unaddressed(ctx);
    const findings = [];
    for (const [chapter, file] of [...chapterFiles(ctx)].sort()) {
      if (!closed.has(chapter)) continue;
      const rel = `${dir_}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      const stem = file.slice(0, -'.md'.length);
      const shown = capturedFrames(text, stem);

      for (const id of [...framesPlaced(ctx, `${dir}/${file}`)].sort()) {
        // A frame the board draws on top of another has no screen of its own - opening it lands on
        // the base's address and draws the base's panes - so the base's picture is its picture.
        if (upFrom(id, base).some((at) => shown.has(at))) continue;
        // A frame with no address and no base is drawn inside other screens; the journey that
        // opens the screen it lives in is the one that sees it, and no picture is owed under its name.
        if (pattern.has(id) && !base.has(id)) continue;
        findings.push(
          `${rel}: ${chapter} is ${closedWord} and shows no ${stem}/${id.toLowerCase()}${CAPTURE_SUFFIX} — `
          + `${dir}/${file} places ${id}, and a frame no journey photographed is a screen nobody `
          + 'opened — the answer is a journey that reaches it, never a picture taken outside one'
        );
      }
    }
    return findings;
  },
};

// ── A check that ran, and this installation cannot decide ───────────────────
//
// **The third outcome, and it is neither of the two everybody plans for.** A verification line is
// run rather than reasoned about - that is the whole rule - and sometimes running it answers
// 「not here」: the boundary the line proves is not enforced by THIS installation, and no amount of
// running it again will change that. A database whose application connects as a superuser cannot
// demonstrate row ownership; a deployment with no second factor cannot demonstrate a challenge; a
// single-tenant install cannot demonstrate a tenant boundary.
//
// **It is not 「did not happen」 and it is not 「passed」.** Recorded as the first, it reads as work
// somebody skipped and the chapter cannot close over it. Recorded as the second, the product
// carries a boundary nobody has ever seen hold - which is exactly the class of defect the whole
// evidence arrangement exists to stop.
//
// **It is a debt, and a debt names its creditor.** The run record carries one line, the project's
// `deferredLine`, naming **the chapter that will be able to decide it** - the chapter that installs
// the role, the second factor, the second tenant. The chapter that met the wall CLOSES: its work
// was done and the answer it got is the honest one. **The named chapter is the one that cannot
// close** while the line stands, and settling it is part of that chapter's own run: once the named
// chapter has installed what the check needs, the earlier chapter's journeys are run again, and the
// record that run writes carries what was seen in place of the line.
//
// **Why this needs two checks rather than a habit.** The line is written when the wall is hit, and
// read - if anyone reads it - by whoever closes a chapter three weeks later. Nothing connects those
// two moments but the name in the line, and a name nobody checks is a name that goes stale the
// first time a chapter is renumbered.

export const deferredCheckNamesAChapter = {
  id: 'deferredCheckNamesAChapter',
  title: 'a check deferred to a chapter that does not exist, or to the chapter that deferred it',
  needs: ['chapterDir', 'evidenceDir', 'deferredLine'],
  run: (ctx) => {
    const reader = ctx.lines.deferred;
    if (!reader) return [];
    const dir_ = ctx.declared('evidenceDir');
    const chapters = chapterFiles(ctx);
    const known = new Set(chapters.keys());
    const findings = [];

    for (const [chapter, file] of [...chapters].sort()) {
      const rel = `${dir_}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      for (const { line, no } of proseLines(text)) {
        const said = reader.exec(line);
        if (!said) continue;
        const owed = said[1].trim().toUpperCase();
        if (owed === chapter) {
          findings.push(
            `${rel}:${no}: this check is deferred to ${chapter}, which is the chapter that deferred `
            + 'it — a debt naming itself is a chapter that can never close and a check nobody will '
            + 'ever run. Name the chapter that will be ABLE to decide it: the one that installs the '
            + 'role, the second factor, the second tenant'
          );
          continue;
        }
        if (!known.has(owed)) {
          findings.push(
            `${rel}:${no}: this check is deferred to 「${said[1].trim()}」, which is no chapter `
            + `${ctx.declared('chapterDir')} holds. The name is the only thing connecting whoever `
            + 'hit the wall to whoever closes that chapter later, so a name nothing resolves is a '
            + 'check that will never be run and will never be reported as missing'
          );
        }
      }
    }
    return findings;
  },
};

export const chapterOwedACheckDoesNotClose = {
  id: 'chapterOwedACheckDoesNotClose',
  title: 'a chapter recorded as closed while an earlier chapter still defers a check to it',
  needs: ['chapterDir', 'evidenceDir', 'deferredLine', 'closedStatus', 'stateLedger'],
  run: (ctx) => {
    const reader = ctx.lines.deferred;
    if (!reader) return [];
    const dir_ = ctx.declared('evidenceDir');
    const closed = closedChapters(ctx);
    if (!closed.size) return [];
    const word = ctx.declared('closedStatus');

    const findings = [];
    for (const [chapter, file] of [...chapterFiles(ctx)].sort()) {
      const rel = `${dir_}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      for (const { line, no } of proseLines(text)) {
        const said = reader.exec(line);
        if (!said) continue;
        const owed = said[1].trim().toUpperCase();
        if (owed === chapter || !closed.has(owed)) continue;
        findings.push(
          `${rel}:${no}: ${chapter} deferred a check to ${owed}, and ${owed} reads 「${word}」 in `
          + `${ctx.declared('stateLedger')} with the line still standing. Either the check can be `
          + `decided now - run ${chapter}'s journeys again, so its record carries what was seen in `
          + `place of this line - or it cannot, and ${owed} is not closed. A debt that survives its `
          + 'own due date is a boundary the product claims and nobody has ever watched hold'
        );
      }
    }
    return findings;
  },
};

// ── The window the picture was taken through ────────────────────────────────
//
// A capture carries no record of the window it was shot in, and that is the whole difficulty: a
// run whose browser came back at 1280 where the board measures at 1440 writes files of a plausible
// size, transcribes the page correctly, and reports nothing - while a tree's first data row, four
// of nine table rows and an entire panel form sit below the fold in none of the pictures. The
// judging that follows spends its findings on 「no capture covers this」, one per screen, and the
// run has to be taken again from the start.
//
// **The one fact that does survive is inside the file.** A WebP header states the canvas it was
// encoded from, so the width a run actually used is readable afterwards even though nobody wrote
// it down. That is what this gate reads, and it is the only half of the standard that leaves a
// trace: the colour scheme does not, which is why the eyes table carries it instead.

/**
 * The pixel canvas a WebP states in its own header, or null when the bytes do not say.
 *
 * <p>Three encodings and all three appear in practice - `VP8 ` from a plain lossy encode, `VP8L`
 * from a lossless one, `VP8X` the moment alpha or metadata is present - so a reader that knew only
 * the first would go quiet on whichever half of a project's captures carried transparency.
 */
function webpCanvas(buf) {
  if (!buf || buf.length < 30) return null;
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('latin1', 12, 16);
  if (fourcc === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (fourcc === 'VP8X') {
    return {
      width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
      height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
    };
  }
  return null;
}

/**
 * What a file's first bytes say it actually is, where that is not the one format.
 *
 * <p>Named rather than merely refused, because the commonest way a capture becomes unmeasurable is
 * a driver's own screenshot filed under the capture name without being encoded: nine files in one
 * project's evidence folder opened as PNG under a `.webp` name, passing every check that reads
 * only a name and telling the gates that open a byte nothing at all. 「Not a WebP」 sends the
 * reader looking for corruption; 「this is a PNG」 says what to run.
 */
function looksLike(buf) {
  if (!buf || buf.length < 12) return null;
  const head = buf.toString('latin1', 0, 12);
  if (head.startsWith('\x89PNG\r\n\x1a\n')) return 'PNG';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'JPEG';
  if (head.startsWith('GIF8')) return 'GIF';
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'SVG';
  return null;
}

/** Every declared standard, whether the project declared one or several. */
function standardsOf(ctx) {
  const declared = ctx.declared('captureStandard');
  if (!declared) return [];
  return (Array.isArray(declared) ? declared : [declared]).filter(
    (entry) => entry && typeof entry === 'object' && Number.isInteger(entry.width) && entry.width > 0
  );
}

/**
 * Every capture on disk was taken at a width the project declared.
 *
 * <p>A whole multiple of a declared width passes, because a run at a device pixel ratio of two
 * writes a file twice as wide from a window that was exactly right - the CSS pixels are the
 * standard and the file records the device ones.
 *
 * <p><b>「I could not tell」 is a finding rather than a silence.</b> A capture whose header does not
 * parse is one this gate has said nothing about, and a gate that goes quiet on what it could not
 * read is indistinguishable from one that read everything and found it sound - which is the exact
 * shape of the failure it exists to end.
 */
export const everyCaptureIsAtADeclaredWidth = {
  id: 'everyCaptureIsAtADeclaredWidth',
  title: 'a capture taken through a window nobody declared',
  needs: ['evidenceDir', 'captureStandard'],
  run: (ctx) => {
    const widths = [...new Set(standardsOf(ctx).map((entry) => entry.width))].sort((a, b) => a - b);
    if (!widths.length) return [];
    const dir_ = ctx.declared('evidenceDir');
    const named = widths.join(' or ');

    const findings = [];
    for (const entry of ctx.list(ctx.at('evidenceDir')) ?? []) {
      if (!entry.endsWith(CAPTURE_SUFFIX)) continue;
      const rel = `${dir_}/${entry}`;
      const head = ctx.bytes(ctx.inRoot(rel), 64);
      const canvas = webpCanvas(head);
      if (canvas === null) {
        const really = looksLike(head);
        findings.push(
          `${rel}: ${really ? `the bytes open as ${really}, under a ${CAPTURE_SUFFIX} name` : `the bytes do not open as ${CAPTURE_SUFFIX}`}`
          + ' - so nothing here says what window this was shot through, and every check that reads '
          + `only a capture's name passes it. ${really ? 'Encode it' : 'Take it again'} through the `
          + 'declared driver'
        );
        continue;
      }
      if (widths.some((w) => canvas.width % w === 0)) continue;
      findings.push(
        `${rel}: ${canvas.width}×${canvas.height}, and the declared standard is ${named} wide. `
        + 'A narrow window puts whatever the board draws below its fold into no picture at all, '
        + 'and the run that took it reports nothing — so this is re-taken rather than judged. '
        + `Where the board genuinely draws this frame at ${canvas.width}, that width belongs in `
        + 'captureStandard beside the others'
      );
    }
    return findings;
  },
};

// ── The other half of the standard ─────────────────────────────────────────
//
// **The header records the window and says nothing about the scheme, so this one reads the
// pixels.** That is a real cost - a decoder has to run - and it buys the half of `captureStandard`
// that was declared, described in the config as the thing that goes wrong, and held by nobody: six
// captures in one project were taken in dark mode where the board measures in light, and the run
// reported nothing. Two more reached a chapter's evidence folder five days after the console they
// showed had changed, and every gate over that folder stayed green.
//
// **A scheme is not recoverable from a picture with certainty, and it does not have to be.** What
// separates the two cases in an application UI is the whole range: one console's captures measure
// 12–14 in dark and 248 in light. The band below is set far wider than that gap on both sides, so
// what fires is a screen shot in the wrong scheme rather than a screen with a lot of dark content
// in it - and a frame that genuinely sits between the two says nothing, which is the right answer
// for a picture whose scheme its own pixels do not settle.

/** Where a capture stops being merely dark-ish and starts contradicting a declared scheme. */
const LIGHT_FLOOR = 96;
const DARK_CEILING = 160;

/** Rec. 601 luma, averaged over a decode small enough that the cost is the process rather than the pixels. */
function captureLuma(path) {
  const ppm = execFileSync('dwebp', ['-quiet', '-scale', '8', '8', '-ppm', path, '-o', '-'], {
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 1 << 20,
  });
  const head = ppm.subarray(0, 32).toString('latin1');
  const at = head.indexOf('255\n');
  if (!head.startsWith('P6') || at < 0) return null;
  const px = ppm.subarray(at + 4);
  if (px.length < 3) return null;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 2 < px.length; i += 3, n += 1) {
    sum += (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  }
  return n ? Math.round(sum / n) : null;
}

/**
 * Every capture on disk is in the colour scheme the project declared.
 *
 * <p><b>It judges only where the project said one thing.</b> Standards that name different schemes,
 * or a scheme of `no-preference`, leave nothing to hold against - a board that is genuinely drawn
 * both ways has declared exactly that, and a gate that picked one of them would redden on frames
 * that are right.
 *
 * <p><b>A decoder it cannot run is a finding rather than a silence.</b> `dwebp` ships beside the
 * `cwebp` that wrote these files, so its absence means the captures were encoded somewhere this
 * check has never run - and a gate that goes quiet there is indistinguishable from one that read
 * every picture and found them sound.
 *
 * <p><b>Why it is a warning.</b> A rule written after captures already exist finds a backlog, and
 * the backlog belongs to whichever chapters took those pictures rather than to the chapter that
 * happens to be closing. Reddening the tree would hold that chapter hostage to somebody else's
 * debt. **It is promoted to `error` in the change that drives the count to zero** - which arrives
 * on its own, because an open chapter re-takes its captures when it runs.
 */
export const everyCaptureIsInTheDeclaredScheme = {
  id: 'everyCaptureIsInTheDeclaredScheme',
  title: 'a capture shot in a colour scheme the project did not declare',
  grade: 'warning',
  needs: ['evidenceDir', 'captureStandard'],
  run: (ctx) => {
    const schemes = [...new Set(standardsOf(ctx).map((entry) => entry.colorScheme))];
    if (schemes.length !== 1) return [];
    const want = schemes[0];
    if (want !== 'light' && want !== 'dark') return [];

    const dir_ = ctx.declared('evidenceDir');
    const shots = (ctx.list(ctx.at('evidenceDir')) ?? []).filter((e) => e.endsWith(CAPTURE_SUFFIX));
    if (!shots.length) return [];

    const findings = [];
    for (const entry of shots) {
      const rel = `${dir_}/${entry}`;
      let luma;
      try {
        luma = captureLuma(ctx.inRoot(rel));
      } catch (error) {
        return [
          `${dir_}: the colour scheme of ${shots.length} capture${shots.length === 1 ? '' : 's'} `
          + `could not be read — \`dwebp\` did not run (${error.code ?? error.message}). It ships `
          + 'beside the `cwebp` that encodes these files, so this run cannot tell a folder shot in '
          + `the declared ${want} scheme from one shot in the other, and says so rather than passing`,
        ];
      }
      if (luma === null) continue; // the width gate already speaks about bytes that will not open
      if (want === 'light' && luma >= LIGHT_FLOOR) continue;
      if (want === 'dark' && luma <= DARK_CEILING) continue;
      findings.push(
        `${rel}: mean luma ${luma}, and the declared scheme is ${want}. A capture in the other `
        + 'scheme cannot be held against its siblings or against the board, and it reads as a '
        + 'correct run — the name parses, the width is right and the transcription beside it is '
        + 'complete. Re-take it with the console in the declared scheme'
      );
    }
    return findings;
  },
};

// ── The picture with nothing on it ─────────────────────────────────────────
//
// A shot taken before the page painted is the one defect in an evidence folder that agrees with
// every other artifact in the run: the taker read the screen and read it correctly, the sentence
// beside the picture describes what was there, the name parses, the width is right, and the file
// is a white rectangle. Nothing disagrees with anything, which is why only the bytes can raise it.
//
// **What it raises is 「open this one」, and that is a warning rather than an error.** The reading
// it points at - is the screen in this picture built, or is it the shell - is one this skill has
// already given to a person by name, and the byte count neither takes that reading nor stands in
// for it. What it does is narrow the pile that reading starts from. A rule that is right to fire
// and wrong to fail on is what the warning grade is for, and failing here has a specific cost
// beyond the usual one: the only way to green a correct picture that lands under the number is to
// re-encode it larger, which is a change to the file that silences the check for the next capture
// that really is blank.
//
// **The grade sits on the gate, so the floor is a gate of its own.** A gate answers one question,
// and this one answers 「go and look」 rather than 「this is wrong」. Folded into a gate whose findings
// are defects, two kinds of finding would share one id, and no case could be written that pinned
// either.

/**
 * Every capture holds more than an empty canvas of its size would.
 *
 * <p><b>The unit is bytes per megapixel rather than bytes</b>, because the window and the encoder
 * are both free variables that no project declares and an absolute count measures all three at
 * once → `CAPTURE_FLOOR_PER_MPX`.
 *
 * <p><b>What it does not claim.</b> A capture of a built shell with nothing inside it passes here
 * and always will - a shell draws a header, a sidebar and their text, and that is a picture with
 * something on it. Whether the screen in the picture is built is the coordinator's reading before
 * the ledger row is written, and the eyes table in `references/checks-and-eyes.md` names it.
 *
 * <p><b>The shape that answers 「the picture is right」 is a long one.</b> A full-page capture whose
 * lower two thirds are legitimately empty dilutes exactly the way a blank one does, and only
 * somebody opening it can part those - which is the same reason the grade is a warning rather than
 * a reason to widen the number until nothing fires.
 *
 * <p><b>「I could not measure it」 is a finding rather than a silence.</b> A file whose header will
 * not open is one this has said nothing about, and a gate that goes quiet on what it could not
 * read is indistinguishable from one that read everything and found it sound.
 * `everyCaptureIsAtADeclaredWidth` speaks about that same file from the other side and as a
 * defect, naming what the bytes really are; this one speaks where the project declared no
 * `captureStandard` and that gate does not run at all.
 */
/**
 * Two captures under two names that are byte-for-byte the same picture.
 *
 * <p>A board draws every state of a screen as its own frame, so a chapter's folder holds the base and
 * each state beside it. When the run opens a state by its address and the screen does not enter that
 * state - the flag it reads was never set, the action that produces it was never taken - what comes
 * back is the base screen, shot and filed under the state's name.
 *
 * <p><b>Nothing else in this file can see it.</b> The size is right, the density is fine, the name
 * matches a frame the chapter places, the file is on disk and the record shows it. Every check
 * passes because each picture is examined alone, and the defect exists only BETWEEN two of them.
 * One real chapter shipped a base screen under 「등록 키트 생성 완료」 that way, and it was noticed
 * because two byte counts happened to print identically - which is not a way of noticing anything.
 *
 * <p>Identical bytes are never legitimate. Two frames drawing the same screen still differ somewhere
 * - a marked tab, an open dialog, a banner - or the board would not draw them twice; and a state a
 * frame draws over a base that is genuinely indistinguishable is a frame the board should not have.
 */
export const noTwoCapturesAreTheSamePicture = {
  id: 'noTwoCapturesAreTheSamePicture',
  title: 'two captures of two frames that are byte-for-byte the same picture, so one state never reached the screen',
  needs: ['evidenceDir'],
  run: (ctx) => {
    const dir_ = ctx.declared('evidenceDir');
    const findings = [];
    const byFolder = new Map();
    for (const entry of ctx.list(ctx.at('evidenceDir')) ?? []) {
      if (!entry.endsWith(CAPTURE_SUFFIX)) continue;
      const cut = entry.lastIndexOf('/');
      const folder = cut < 0 ? '' : entry.slice(0, cut);
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(entry);
    }
    for (const [folder, entries] of [...byFolder].sort()) {
      const seen = new Map();
      for (const entry of entries.sort()) {
        const bytes = ctx.bytes(ctx.inRoot(`${dir_}/${entry}`));
        if (!bytes || !bytes.length) continue;
        const key = `${bytes.length}:${Buffer.from(bytes).toString('base64')}`;
        if (!seen.has(key)) {
          seen.set(key, entry);
          continue;
        }
        findings.push(
          `${dir_}/${entry} is byte-for-byte ${dir_}/${seen.get(key)} — two frames, one picture, so the `
          + 'state the second one exists to show never reached the screen and the run shot the base '
          + 'again under its name. Everything else about it is right, which is why nothing else here '
          + 'reports it: the size, the density, the name and the citation all hold. Open the frame, '
          + 'find what puts the screen into that state, and take the capture from there'
        );
      }
    }
    return findings;
  },
};

export const everyCaptureIsDenserThanAnEmptyCanvas = {
  id: 'everyCaptureIsDenserThanAnEmptyCanvas',
  title: 'a capture holding no more than an empty canvas of its size, so very likely a shot taken before the page painted',
  needs: ['evidenceDir'],
  grade: 'warning',
  run: (ctx) => {
    const dir_ = ctx.declared('evidenceDir');
    const findings = [];
    for (const entry of ctx.list(ctx.at('evidenceDir')) ?? []) {
      if (!entry.endsWith(CAPTURE_SUFFIX)) continue;
      const rel = `${dir_}/${entry}`;
      const path = ctx.inRoot(rel);
      const bytes = ctx.size(path);
      const canvas = webpCanvas(ctx.bytes(path, 64));
      if (bytes === null || canvas === null) {
        findings.push(
          `${rel}: nothing here says what canvas this was encoded from, so how much of it holds `
          + 'anything went unmeasured - and a capture nobody measured passes every check that reads '
          + 'only its name'
        );
        continue;
      }
      const density = Math.round(bytes / ((canvas.width * canvas.height) / 1e6));
      if (density >= CAPTURE_FLOOR_PER_MPX) continue;
      findings.push(
        `${rel}: ${density} bytes per megapixel over ${canvas.width}×${canvas.height}, under the `
        + `${CAPTURE_FLOOR_PER_MPX} a screen with anything drawn on it reaches — an empty canvas `
        + 'costs about 1,900 at any quality. Open it: a shot taken before the page painted is a '
        + 'white rectangle with a correct-looking sentence beside it, and is taken again. Two '
        + 'pictures land here and are right — an empty LIST, which still draws the shell, the '
        + 'header and the empty-state wording, and a long full-page capture whose lower half is '
        + 'genuinely empty — and both are answered by saying so. Re-encoding at a higher quality '
        + 'answers none of the three: quality moves a real screen and leaves a blank one where it '
        + 'is, so a larger file only hides the next capture that really is blank'
      );
    }
    return findings;
  },
};

/**
 * The heading a chapter file writes for each journey: `### <n>. <persona> - <title>`.
 *
 * <p>The separator is a spaced hyphen or a spaced em dash. Either is read, so a chapter written to a
 * prose standard that bans the dash is read as surely as one written before it; and a persona's own
 * hyphen (`site-manager`) is never taken for the separator, because the separator has a space on
 * each side.
 */
const JOURNEY_HEADING = /^###\s+(\d+)\.\s+(.+?)\s+[-\u2014]\s+/;

/** The journeys a chapter names, in order. */
function journeysOf(text) {
  const out = [];
  for (const { line } of proseLines(text)) {
    const m = JOURNEY_HEADING.exec(line);
    if (m) out.push({ n: m[1], persona: m[2].trim() });
  }
  return out;
}

/** The rows of a run record's table: journey number, persona, test, result and what follows it. */
const RUN_ROW = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|[^|]*\|\s*(pass|fail|skipped)\b\s*([^|]*)\|/;
export function runRows(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = RUN_ROW.exec(line);
    if (m) out.push({ n: m[1], persona: m[2].trim(), result: m[3], note: m[4].trim() });
  }
  return out;
}

/**
 * A closed chapter's run record covers every journey the chapter names, and every one passes.
 *
 * <p><b>The record is what `journeyCommand` wrote, and the chapter file is what the generator
 * wrote; this gate holds the two together.</b> A journey with no row was never run; a row reading
 * `fail` is a chapter that did not close; a row reading `skipped` names, after the word, the parked
 * line that releases it, and a skip naming nothing is a fail. Rows are matched to journeys by
 * number AND persona, so a record whose journeys were renumbered reports rather than passes.
 */
export const closedChapterHasAJourneyRun = {
  id: 'closedChapterHasAJourneyRun',
  title: 'a closed chapter with no run record, or one whose journeys are not all passing in it',
  needs: ['chapterDir', 'stateLedger', 'evidenceDir', 'closedStatus'],
  run: (ctx) => {
    const closed = closedChapters(ctx);
    if (!closed.size) return [];
    const dir_ = ctx.declared('evidenceDir');
    const dir = ctx.declared('chapterDir');
    const closedWord = ctx.declared('closedStatus');
    const findings = [];
    for (const [chapter, file] of [...chapterFiles(ctx)].sort()) {
      if (!closed.has(chapter)) continue;
      const rel = `${dir_}/${file}`;
      const record = ctx.read(rel);
      if (record === null) {
        findings.push(
          `${rel}: ${chapter} reads 「${closedWord}」 in ${ctx.declared('stateLedger')} and left no run record — `
          + 'the verdict rests on a claim that died with the session that made it'
        );
        continue;
      }
      const rows = runRows(record);
      for (const { n, persona } of journeysOf(ctx.read(`${dir}/${file}`) ?? '')) {
        const row = rows.find((r) => r.n === n && r.persona === persona);
        if (!row) {
          findings.push(`${rel}: journey ${n} (${persona}) of ${dir}/${file} has no row in the run record — it was never run`);
          continue;
        }
        if (row.result === 'pass' || (row.result === 'skipped' && row.note)) continue;
        findings.push(
          `${rel}: journey ${n} (${persona}) reads 「${row.result}」 — a chapter closes on every journey passing, `
          + 'and a skip names the parked line that releases it'
        );
      }
    }
    return findings;
  },
};

/**
 * A closed chapter that places frames names at least one journey the parser reads.
 *
 * <p><b>`closedChapterHasAJourneyRun` holds the record against the journeys it reads, so a chapter
 * whose journeys it cannot read is held against nothing.</b> A journey written as a bullet, under a
 * heading of another depth, or with no separator after the persona is a journey to a person and
 * none to the parser: the record's rows are matched to an empty list and every one passes. A
 * foundation chapter places no frames and closes on verifications instead, so it is not asked.
 *
 * <p><b>A warning</b>, because the chapter may genuinely have been closed on journeys a person
 * read, and what the finding asks for is a re-read of its headings against
 * `### <n>. <persona> - <title>` rather than a refusal of the close.
 */
export const closedChapterNamesAJourney = {
  id: 'closedChapterNamesAJourney',
  title: 'a closed chapter that places frames and names no journey the parser reads',
  needs: ['chapterDir', 'stateLedger', 'closedStatus'],
  grade: 'warning',
  run: (ctx) => {
    const closed = closedChapters(ctx);
    if (!closed.size) return [];
    const dir = ctx.declared('chapterDir');
    const findings = [];
    for (const [chapter, file] of [...chapterFiles(ctx)].sort()) {
      if (!closed.has(chapter)) continue;
      const rel = `${dir}/${file}`;
      const placed = framesPlaced(ctx, rel);
      if (!placed.size) continue;
      if (journeysOf(ctx.read(rel) ?? '').length) continue;
      findings.push(
        `${rel}: ${chapter} is closed, places ${[...placed].sort().join(' · ')}, and names no journey `
        + 'the parser reads - `closedChapterHasAJourneyRun` then holds its run record against nothing. '
        + 'Head each journey `### <n>. <persona> - <title>`, and regenerate the chapter where the '
        + 'generator wrote another shape'
      );
    }
    return findings;
  },
};

/**
 * A journey test drives the running application, never the frame route.
 *
 * <p>The frame route renders one frame in one state, so a control whose destination is another
 * screen has nowhere to go there: it is pressed, the page does what a frame route does, and the
 * frame that was already open is what the test then asserts on. Nothing errors, which is why this
 * is a gate rather than something a run notices. It reads the tests for the frame route's address
 * up to its placeholder; where the journey route contains that address the two cannot be told
 * apart and the gate stays quiet.
 */
export const journeyTestsDriveTheApplication = {
  id: 'journeyTestsDriveTheApplication',
  title: 'a journey test that opens the frame route, where a control whose destination is another screen has nowhere to go',
  needs: ['journeyTestsDir', 'captureRoute'],
  run: (ctx) => {
    const route = String(ctx.declared('captureRoute') ?? '');
    const stem = route.includes('<') ? route.slice(0, route.indexOf('<')) : route;
    // A frame route that is not an address - a test's name on a desktop product - renders nothing a
    // journey could be driven at, so there is nothing to read the tests for.
    if (!stem.trim() || !/^(?:https?:\/\/|\/)/.test(stem.trim())) return [];
    const journey = ctx.declared('journeyRoute');
    if (journey && String(journey).includes(stem)) return [];
    const dir = ctx.declared('journeyTestsDir');
    const findings = [];
    for (const file of [...(ctx.list(ctx.at('journeyTestsDir')) ?? [])].sort()) {
      const rel = `${dir}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      const at = text.split('\n').findIndex((line) => line.includes(stem));
      if (at < 0) continue;
      findings.push(
        `${rel}:${at + 1}: opens 「${stem}…」, which renders one frame in one state. A journey walks between `
        + 'screens, and a control pressed at a frame address has nowhere to go — drive the application at '
        + `${journey ? `「${journey}」` : 'its own address (`journeyRoute`)'} instead`
      );
    }
    return findings;
  },
};

export const EVIDENCE_GATES = [
  closedChapterHasAJourneyRun,
  closedChapterNamesAJourney,
  evidenceKeepsPaceWithItsCaptures,
  everyPlacedFrameIsCaptured,
  journeyTestsDriveTheApplication,
  deferredCheckNamesAChapter,
  chapterOwedACheckDoesNotClose,
  everyCaptureIsAtADeclaredWidth,
  everyCaptureIsInTheDeclaredScheme,
  everyCaptureIsDenserThanAnEmptyCanvas,
  noTwoCapturesAreTheSamePicture,
];

// ── The cases that prove them ───────────────────────────────────────────────
//
// **The words below are one project's and the shapes are the skill's.** Every Korean string here
// arrives through `WORDS` or stands for a project's own documents, never for this file's knowledge -
// so a case written in another language would exercise exactly the same code. What the cases pin
// down is the shape: a run record's rows against the chapter's journeys, a capture shown for every
// frame a closed chapter places, and what a capture's own bytes say.

/** One project's vocabulary, declared as a project declares it. */
const WORDS = {
  evidenceDir: 'docs/evidence',
  closedStatus: '닫힘',
};

/**
 * A foundation chapter, and a screen chapter placing a sign-in frame and a shared pattern - a frame
 * drawn inside other screens, with no address of its own, for which `everyPlacedFrameIsCaptured`
 * owes no picture.
 */
const CHAPTER_TEXT = {
  'chapters/w01-foundation.md':
    '# W01. 개발 기반\n\n## 1. 모노레포와 빌드\n\n'
    + '**개발** — 앱 셋을 한 저장소에 둔다.\n'
    + '**판정** — 한 명령으로 빌드가 끝난다.\n',
  'chapters/w02-org-shell.md':
    '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
    + '**개발** — 보드의 `a-01-login`을 그대로 만든다.\n'
    + '**테스트 · 시스템 관리자** — 로그인 화면을 연다.\n'
    + '**테스트 · 안전관리자** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n\n'
    + '## 2. P-01 공용 목록 패턴\n\n'
    + '**개발** — 보드의 `p-01-list-pattern`을 그대로 만든다.\n',
};

/** The same screen chapter with its one line that opens the screen taken away. */
const CHAPTER_REFUSED_ONLY = CHAPTER_TEXT['chapters/w02-org-shell.md'].replace(
  '**테스트 · 시스템 관리자** — 로그인 화면을 연다.\n',
  ''
);

/** The state ledger, with each of those two chapters in the state given. */
const LEDGER = (w01, w02) => `# 챕터 상태\n\n| 챕터 | 상태 |\n| --- | --- |\n| W01 | ${w01} |\n| W02 | ${w02} |\n`;

/**
 * The one capture the screen chapter's record shows.
 *
 * <p>It is on disk under a name that parses, and it states no canvas, so it is not a fixture for
 * anything that opens a picture: the gates that do are proved against `webpOf`, whose bytes are the
 * real header layout.
 */
const CAPTURE = (body = `RIFF····WEBP${'\0'.repeat(9 * 1024)}`) => ({ 'docs/evidence/w02-org-shell/a-01.webp': body });

/**
 * A capture whose header really does state the canvas given, at the byte length given.
 *
 * <p><b>The bytes are the real layout rather than a stand-in</b>, because the thing under test is
 * a reader of those bytes: a fixture that agreed with the reader by construction would pass
 * whatever the reader did with an actual file. `lossy` writes the `VP8 ` header a plain encode
 * produces, and the `VP8X` form is what appears the moment alpha or metadata is present - both
 * are met in a real evidence folder, and a reader that knew one would go silent on the other.
 */
function webpOf(width, height, { form = 'lossy', bytes = 9 * 1024 } = {}) {
  const buf = Buffer.alloc(Math.max(bytes, 32), 0);
  buf.write('RIFF', 0, 'latin1');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WEBP', 8, 'latin1');
  if (form === 'lossy') {
    buf.write('VP8 ', 12, 'latin1');
    buf.writeUInt32LE(buf.length - 20, 16);
    buf[23] = 0x9d; buf[24] = 0x01; buf[25] = 0x2a;
    buf.writeUInt16LE(width, 26);
    buf.writeUInt16LE(height, 28);
    return buf;
  }
  buf.write('VP8X', 12, 'latin1');
  buf.writeUInt32LE(10, 16);
  buf[24] = (width - 1) & 0xff; buf[25] = ((width - 1) >> 8) & 0xff; buf[26] = ((width - 1) >> 16) & 0xff;
  buf[27] = (height - 1) & 0xff; buf[28] = ((height - 1) >> 8) & 0xff; buf[29] = ((height - 1) >> 16) & 0xff;
  return buf;
}

/** The standard the width cases are judged against: one desktop width, and a tablet beside it. */
const STANDARD = [
  { width: 1440, height: 1200, colorScheme: 'light' },
  { width: 768, height: 1024, colorScheme: 'light' },
];

/** A foundation section: no frame to capture, so it carries the command and what came back. */
const W01_EVIDENCE =
  '# W01. 개발 기반 — 검증 결과\n\n## 1. 모노레포와 빌드 · 판정\n\n'
  + '**한 일** — 빈 저장소를 받아 한 명령으로 빌드한다.\n'
  + '**챕터가 정한 것** — 한 명령으로 빌드가 끝난다.\n'
  + '**본 것** — 앱 셋이 모두 빌드된다.\n\n'
  + '```\n$ pnpm build\n3 apps built\n```\n\n';

/** A screen section, shown as the capture of the frame it names. */
const W02_SCREEN_SECTION =
  '## 1. A-01 로그인 · 시스템 관리자\n\n'
  + '**한 일** — 로그인 화면을 열고 틀린 비밀번호로 로그인한다.\n'
  + '**챕터가 정한 것** — 실패 문구에 무엇이 틀렸는지 표시하지 않는다.\n'
  + '**본 것** — 「아이디 또는 비밀번호가 올바르지 않습니다」만 표시된다.\n\n'
  + '![A-01 로그인](w02-org-shell/a-01.webp)\n\n';

/** A scope section, shown as the address called and the answer the server gave. */
const W02_SCOPE_SECTION =
  '## 1. A-01 로그인 · 안전관리자\n\n'
  + '**한 일** — 범위 밖 사업장의 주소를 직접 부른다.\n'
  + '**챕터가 정한 것** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n'
  + '**본 것** — 서버가 403으로 답한다.\n\n'
  + '```\nGET /api/sites/9 → 403 SCOPE_DENIED\n```\n\n';

/**
 * The same screen section proved by an endpoint probe instead of by a picture. Something was run
 * and nothing was photographed, which is the defect this is a fixture of: the server answered and
 * nobody opened a browser.
 */
const W02_PROBE_SECTION =
  '## 1. A-01 로그인 · 시스템 관리자\n\n'
  + '**한 일** — 로그인 주소를 부르고 응답을 확인한다.\n'
  + '**챕터가 정한 것** — 실패 문구에 무엇이 틀렸는지 표시하지 않는다.\n'
  + '**본 것** — 서버가 200으로 답한다.\n\n'
  + '```\nPOST /auth/login → 200\n```\n\n';

/** One record, made of the sections given - the gates over it read its images and its lines. */
const W02_EVIDENCE = (...sections) => `# W02. 조직·계정 — 검증 결과\n\n${sections.join('')}`;

export function cases(t) {
  // The shared pattern the chapter places has a module with no address and no base, which is
  // what makes it a pattern rather than a screen nobody photographed.
  const PATTERN_MODULE = { 'board/p-01-list-pattern.mjs': "import { list } from '../chrome.mjs';\nexport default { title: '공용 목록 패턴' };\n" };
  const evidence = (files) =>
    t.project({ config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md', boardRoot: 'board' }, files: { ...CHAPTER_TEXT, ...PATTERN_MODULE, ...files } });

  // ── closedChapterHasAJourneyRun ───────────────────────────────────────────
  const JOURNEY_CHAPTER = '# W02. 조직\n\n## 1. A-01 조직 목록\n\n**구조** — `/orgs` · 목록 · 빈 상태\n\n'
    + '## 여정\n\n### 1. 담당자 — 조직 등록\n\n1. `/orgs`를 연다\n\n### 2. 관리자 — 다른 조직 거부\n\n1. 다른 조직의 주소에 접근한다 — 서버가 거부한다\n';
  const RECORD = (first, second) => '# W02 — 여정 실행\n\n| journey | persona | test | result |\n| --- | --- | --- | --- |\n'
    + `| 1 | 담당자 | journeys/w02.spec.ts › 조직 등록 | ${first} |\n| 2 | 관리자 | journeys/w02.spec.ts › 거부 | ${second} |\n\n`
    + '![A-01](w02-org-shell/a-01.webp)\n';
  const run = (files) => t.project({
    config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md' },
    files: { 'chapters/00-overview.md': '# 챕터\n', 'chapters/w02-org-shell.md': JOURNEY_CHAPTER, 'tracking/STATE.md': LEDGER('열림', '닫힘'), ...files },
  });
  t.add('closedChapterHasAJourneyRun', 'a closed chapter that left no run record', run({}), true);
  t.add('closedChapterHasAJourneyRun', 'a run record with a failing journey', run({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'fail') }), true);
  t.add('closedChapterHasAJourneyRun', 'a run record missing one of the chapter\'s journeys', run({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'pass').replace(/\| 2 \|.*\n/, '') }), true);
  t.add('closedChapterHasAJourneyRun', 'a skipped journey naming nothing that releases it', run({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'skipped') }), true);
  t.add('closedChapterHasAJourneyRun', 'a run record with every journey passing', run({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'pass') }), false);
  t.add('closedChapterHasAJourneyRun', 'a skipped journey naming the parked line that releases it', run({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'skipped — OPEN-ITEMS: A-01 거부 경로는 W04가 만든다') }), false);
  t.add('closedChapterHasAJourneyRun', 'an open chapter with no run record', run({ 'tracking/STATE.md': LEDGER('열림', '열림') }), false);
  // A chapter written to a prose standard that bans the em dash heads its journeys with a spaced
  // hyphen. Read only with the dash, such a chapter names no journey, and a record missing one of
  // them passes.
  const HYPHENED_CHAPTER = JOURNEY_CHAPTER.replace(/^(###\s+\d+\.\s+\S+)\s+\u2014\s+/gm, '$1 - ');
  const hyphened = (files) => run({ 'chapters/w02-org-shell.md': HYPHENED_CHAPTER, ...files });
  t.add('closedChapterHasAJourneyRun', 'a record missing a journey whose heading takes a spaced hyphen', hyphened({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'pass').replace(/\| 2 \|.*\n/, '') }), true);
  t.add('closedChapterHasAJourneyRun', 'journeys headed with a spaced hyphen, every one passing in the record', hyphened({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'pass') }), false);

  // ── closedChapterNamesAJourney ─────────────────────────────────────────────
  // Journeys written as bullets read as journeys to a person and as none to the parser, so the
  // record is held against an empty list and every row passes.
  const BULLETED_CHAPTER = JOURNEY_CHAPTER.replace(/^###\s+\d+\.\s+(\S+)\s+\u2014\s+(.+)$/gm, '- $1: $2');
  t.add('closedChapterNamesAJourney', 'a closed chapter placing a frame whose journeys are bullets', run({ 'chapters/w02-org-shell.md': BULLETED_CHAPTER, 'docs/evidence/w02-org-shell.md': RECORD('pass', 'pass') }), true);
  t.add('closedChapterNamesAJourney', 'a closed chapter placing a frame with its journeys headed as the parser reads them', run({ 'docs/evidence/w02-org-shell.md': RECORD('pass', 'pass') }), false);
  t.add('closedChapterNamesAJourney', 'an open chapter whose journeys are bullets', run({ 'chapters/w02-org-shell.md': BULLETED_CHAPTER, 'tracking/STATE.md': LEDGER('열림', '열림') }), false);
  t.add(
    'closedChapterNamesAJourney',
    'a closed foundation chapter that places no frames and names no journey',
    run({ 'chapters/w02-org-shell.md': '# W02. 기반\n\n## 1. 인증 골격\n\n**판정** - 만료된 토큰은 거부된다.\n' }),
    false,
  );

  // ── journeyTestsDriveTheApplication ───────────────────────────────────────
  const tests = (body) => t.project({
    config: { ...WORDS, chapterDir: 'chapters', journeyTestsDir: 'tests/journeys', captureRoute: 'http://localhost:1420/?frame=<id>', journeyRoute: 'http://localhost:1420/' },
    files: { 'chapters/00-overview.md': '# 챕터\n', 'tests/journeys/w02.spec.ts': body },
  });
  t.add('journeyTestsDriveTheApplication', 'a journey test that opens the frame route', tests("await page.goto('http://localhost:1420/?frame=a-01');\nawait page.click('text=등록');\n"), true);
  t.add('journeyTestsDriveTheApplication', 'a journey test that opens the application', tests("await page.goto('http://localhost:1420/');\nawait page.click('text=조직');\n"), false);
  t.add('journeyTestsDriveTheApplication', 'a frame route that is a test name rather than an address, named by a journey test',
    t.project({ config: { ...WORDS, chapterDir: 'chapters', journeyTestsDir: 'tests/journeys', captureRoute: 'FrameCaptureTest' }, files: { 'chapters/00-overview.md': '# 챕터\n', 'tests/journeys/w02.spec.kt': 'class SettingsJourneyTest : FrameCaptureTest()\n' } }), false);

  // A board that gives every state of a screen its own frame writes ids with a state letter on
  // them, which is what `simplecore:wireframe-boards` draws. A pattern stopping at the digits reads
  // no frame out of such a heading, and this gate then demands nothing - the same silence as a
  // chapter with no screens.
  t.add(
    'everyPlacedFrameIsCaptured',
    'a chapter placing a state-lettered frame whose capture is missing',
    t.project({
      config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md', boardRoot: 'board/src' },
      files: {
        'board/src/manifest.mjs': 'export default [];\n',
        'chapters/00-overview.md': '# 챕터\n',
        'chapters/w03-devices.md':
          '# W03. 장치\n\n## 1. N-02k 장치 상세 · 벤더 · 프로파일 없음\n\n'
          + '**테스트 · 담당자** 프로파일이 없는 장치를 열면 그렇다고 표시한다.\n',
        'tracking/STATE.md': '| 챕터 | 상태 |\n| --- | --- |\n| W03 | 닫힘 |\n',
        'docs/evidence/w03-devices.md':
          '# W03 — 검증 결과\n\n## 1. N-02k 장치 상세 · 벤더 · 프로파일 없음 · 담당자\n\n'
          + '**한 일** — 프로파일이 없는 장치를 열었다.\n'
          + '**챕터가 정한 것** — 프로파일이 없는 장치를 열면 그렇다고 표시한다.\n'
          + '**본 것** — 「프로파일 없음」이 보였다.\n\n',
      },
    }),
    true
  );

  t.add(
    'everyPlacedFrameIsCaptured',
    'a closed chapter whose screen is proved by an endpoint probe and photographed nowhere',
    evidence({
      'tracking/STATE.md': LEDGER('닫힘', '닫힘'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_PROBE_SECTION, W02_SCOPE_SECTION),
    }),
    true
  );
  t.add(
    'everyPlacedFrameIsCaptured',
    'a closed chapter whose one line is a scope boundary, so nobody was ever told to open the screen',
    evidence({
      'chapters/w02-org-shell.md': CHAPTER_REFUSED_ONLY,
      'tracking/STATE.md': LEDGER('닫힘', '닫힘'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCOPE_SECTION),
    }),
    true
  );
  t.add(
    'everyPlacedFrameIsCaptured',
    'a chapter still being walked, with one frame photographed and the rest not',
    evidence({
      'tracking/STATE.md': LEDGER('닫힘', '진행'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_PROBE_SECTION, W02_SCOPE_SECTION),
    }),
    false
  );

  // A companion frame - the panes a base's strip names and its own frame does not draw. Opening it
  // lands on the base's address and draws the base's panes, so the base's picture is its picture.
  // Holding out for a file under its own id buys a byte-for-byte copy of a sibling; one project
  // filed exactly that, and in the folder it read like a second observation.
  // Every frame is a section of its own; a companion's section says where it is drawn.
  const COMPANION_CHAPTER =
    '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
    + '**개발** — 보드의 `a-01-login`을 그대로 만든다.\n'
    + '**테스트 · 시스템 관리자** — 로그인 화면을 연다. 딸린 칸까지 연다.\n\n'
    + '## 2. A-02 로그인 — 탭\n\n'
    + '**개발** — 보드의 `a-02-login-tabs`를 그대로 만든다.\n';
  const DERIVED = { 'board/a-02-login-tabs.mjs': "import base, { head } from './a-01-login.mjs';\n" };
  // A screen of its own has an address of its own, which is what separates it from a pattern.
  const OWN_SCREEN = { 'board/a-02-login-tabs.mjs': "import { console_ } from '../chrome.mjs';\nexport default { route: '/login/tabs' };\n" };
  const onBoard = (files) =>
    t.project({
      config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md', boardRoot: 'board' },
      files: { ...CHAPTER_TEXT, ...files },
    });
  const companion = (files) =>
    onBoard({
      'chapters/w02-org-shell.md': COMPANION_CHAPTER,
      'tracking/STATE.md': LEDGER('닫힘', '닫힘'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION),
      ...files,
    });

  t.add(
    'everyPlacedFrameIsCaptured',
    'a companion frame whose base is photographed',
    companion(DERIVED),
    false,
  );
  // The board says this one is a screen in its own right, so nobody has opened it.
  t.add(
    'everyPlacedFrameIsCaptured',
    'a frame of its own that the document never photographs',
    companion(OWN_SCREEN),
    true,
  );
  t.add(
    'everyPlacedFrameIsCaptured',
    'a companion frame whose base is not photographed either',
    onBoard({
      'chapters/w02-org-shell.md': COMPANION_CHAPTER,
      'tracking/STATE.md': LEDGER('닫힘', '닫힘'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCOPE_SECTION),
      ...DERIVED,
    }),
    true,
  );
  // A dialog drawn on a companion, which is drawn on the base. The chain is walked to the top -
  // stopping at one step would redden the second storey of a board that stacks them.
  t.add(
    'everyPlacedFrameIsCaptured',
    'a frame two storeys above the one that was photographed',
    companion({
      'chapters/w02-org-shell.md': COMPANION_CHAPTER.replace('— A-02.', '— A-03.'),
      ...DERIVED,
      'board/a-03-login-dialog.mjs': "import base from './a-02-login-tabs.mjs';\n",
    }),
    false,
  );
  t.add(
    'everyPlacedFrameIsCaptured',
    'both closed, the screen photographed and the shared pattern nobody is sent to left alone',
    evidence({
      'tracking/STATE.md': LEDGER('닫힘', '닫힘'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION, W02_SCOPE_SECTION),
      ...CAPTURE(),
    }),
    false
  );


  // ── A check that ran and this installation cannot decide ──────────────────
  const deferring = (owed) => W02_SCOPE_SECTION.replace(
    '**본 것** — 서버가 403으로 답한다.',
    '**본 것** — 애플리케이션이 슈퍼유저로 붙어 있어 시험 일곱이 xfail로 끝났다.\n'
    + `**판정 불가 — 막는 챕터 ${owed}**`,
  );
  const deferred = (owed, ledger = LEDGER('닫힘', '닫힘')) => t.project({
    config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md', deferredLine: '**판정 불가 — 막는 챕터 {text}**…' },
    files: {
      ...CHAPTER_TEXT,
      'tracking/STATE.md': ledger,
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION, deferring(owed)),
      ...CAPTURE(),
    },
  });

  t.add(
    'deferredCheckNamesAChapter',
    'a check deferred to a chapter that does not exist',
    deferred('W09'),
    true,
  );
  t.add(
    'deferredCheckNamesAChapter',
    'a check deferred to the chapter that deferred it',
    deferred('W02'),
    true,
  );
  t.add(
    'deferredCheckNamesAChapter',
    'a check deferred to the chapter that will be able to decide it',
    deferred('W01'),
    false,
  );
  t.add(
    'chapterOwedACheckDoesNotClose',
    'the chapter that owes the check recorded as closed with the line still standing',
    deferred('W01'),
    true,
  );
  t.add(
    'chapterOwedACheckDoesNotClose',
    'the same debt while the chapter that owes it is still open',
    deferred('W01', LEDGER('진행', '닫힘')),
    false,
  );


  // everyCaptureIsAtADeclaredWidth - the one half of the capture standard a file still remembers.
  const shot = (files, standard = STANDARD) =>
    t.project({ config: { ...WORDS, captureStandard: standard }, files });

  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'the window came back at the browser default and the run said nothing',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(1280, 633) }),
    true,
  );
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'the same frame shot at the declared width',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(1440, 1200) }),
    false,
  );
  // A run at a device pixel ratio of two writes a file twice as wide out of a window that was
  // exactly right. Reddening it would push a project into shooting at one ratio to satisfy a gate.
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'the declared width at a device pixel ratio of two',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(2880, 2400) }),
    false,
  );
  // The board draws some frames at another device width, and the project says so rather than
  // having the gate redden on frames that are exactly right.
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'a tablet frame at the second declared width',
    shot({ 'docs/evidence/w02-org-shell/a-08.webp': webpOf(768, 1024) }),
    false,
  );
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'that same tablet width with only the desktop standard declared',
    shot({ 'docs/evidence/w02-org-shell/a-08.webp': webpOf(768, 1024) }, STANDARD[0]),
    true,
  );
  // Alpha or metadata moves the canvas into a `VP8X` chunk. A reader that knew only the plain
  // lossy header would report every such capture as unmeasurable - or, worse, measure none of them.
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'a capture carrying alpha, whose canvas sits in the extended chunk',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(1440, 1200, { form: 'extended' }) }),
    false,
  );

  // everyCaptureIsInTheDeclaredScheme - the half no header carries, so these fixtures are real
  // encoded pixels rather than a hand-built header. A synthetic one would decode to nothing and
  // the gate would go quiet on every case, which is the state it exists to end.
  const DARK_SHOT = Buffer.from('UklGRhoAAABXRUJQVlA4TA4AAAAvB8ABAAcQEf0PRET/Aw==', 'base64');
  const LIGHT_SHOT = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAfQ//73v/+BiOh/AAA=', 'base64');
  const DARK_STANDARD = [{ width: 1440, height: 1200, colorScheme: 'dark' }];

  t.add(
    'everyCaptureIsInTheDeclaredScheme',
    'the console came back in dark mode and every other gate over the folder stayed green',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': DARK_SHOT }),
    true,
  );

  t.add(
    'everyCaptureIsInTheDeclaredScheme',
    'the same frame re-taken in the declared scheme',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': LIGHT_SHOT }),
    false,
  );
  // The mirror. A gate that had 「light」 written into it rather than read from the config would
  // pass this, and a project whose board is drawn dark would be held to somebody else's scheme.
  t.add(
    'everyCaptureIsInTheDeclaredScheme',
    'a light capture where the project declared dark',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': LIGHT_SHOT }, DARK_STANDARD),
    true,
  );
  // Two standards that name different schemes is a board genuinely drawn both ways. Picking one
  // of them would redden frames that are exactly right, so there is nothing here to hold against.
  t.add(
    'everyCaptureIsInTheDeclaredScheme',
    'a dark capture where the project declared both schemes',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': DARK_SHOT }, [
      { width: 1440, height: 1200, colorScheme: 'light' },
      { width: 768, height: 1024, colorScheme: 'dark' },
    ]),
    false,
  );
  t.add(
    'everyCaptureIsInTheDeclaredScheme',
    'a dark capture where the project declared no preference',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': DARK_SHOT }, [
      { width: 1440, height: 1200, colorScheme: 'no-preference' },
    ]),
    false,
  );
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'the same extended form at a width nobody declared',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(1280, 633, { form: 'extended' }) }),
    true,
  );
  // 「I could not tell」 is the finding this gate would otherwise hide behind. A file it cannot
  // measure has had nothing said about it, and silence there reads as a capture found sound.
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'a capture whose bytes do not open as an image at all',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': `RIFF····WEBP${'\0'.repeat(9 * 1024)}` }),
    true,
  );
  // The driver's own screenshot, filed under the capture name without ever being encoded. It
  // passes the name check and the ceiling, because neither of those opens a byte.
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'a PNG wearing the capture suffix',
    shot({
      'docs/evidence/w02-org-shell/a-01.webp': Buffer.concat([
        Buffer.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR', 'latin1'),
        Buffer.alloc(9 * 1024, 0),
      ]),
    }),
    true,
  );
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'an evidence folder holding documents and no captures yet',
    shot({ 'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION) }),
    false,
  );

  // ── The picture with nothing on it ───────────────────────────────────────
  //
  // **Both edges of this one are measured rather than argued**, because the gap between them is
  // narrow and every number in it belongs to a real encode: `blank` is a white 1440×900 canvas at
  // q80 and `sparse` is the sparsest real screen a board draws, a sign-in form on a plain ground,
  // taken through the same window and the same encoder. The second is the edge that matters - a
  // floor set anywhere above it turns a correct picture red, and the only way to green one is to
  // re-encode it larger, which is a change to the file that silences the check for the next one
  // that really is blank.
  const painted = (files) => t.project({ config: { ...WORDS }, files });
  const blank = (w, h, bytes) => ({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(w, h, { bytes }) });

  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'a shot of the viewport taken before the page painted',
    painted(blank(1440, 900, 2396)),
    true,
  );
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'the sparsest screen a board draws, taken at the quality that made it smallest',
    painted(blank(1440, 900, 5048)),
    false,
  );
  // The same picture through a higher-quality encoder. Both readings are of one screen, and a
  // measure that passed one and failed the other would be measuring the encoder.
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'that same screen re-encoded at the top of the quality range',
    painted(blank(1440, 900, 7848)),
    false,
  );
  // A blank page at a device pixel ratio of two costs four times a blank page at one, so its
  // bytes clear any absolute count set for a single-ratio run while its density does not move.
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'the same blank viewport shot at a device pixel ratio of two',
    painted(blank(2880, 1800, 9320)),
    true,
  );
  // A phone canvas pays the fixed header cost over a fifth of the pixels, which lifts an empty
  // canvas nearer the floor than a desktop one - the direction that narrows the margin.
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'a blank phone canvas, where the fixed cost is the largest share of the file',
    painted(blank(390, 844, 664)),
    true,
  );
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'a real screen on that same phone canvas',
    painted(blank(390, 844, 2010)),
    false,
  );
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'a capture whose bytes say nothing about the canvas they cover',
    painted({ 'docs/evidence/w02-org-shell/a-01.webp': `RIFF····WEBP${'\0'.repeat(9 * 1024)}` }),
    true,
  );
  t.add(
    'everyCaptureIsDenserThanAnEmptyCanvas',
    'an evidence folder holding documents and no captures yet',
    painted({ 'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION) }),
    false,
  );

  // ── Two frames, one picture ──────────────────────────────────────────────
  //
  // The state a frame exists to show did not reach the screen, so the run shot the base again under
  // the state's name. Everything about the file is right; only the pair says anything.
  const REAL = `RIFF····WEBP${'x'.repeat(40 * 1024)}`;
  const OTHER = `RIFF····WEBP${'y'.repeat(41 * 1024)}`;
  t.add(
    'noTwoCapturesAreTheSamePicture',
    'a state capture that is byte-for-byte its base',
    painted({
      'docs/evidence/w02-org-shell/a-01.webp': REAL,
      'docs/evidence/w02-org-shell/a-01b.webp': REAL,
    }),
    true,
  );
  t.add(
    'noTwoCapturesAreTheSamePicture',
    'a base and a state that differ',
    painted({
      'docs/evidence/w02-org-shell/a-01.webp': REAL,
      'docs/evidence/w02-org-shell/a-01b.webp': OTHER,
    }),
    false,
  );
  // Two chapters photographing the same unbuilt placeholder are two folders, and a folder is where a
  // frame's siblings live - so the comparison stays inside one.
  t.add(
    'noTwoCapturesAreTheSamePicture',
    'identical pictures in two different chapters',
    painted({
      'docs/evidence/w02-org-shell/a-01.webp': REAL,
      'docs/evidence/w01-foundation/b-01.webp': REAL,
    }),
    false,
  );

  // ── evidenceKeepsPaceWithItsCaptures ──────────────────────────────────────
  //
  // Captures in a chapter's folder and no run record beside them: the journey tests ran and nothing
  // wrote the record. The fixed form is the same folder with the record the command writes.
  const shooting = (files) => t.project({
    config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md' },
    files: { ...CHAPTER_TEXT, 'tracking/STATE.md': LEDGER('열림', '열림'), ...files },
  });
  const SHOT = `RIFF····WEBP${'\0'.repeat(9 * 1024)}`;
  const RUN_RECORD = '# W02 - 여정 실행\n\n| journey | persona | test | result |\n| --- | --- | --- | --- |\n'
    + '| 1 | 시스템 관리자 | journeys/w02.spec.ts › 로그인 | pass |\n\n'
    + '![A-01](w02-org-shell/a-01.webp)\n![A-02](w02-org-shell/a-02.webp)\n';

  t.add(
    'evidenceKeepsPaceWithItsCaptures',
    'one frame captured and no run record beside it',
    shooting({ 'docs/evidence/w02-org-shell/a-01.webp': SHOT }),
    true
  );
  t.add(
    'evidenceKeepsPaceWithItsCaptures',
    'two frames captured and no run record beside them',
    shooting({
      'docs/evidence/w02-org-shell/a-01.webp': SHOT,
      'docs/evidence/w02-org-shell/a-02.webp': SHOT,
    }),
    true
  );
  // A pane and a state of one frame are captures of that frame, so the folder is read by name.
  t.add(
    'evidenceKeepsPaceWithItsCaptures',
    'a frame captured in its panes and states and no run record beside it',
    shooting({
      'docs/evidence/w02-org-shell/a-01-t2.webp': SHOT,
      'docs/evidence/w02-org-shell/a-01-empty.webp': SHOT,
    }),
    true
  );
  t.add(
    'evidenceKeepsPaceWithItsCaptures',
    'the same captures with the run record the command wrote beside them',
    shooting({
      'docs/evidence/w02-org-shell.md': RUN_RECORD,
      'docs/evidence/w02-org-shell/a-01.webp': SHOT,
      'docs/evidence/w02-org-shell/a-02.webp': SHOT,
    }),
    false
  );
  t.add(
    'evidenceKeepsPaceWithItsCaptures',
    'a chapter folder holding no capture yet',
    shooting({ 'docs/evidence/w02-org-shell/notes.txt': 'kept for the run\n' }),
    false
  );
}
