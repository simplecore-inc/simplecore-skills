// What a closed chapter leaves behind: one result document per chapter, a section per line the
// chapter demands, and the captures those sections show.
//
// A chapter closes because the agent holding it says its persona lines passed, and nothing behind
// that claim outlives the session. The result document is what makes the verdict deferrable: one
// file per chapter, a section per line the chapter demands, and under each section what the persona
// did, what the chapter demanded, what the screen showed, and the capture of it.
//
// **It is the residue of running the verification, never the goal of it.** Whether an agent wrote
// the document first and then made the screens match it is not machine-visible and stays with the
// coordinator. What is visible is the shape, and that is what these gates hold — a section per
// demanded line, three labels under each, evidence under that, and every capture on disk.
//
// **The naming rule is the capture bound.** An image is named after the frame it shows and, where
// that frame draws a content tab strip, after the pane of it — so a chapter holds one image per
// frame it places plus one per further pane the board draws on those frames, and the board is what
// says how many that is. A chapter that places no frame cites no image at all and carries the
// command and what came back instead. Everything a sweep produced beyond the cited set stays in
// `capturesDir`, which the repository ignores.
//
// **The words are the project's and the shapes are the skill's.** Which word a ledger writes for a
// closed chapter, what a chapter's persona line looks like, what the three labels under a section
// are called — all declared, all read through `ctx`. What is fixed here is what a project does not
// get to vary without the checks becoming unreadable: one image format, one capture-name grammar,
// one ceiling on the bytes. A second format would mean a second reader for every name and a
// ceiling that means something different on each side of it; the day a project genuinely needs
// one, it becomes a schema key rather than a second regex.
import { proseLines, tableCells } from './prose.mjs';

/** The only image format a result document cites, and the bytes one of them may take. */
const CAPTURE_SUFFIX = '.webp';
const CAPTURE_BYTES = 150 * 1024;

/**
 * Below which a capture is almost certainly a shot taken before the page painted.
 *
 * <p><b>A blank capture is consistent with everything except the file.</b> The taker read the
 * screen, the screen was right, and what landed on disk is a white rectangle — nothing in the run
 * disagrees with anything else, and the sentence written beside it reads correctly. Only the bytes
 * know: a screenshot of text and borders does not compress, so a built screen runs to tens of
 * thousands of bytes and a blank one to a few.
 *
 * <p><b>The sparsest legitimate screen sets the number.</b> A sign-in form on a plain background —
 * about as little as a real screen ever draws — measured around nine kilobytes where a blank shot
 * of the same viewport measured under six. Seven sits between them with room on both sides, and it
 * is a warning rather than an error because the judgement is 「open this one」 rather than 「this is
 * wrong」.
 */
const CAPTURE_FLOOR = 7 * 1024;


/**
 * A capture's file name: the frame it shows, and — where the frame draws a content tab strip —
 * which pane of that strip, or which of the states navigation cannot reach.
 *
 * <p><b>The name is the bound.</b> `a-17.webp` is the frame as the board draws it, with the pane
 * the strip marks open; `a-17-t3.webp` is that frame's third pane. A frame therefore holds exactly
 * as many images as the board draws panes for it, and a frame with no strip holds one — so the
 * repository ceiling stays a number read off the board rather than a number that grows with how
 * thorough somebody felt.
 *
 * <p>Which panes a given frame owes needs the board, and nothing here reads one: a project gate
 * that does asks that question, and these gates know only the grammar.
 */
export const CAPTURE_NAME = /^([a-z])-(\d{2,})(?:-t\d+|-empty|-error)?\.webp$/;

/**
 * The same name found inside a sentence rather than measured whole.
 *
 * <p>A demand names its captures in running prose, usually in backticks, several to a clause. The
 * anchored form above answers 「is this string a capture name」 and this one answers 「which capture
 * names does this line contain」 — two questions, and deriving the second by stripping the anchors
 * off the first is how a reader ends up matching `a-01.webp` inside `data-01.webp`.
 */
const CAPTURE_IN_TEXT = /\b[a-z]-\d{2,}(?:-t\d+|-empty|-error)?\.webp\b/g;

/**
 * One demand line's clauses.
 *
 * <p><b>The clause is the unit, not the line.</b> A demand line is a run of clauses joined by
 * 「. 」 — open the screen, press the panes, check the empty list, press the row actions — and a
 * line whose empty-list clause gives its reason while its pane clause gives none is precisely the
 * habit the reason exists to break. Read line-wide, that line passes on its neighbour's sentence.
 *
 * <p>A capture name carries a `.` of its own and is never followed by a space at it, so the split
 * cannot fall inside one.
 */
const clauses = (line) => line.split(/(?<=[.。])\s+/);

/** A frame id as a heading writes it. */
const FRAME_ID = /\b[A-Z]-\d{2,}\b/g;

/** The heading a chapter writes for each base screen it builds. */
export const BASE_HEADING = /^## \d+\. ([A-Z]-\d{2,})(?: |$)/;

/** A numbered section of a chapter, as its number and its title. */
export const CHAPTER_SECTION = /^## (\d+)\. (.+?)\s*$/;

/** A section of an evidence document, as its whole title. */
export const EVIDENCE_HEADING = /^## (.+?)\s*$/;

/**
 * What separates a section from the role that proves it, in the heading both documents write.
 *
 * <p>Exported because a second reader over the same headings would otherwise carry its own copy of
 * it, and a separator that agrees today is a separator that disagrees the day one of them changes.
 */
export const ROLE_SEPARATOR = ' · ';

/** The opening or closing line of a fenced block. */
const FENCE = /^\s*(```|~~~)/;

/** `![alt](target)`, with an optional quoted title after the target. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)<>\s]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** Whether a line opens a block of its own rather than continuing the one above it. */
const BLOCK_START = /^\s*(?:\*\*|[-*+]\s|\d+\.\s|\||>|#)/;

/** What a quote may end with and the chapter line may not, once the quote is cut short. */
const QUOTE_TAIL = /[.·…—]+$/;

/** The names a folder's own index takes, which belong to no chapter on either side. */
const INDEX_NAME = /^(00|_|README)/i;

/** Every space and line break taken out, which is what makes two wrappings of one sentence equal. */
const folded = (text) => text.replace(/\s+/g, '');

/**
 * A file in the chapter folder that is a chapter rather than the folder's own index.
 *
 * <p>Read by shape, exactly as `ledgerGate` reads it: a markdown file directly in the folder, and
 * its chapter is the first segment of its name. A project naming chapters `w01-…` gets `W01` and
 * one naming them `stage-1-…` gets `STAGE`, which is why the two readers have to agree — a chapter
 * the ledger names and these gates do not is a chapter nothing holds.
 */
function chapterOf(file) {
  if (!file.endsWith('.md') || file.includes('/')) return null;
  if (INDEX_NAME.test(file)) return null;
  return file.replace(/\.md$/, '').split('-')[0].toUpperCase();
}

/** A file the folder keeps for itself rather than for one chapter — its index, its readme. */
const isIndex = (name) => name.endsWith('.md') && INDEX_NAME.test(name);

/** Every chapter the chapter folder holds, by the id its file name carries. */
function chapterFiles(ctx) {
  const out = new Map();
  for (const file of [...(ctx.list(ctx.at('chapterDir')) ?? [])].sort()) {
    const chapter = chapterOf(file);
    if (chapter) out.set(chapter, file);
  }
  return out;
}

/**
 * The chapters the state ledger records as closed.
 *
 * <p>A row whose first cell is a chapter this folder holds and whose second is the project's word
 * for closed. The word is declared; without it nothing is closed, every gate here goes quiet, and
 * `doctor` says which key is why — which is the whole point of grading that key `closing`.
 */
function closedChapters(ctx) {
  const closed = new Set();
  const word = ctx.declared('closedStatus');
  const text = ctx.read(ctx.at('stateLedger'));
  if (word === null || text === null) return closed;
  const known = new Set(chapterFiles(ctx).keys());
  for (const { line } of proseLines(text)) {
    const cells = tableCells(line);
    if (!cells || cells.length < 2) continue;
    if (known.has(cells[0].toUpperCase()) && cells[1] === word) closed.add(cells[0].toUpperCase());
  }
  return closed;
}

/**
 * The headings one chapter demands of its evidence document, in the chapter's own order.
 *
 * <p>A heading is the chapter's section number, that section's title, and the role — a persona
 * where the chapter places screens, and the verdict role where it places foundation a machine
 * proves. The whole string is built and matched whole, so a title carrying its own separator needs
 * no splitting.
 */
function demandedHeadings(ctx, rel) {
  const text = ctx.read(rel);
  if (text === null) return [];
  const { persona, verdict } = ctx.lines;
  const role = ctx.declared('verdictRole');
  const headings = [];
  const seen = new Set();
  let section = null;
  for (const { line } of proseLines(text)) {
    const named = CHAPTER_SECTION.exec(line);
    if (named) {
      section = `${named[1]}. ${named[2]}`;
      continue;
    }
    if (!section) continue;
    const named_ = persona?.exec(line);
    const who = named_ ? named_[1] : (verdict?.test(line) ? role : null);
    if (!who) continue;
    const heading = `${section}${ROLE_SEPARATOR}${who}`;
    if (seen.has(heading)) continue;
    seen.add(heading);
    headings.push(heading);
  }
  return headings;
}

/** The frames one chapter places — the screens its headings name and the states hanging off them. */
function framesPlaced(ctx, rel) {
  const placed = new Set();
  const text = ctx.read(rel);
  if (text === null) return placed;
  const { states } = ctx.lines;
  for (const { line } of proseLines(text)) {
    const heading = BASE_HEADING.exec(line);
    if (heading) placed.add(heading[1]);
    const hanging = states?.exec(line);
    if (!hanging) continue;
    for (const [id] of hanging[1].matchAll(FRAME_ID)) placed.add(id);
  }
  return placed;
}

/**
 * The frames one chapter places that somebody is told to prove — a base screen whose section
 * carries a persona line, and the states hanging off that same section.
 *
 * <p>A verdict line does not count. That line is proved by a command and what came back, which is
 * a fenced block rather than a picture, and a chapter placing frames never carries one.
 */
function demandedFrames(ctx, rel) {
  const demanded = new Set();
  const text = ctx.read(rel);
  if (text === null) return demanded;
  const { persona, states } = ctx.lines;
  let open = null;
  const close = () => {
    if (open?.proved) for (const id of open.frames) demanded.add(id);
    open = null;
  };
  for (const { line } of proseLines(text)) {
    const frame = BASE_HEADING.exec(line);
    if (frame) {
      close();
      open = { frames: new Set([frame[1]]), proved: false };
      continue;
    }
    if (CHAPTER_SECTION.test(line)) {
      close();
      continue;
    }
    if (!open) continue;
    const hanging = states?.exec(line);
    if (hanging) for (const [id] of hanging[1].matchAll(FRAME_ID)) open.frames.add(id);
    if (persona?.test(line)) open.proved = true;
  }
  close();
  return demanded;
}

/**
 * The frames one result document photographs, as the ids its images are named after.
 *
 * <p>Whose section carries the image is not this reader's business — a frame is photographed once
 * per document and any section may be the one that shows it. A pane capture counts as a photograph
 * of its frame: the question is whether a browser was ever opened on the screen, and it was.
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
 * One evidence document read as its sections.
 *
 * <p>`proseLines` is not enough here. A section that proves a machine verification carries the
 * command and what came back, and a fenced block is the one thing `proseLines` removes — so a
 * document made entirely of those would read as a document with no evidence in it at all.
 *
 * <p>The quoted rule is carried whole rather than as its first line. A rule long enough to wrap
 * wraps wherever the sentence happens to reach the margin, and two documents wrap it in different
 * places — so a reader that stopped at the newline would hand the quote check half a sentence and
 * call the other half missing.
 */
function evidenceSections(text, labels, placeholder = null) {
  const quoted = new RegExp(String.raw`^\*\*${labels.demanded}\*\*\s*—\s*(.*)$`);
  const sections = [];
  let current = null;
  let fenced = false;
  let quoting = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      quoting = false;
      if (current) current.fenced = true;
      return;
    }
    if (fenced) return;
    const heading = EVIDENCE_HEADING.exec(line);
    if (heading) {
      quoting = false;
      current = { title: heading[1], no: i + 1, labels: new Set(), images: [], fenced: false, quote: null, discharged: [] };
      sections.push(current);
      return;
    }
    if (!current) return;
    // A demand met by 「the same component as this picture」 rather than by a picture of its own.
    // Collected here rather than in a reader of its own, because a section's evidence is one
    // question — what does this section show — and three answers to it read together.
    const stood = placeholder?.exec(line);
    if (stood) current.discharged.push({ proof: (stood[1] ?? '').trim(), no: i + 1 });
    const said = quoted.exec(line);
    if (said) {
      current.quote = { text: said[1], no: i + 1 };
      quoting = true;
    } else if (quoting && line.trim() && !/^\s*(?:\*\*|#|!\[)/.test(line)) {
      current.quote.text += ` ${line}`;
    } else {
      quoting = false;
    }
    for (const label of Object.values(labels)) {
      if (line.startsWith(`**${label}**`)) current.labels.add(label);
    }
    for (const [, target] of line.matchAll(MARKDOWN_IMAGE)) current.images.push({ target, no: i + 1 });
  });
  return sections;
}

/**
 * One chapter file read as the sections a result document quotes from.
 *
 * <p>`headings` maps the whole heading an evidence section carries to the chapter section it names,
 * built exactly as `demandedHeadings` builds it so the two can never pair differently. `sections`
 * holds each section's lines, folded, with a wrapped line joined back into the one line it is.
 */
function chapterSections(ctx, rel) {
  const sections = new Map();
  const headings = new Map();
  const text = ctx.read(rel);
  if (text === null) return { sections, headings };
  const { persona, verdict } = ctx.lines;
  const verdictRole = ctx.declared('verdictRole');

  let key = null;
  let lines = null;
  let open = null;
  const flush = () => {
    if (open !== null && open.trim()) lines.push(folded(open));
    open = null;
  };

  for (const { line } of proseLines(text)) {
    const named = CHAPTER_SECTION.exec(line);
    if (named) {
      flush();
      key = `${named[1]}. ${named[2]}`;
      lines = [];
      sections.set(key, lines);
      continue;
    }
    if (key === null) continue;

    if (!line.trim()) flush();
    else if (BLOCK_START.test(line) || open === null) {
      flush();
      open = line;
    } else open += ` ${line}`;

    const said = persona?.exec(line);
    const who = said ? said[1] : (verdict?.test(line) ? verdictRole : null);
    if (who && !headings.has(`${key}${ROLE_SEPARATOR}${who}`)) headings.set(`${key}${ROLE_SEPARATOR}${who}`, key);
  }
  flush();
  return { sections, headings };
}

/** The three labels a section carries, by role, or null where the project has not named them. */
function labelsOf(ctx) {
  const declared = ctx.declared('evidenceLabels');
  if (!declared?.did || !declared?.demanded || !declared?.saw) return null;
  return { did: declared.did, demanded: declared.demanded, saw: declared.saw };
}

/**
 * The bytes a file takes.
 *
 * <p>`ctx` reads text and answers whether a path is there, and neither answers this — a capture is
 * binary, so the length of its utf8 decoding is not its size.
 */
function byteSize(ctx, rel) {
  const path = ctx.inRoot(rel);
  return ctx.exists(path) ? ctx.size(path) : null;
}

/**
 * The reader for a demand discharged as 「the same component as this picture」, or null.
 *
 * <p>A grammar that will not compile is `configGate`'s finding, not this file's — here it simply
 * means no such line can be recognised, and every check over one is skipped rather than run
 * against a pattern nobody can trust.
 */
function placeholderOf(ctx) {
  if (ctx.declared('placeholderLine') === null) return null;
  try {
    return ctx.lines.placeholder ?? null;
  } catch {
    return null;
  }
}

/**
 * What a project's own gates read out of the evidence folder, bound to one repository.
 *
 * <p>A project keeps gates of its own over the same documents — whether the frame a capture shows
 * can be reached again, whether every pane the board draws was photographed — and those gates
 * cannot import this file: the skill is installed somewhere different on every machine. So the
 * readers arrive on `ctx`, one definition, and a project gate never writes a second copy that
 * drifts from this one.
 */
export function evidenceReaders(ctx) {
  return {
    dir: ctx.declared('evidenceDir'),
    captureName: CAPTURE_NAME,
    captureSuffix: CAPTURE_SUFFIX,
    chapterOf,
    chapterFiles: () => chapterFiles(ctx),
    closedChapters: () => closedChapters(ctx),
    demandedFrames: (rel) => demandedFrames(ctx, rel),
    framesPlaced: (rel) => framesPlaced(ctx, rel),
    sections: (text) => {
      const labels = labelsOf(ctx);
      return labels === null ? [] : evidenceSections(text, labels, placeholderOf(ctx));
    },
  };
}

export const closedChapterHasEvidence = {
  id: 'closedChapterHasEvidence',
  title: 'a closed chapter whose verification left no result document, or one its captures have fallen out of',
  needs: ['chapterDir', 'stateLedger', 'evidenceDir', 'closedStatus', 'evidenceLabels'],
  run: (ctx) => {
    const labels = labelsOf(ctx);
    if (labels === null) return [];
    const dir_ = ctx.declared('evidenceDir');
    const dir = ctx.declared('chapterDir');
    const closedWord = ctx.declared('closedStatus');
    const chapters = chapterFiles(ctx);
    if (!chapters.size) return [];

    const closed = closedChapters(ctx);
    const findings = [];
    const known = new Set();

    for (const [chapter, file] of [...chapters].sort()) {
      known.add(file);
      const rel = `${dir_}/${file}`;
      const stem = file.slice(0, -'.md'.length);
      known.add(stem);
      const text = ctx.read(rel);
      if (text === null) {
        if (closed.has(chapter)) {
          findings.push(
            `${rel}: ${chapter} reads 「${closedWord}」 in ${ctx.declared('stateLedger')} and left no `
            + 'result document — the verdict rests on a claim that died with the session that made it'
          );
        }
        continue;
      }

      const demanded = demandedHeadings(ctx, `${dir}/${file}`);
      const placed = framesPlaced(ctx, `${dir}/${file}`);
      const sections = evidenceSections(text, labels, placeholderOf(ctx));
      const written = new Set(sections.map((s) => s.title));

      if (closed.has(chapter)) {
        for (const heading of demanded) {
          if (!written.has(heading)) {
            findings.push(`${rel}: ${chapter} is ${closedWord} and no section proves 「${heading}」`);
          }
        }
      }

      const expected = new Set(demanded);
      const cited = new Set();
      for (const section of sections) {
        if (!expected.has(section.title)) {
          findings.push(
            `${rel}:${section.no}: 「${section.title}」 proves no line ${dir}/${file} demands — `
            + 'a result document has one section per demanded line and nothing else'
          );
          continue;
        }
        for (const label of Object.values(labels)) {
          if (!section.labels.has(label)) {
            findings.push(`${rel}:${section.no}: 「${section.title}」 carries no 「${label}」 line`);
          }
        }
        // Three things count as showing something, and the third is what a correct skip leaves
        // behind: a pane that is the same unbuilt placeholder the section already photographed is
        // discharged against that picture rather than shot again under another name. Without it
        // the taker that was right left two sections showing nothing, which afterwards reads as
        // two panes nobody opened.
        if (!section.images.length && !section.fenced && !section.discharged.length) {
          findings.push(
            `${rel}:${section.no}: 「${section.title}」 shows nothing — a section carries the capture `
            + 'of the frame, what was run and what came back, or the picture that already proves '
            + 'the same component'
          );
        }
        for (const { target, no } of section.images) {
          const frame = CAPTURE_NAME.exec(target.slice(`${stem}/`.length));
          if (!target.startsWith(`${stem}/`) || !frame) {
            findings.push(
              `${rel}:${no}: ${target} is not ${stem}/<frame>${CAPTURE_SUFFIX} or `
              + `${stem}/<frame>-t<pane>${CAPTURE_SUFFIX} — the name is the bound, so a chapter holds `
              + 'one image per frame it places and one per further pane the board draws on it'
            );
            continue;
          }
          const id = `${frame[1].toUpperCase()}-${frame[2]}`;
          if (!placed.has(id)) {
            findings.push(`${rel}:${no}: ${target} shows ${id}, which ${chapter} does not place`);
            continue;
          }
          cited.add(target);
          const image = `${dir_}/${target}`;
          const bytes = byteSize(ctx, image);
          if (bytes === null) {
            findings.push(`${rel}:${no}: ${target} is cited and is not on disk`);
          } else if (bytes > CAPTURE_BYTES) {
            findings.push(
              `${image}: ${Math.round(bytes / 1024)}KB, over the ${CAPTURE_BYTES / 1024}KB ceiling — `
              + 'a repository that accumulates every frame of every chapter stops being usable'
            );
          } else if (bytes < CAPTURE_FLOOR) {
            findings.push(
              `${image}: ${Math.round(bytes / 1024)}KB — a screenshot of a built screen does not `
              + 'compress this small, so this is very likely a shot taken before the page painted: '
              + 'a white rectangle with a correct-looking sentence beside it. An empty LIST is not '
              + 'this — it still draws the shell, the header and the empty-state wording and comes '
              + 'out the usual size. Open it, and take it again if it is blank'
            );
          }
        }
      }

      for (const image of ctx.list(ctx.inRoot(`${dir_}/${stem}`)) ?? []) {
        if (!cited.has(`${stem}/${image}`)) {
          findings.push(
            `${dir_}/${stem}/${image}: nothing in ${rel} cites it — only what the result document `
            + `shows is tracked, and the rest of the sweep stays in ${ctx.declared('capturesDir') ?? 'the sweep folder'}`
          );
        }
      }
    }

    for (const entry of ctx.list(ctx.at('evidenceDir')) ?? []) {
      const top = entry.split('/')[0];
      if (known.has(top) || isIndex(top)) continue;
      findings.push(`${dir_}/${entry}: belongs to no chapter ${dir} holds`);
    }
    return findings;
  },
};

// ── The screen that was built and never opened ──────────────────────────────
//
// A chapter can pass every check a machine has — typecheck, lint, the frontend audit, the language
// audit, every endpoint probed against a running server, every drawn figure traced back to the
// seed — and still hand over screens that render the application shell and nothing inside it.
// Every request answers 200, no console error is raised, and the route measures the length of the
// shell exactly. None of those checks opens a browser, so none of them can tell a built screen
// apart from an empty one.
//
// The result document is where a browser was opened, and the capture is what is left of that. So a
// closed chapter shows one image per frame it places: a frame photographed nowhere in that
// document was looked at by nobody, whatever else came out green.
//
// **What this gate deliberately does not catch.** A capture of the right frame showing an empty
// shell passes it. Whether the picture shows the frame it is named after is a reading for eyes,
// and no script here judges it. This gate proves a browser was opened and the frame was
// photographed; it never proves the screen works, and reading it as that proof puts the defect
// above straight back.
//
// **The unit is the frame, not the section.** A role whose line only proves a scope boundary is
// evidenced by the address it called and the answer the server gave, so counting sections that
// carry a picture would fire on a document that is exactly right. A frame needs one capture
// somewhere in the document, whoever's section shows it.
//
// **A frame whose section demands nobody prove it is outside this.** The other side of the line —
// a frame with an address must be demanded of somebody — belongs to the check that reads the
// board, so between the two there is no frame a browser can reach that neither holds. What falls
// out is the shared-pattern cluster, drawn inside other screens with no address of its own to send
// a browser to; the chapter files say which frames those are, so this needs no list of letters.
//
// It judges only a chapter the ledger records as closed. A walk photographs its frames one at a
// time over hours, so judging an open chapter would hold the tree red for the whole of it; and the
// write-time hook fails a write whose own file an error names, which would stop the coordinator
// writing the very document the captures are cited from. An absent document is left to the gate
// above, which names it once instead of once per frame.

export const everyPlacedFrameIsCaptured = {
  id: 'everyPlacedFrameIsCaptured',
  title: 'a closed chapter showing no capture of a frame it built, so the screen was never opened',
  needs: ['chapterDir', 'stateLedger', 'evidenceDir', 'closedStatus'],
  run: (ctx) => {
    const dir_ = ctx.declared('evidenceDir');
    const closed = closedChapters(ctx);
    if (!closed.size) return [];

    const dir = ctx.declared('chapterDir');
    const closedWord = ctx.declared('closedStatus');
    const findings = [];
    for (const [chapter, file] of [...chapterFiles(ctx)].sort()) {
      if (!closed.has(chapter)) continue;
      const rel = `${dir_}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      const stem = file.slice(0, -'.md'.length);
      const shown = capturedFrames(text, stem);

      for (const id of [...demandedFrames(ctx, `${dir}/${file}`)].sort()) {
        if (shown.has(id)) continue;
        findings.push(
          `${rel}: ${chapter} is ${closedWord} and shows no ${stem}/${id.toLowerCase()}${CAPTURE_SUFFIX} — `
          + `${dir}/${file} builds ${id} and tells somebody to open it, and a frame nothing `
          + 'photographed is a screen nobody opened'
        );
      }
    }
    return findings;
  },
};

// ── The rule the section says it proved, against the rule the chapter carries ──
//
// The quoted label is copied out of the chapter file, and the chapter file is generated from the
// board. So a board fix regenerates the chapter and the closed chapter's section goes on quoting a
// sentence the chapter no longer carries — and the section then reads as a record of somebody
// verifying a rule that is gone. Nothing about it looks wrong: the labels are all there, the
// capture is on disk, and the two gates above pass it whole.
//
// **What 「quotes」 means here, because a reader has to be able to tell a wrong section from a
// strict gate.** The section's quote is a contiguous part of one line of the chapter section its
// heading names, once every space and line break is taken out of both and a trailing full stop is
// taken off the quote. Four things follow, and each is a shape the documents actually take:
//
//   · **Whitespace is removed rather than collapsed.** A language that wraps between characters
//     breaks one sentence in one place in the chapter and in another in the evidence, and that is
//     not a difference in the sentence. Collapsing each break to one space would make it one.
//   · **The quote may be shorter than the rule.** A section that proves the second half of a
//     two-part demand quotes that half, and dropping the trailing clause is the same thing from
//     the other end.
//   · **Any line of that section will do.** A persona often proves one of the board rules the
//     section lists as bullets rather than the generic demand line above them, and that is the
//     more useful of the two. Both are the chapter's own writing.
//   · **The section is the unit, not the file.** A rule that moved from one section to another is
//     exactly the drift this exists to catch, so a quote is never looked for outside the section
//     whose heading the evidence document wrote.
//
// **A heading that pairs with no line is somebody else's finding.** The gate above already names a
// section proving a line its chapter does not demand, and reporting it twice would have one defect
// redden two gates.
//
// It judges every result document rather than only a closed chapter's — a wrong quote is wrong
// while the walk is still running, and the sooner the write-time hook says so the cheaper it is.

export const evidenceQuotesTheChapter = {
  id: 'evidenceQuotesTheChapter',
  title:
    "an evidence section whose quoted demand is no contiguous part of any line of the chapter "
    + 'section it names, once whitespace is taken out of both',
  needs: ['chapterDir', 'evidenceDir', 'evidenceLabels'],
  run: (ctx) => {
    const labels = labelsOf(ctx);
    if (labels === null) return [];
    const dir_ = ctx.declared('evidenceDir');
    const dir = ctx.declared('chapterDir');
    const findings = [];
    for (const [, file] of [...chapterFiles(ctx)].sort()) {
      const rel = `${dir_}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;

      const { sections, headings } = chapterSections(ctx, `${dir}/${file}`);
      for (const section of evidenceSections(text, labels)) {
        if (!section.quote) continue;
        const key = headings.get(section.title);
        if (key === undefined) continue;

        const quote = folded(section.quote.text).replace(QUOTE_TAIL, '');
        if (!quote) {
          findings.push(
            `${rel}:${section.quote.no}: 「${labels.demanded}」 quotes nothing — the line carries the `
            + `sentence ${dir}/${file} demands, copied out of it`
          );
          continue;
        }
        if ((sections.get(key) ?? []).some((line) => line.includes(quote))) continue;
        findings.push(
          `${rel}:${section.quote.no}: 「${section.quote.text.trim()}」 is no part of any line ${dir}/${file} `
          + `writes under 「${key}」. 「${labels.demanded}」 is copied out of the chapter file and the `
          + 'chapter file is generated from the board, so a board fix leaves this section quoting a '
          + 'rule the chapter no longer carries — and the section then reads as a record of somebody '
          + "verifying a rule that is gone, with nothing about it looking wrong. Run this section's "
          + 'line against what the chapter demands now and write the section again, or say in '
          + `${ctx.declared('openItemsFile') ?? 'the open-items file'} why it cannot be run`
        );
      }
    }
    return findings;
  },
};


// ── A check that ran, and this installation cannot decide ───────────────────
//
// **The third outcome, and it is neither of the two everybody plans for.** A verification line is
// run rather than reasoned about — that is the whole rule — and sometimes running it answers
// 「not here」: the boundary the line proves is not enforced by THIS installation, and no amount of
// running it again will change that. A database whose application connects as a superuser cannot
// demonstrate row ownership; a deployment with no second factor cannot demonstrate a challenge; a
// single-tenant install cannot demonstrate a tenant boundary.
//
// **It is not 「did not happen」 and it is not 「passed」.** Recorded as the first, it reads as work
// somebody skipped and the chapter cannot close over it. Recorded as the second, the product
// carries a boundary nobody has ever seen hold — which is exactly the class of defect the whole
// evidence arrangement exists to stop.
//
// **It is a debt, and a debt names its creditor.** The section records what was run and what came
// back, exactly as any other section does, and adds one line naming **the chapter that will be
// able to decide it** — the chapter that installs the role, the second factor, the second tenant.
// The chapter that met the wall CLOSES: its work was done and the answer it got is the honest one.
// **The named chapter is the one that cannot close** while the line stands, and settling it is
// part of that chapter's own run.
//
// **Then, and only then, the earlier document is edited.** An earlier chapter's result document is
// otherwise never touched — it records what was true when that chapter closed. This is the one
// exception, and it is not really one: the document recorded a debt against itself, and paying it
// is what the document asked for. Remove the line and write what was finally seen, in the same
// change that settles it.
//
// **Why this needs two checks rather than a habit.** The line is written by whoever hit the wall,
// and read — if anyone reads it — by whoever closes a chapter three weeks later. Nothing connects
// those two people but the name in the line, and a name nobody checks is a name that goes stale
// the first time a chapter is renumbered.

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
          + `${ctx.declared('stateLedger')} with the line still standing. Either the check was run `
          + `during ${owed} — in which case this line comes out and what was seen goes in its `
          + `place, which is the one time an earlier chapter's document is edited — or it was not, `
          + `and ${owed} is not closed. A debt that survives its own due date is a boundary the `
          + 'product claims and nobody has ever watched hold'
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
// size, transcribes the page correctly, and reports nothing — while a tree's first data row, four
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
 * <p>Three encodings and all three appear in practice — `VP8 ` from a plain lossy encode, `VP8L`
 * from a lossless one, `VP8X` the moment alpha or metadata is present — so a reader that knew only
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
 * project's evidence folder opened as PNG under a `.webp` name, passing the name check, the size
 * ceiling and the blank floor, with nothing in any of them reading a byte. 「Not a WebP」 sends the
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
 * writes a file twice as wide from a window that was exactly right — the CSS pixels are the
 * standard and the file records the device ones.
 *
 * <p><b>「I could not tell」 is a finding rather than a silence.</b> A capture whose header does not
 * parse is one this gate has said nothing about, and a gate that goes quiet on what it could not
 * read is indistinguishable from one that read everything and found it sound — which is the exact
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
          + ' — so nothing here says what window this was shot through, and a capture nobody can '
          + 'measure passes the name check, the ceiling and the blank floor by not being read. '
          + `${really ? 'Encode it' : 'Take it again'} through the declared driver`
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

// ── A capture demanded out of habit, and one demanded for a reason ──────────
//
// A chapter's per-screen half is generated, so the capture names in it are emitted by a rule
// rather than judged one at a time. That is right for the names — the board says which panes a
// frame draws — and it produces a demand list nobody can give a reason for: one chapter set asked
// for 1040 pictures and said of not one of them why a picture was the witness.
//
// **Two things follow, and both were met in one week.** A frame whose three panes were unbuilt
// placeholders had three captures demanded and not one of them could be produced: the tab triggers
// are disabled and no content is registered behind them. And a taker that correctly shot one of
// those and left the other two was right, while the chapter went on reading as though it owed
// three.
//
// **The reason is what separates the two.** `references/demands.md` names three cases in which a
// picture is the only witness and three in which it is not, and a demand that asks for a capture
// says which of the three it is asking for, in the clause that names the file. **Whether the
// reason is true stays with eyes** — a claim about the running application is not in the chapter
// file — and that it was given is what this sees.

/**
 * Every demand that names a capture says why a picture is the witness for that one.
 *
 * <p><b>The clause is the unit.</b> A demand line is a run of clauses joined by 「. 」, and a line
 * whose empty-list clause carries a reason while its pane clause carries none passes any
 * line-wide reading on its neighbour's sentence — which is the exact shape the habit takes, since
 * one clause was written by hand and the other by a loop.
 *
 * <p>Every prose line of a chapter file is read rather than only the ones matching
 * `chapterLines.persona`. A capture named anywhere in a chapter is a capture somebody is being
 * asked for, and narrowing to one declared line would make the check quiet on a project whose
 * generator puts them somewhere else — quiet in the direction that reads as a pass.
 */
export const everyCaptureDemandGivesItsReason = {
  id: 'everyCaptureDemandGivesItsReason',
  title: 'a demand naming a capture without saying why a picture is the only witness for it',
  needs: ['chapterDir', 'captureReasons'],
  run: (ctx) => {
    const declared = ctx.declared('captureReasons');
    if (!declared || typeof declared !== 'object' || Array.isArray(declared)) return [];
    const phrases = Object.entries(declared)
      .filter(([role]) => !role.startsWith('//'))
      .flatMap(([, list]) => (Array.isArray(list) ? list : []))
      .filter((p) => typeof p === 'string' && p.trim())
      .map((p) => p.toLowerCase());
    if (!phrases.length) return [];

    const dir = ctx.declared('chapterDir');
    const findings = [];
    for (const [, file] of [...chapterFiles(ctx)].sort()) {
      const rel = `${dir}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      for (const { line, no } of proseLines(text)) {
        for (const clause of clauses(line)) {
          const named = [...clause.matchAll(CAPTURE_IN_TEXT)].map((m) => m[0]);
          if (!named.length) continue;
          const lowered = clause.toLowerCase();
          if (phrases.some((phrase) => lowered.includes(phrase))) continue;
          findings.push(
            `${rel}:${no}: 「${named.join(' · ')}」 ${named.length === 1 ? 'is' : 'are'} demanded and the `
            + 'clause says nothing about why a picture is the witness. A capture name with no reason is '
            + 'a habit rather than a judgment, and it is emitted by the thousand: one clause per pane per '
            + 'frame, including panes nobody can photograph. Say which of the three cases this is — the '
            + 'first sight of a screen, a claim about presence, placement or wording that no response body '
            + 'carries, or a state that exists only while something is open — in the words `captureReasons` '
            + 'declares. A demand that is none of the three is proved by what the server answered, and its '
            + 'evidence is a fenced block rather than a picture'
          );
        }
      }
    }
    return findings;
  },
};

/**
 * A demand discharged as 「the same component」 names a picture that proves it.
 *
 * <p>An unbuilt placeholder behind three tabs is one component photographed three times, so one
 * capture per chapter proves it and the rest are discharged against that one. <b>Discharged, never
 * skipped</b>: the taker that shot one and left two was right, and with nothing to write it left
 * two sections showing nothing — which afterwards is indistinguishable from two panes nobody
 * opened.
 *
 * <p>So the line is held to the one thing that makes it auditable rather than convenient: it names
 * a capture, that capture is on disk in this chapter's own folder, and this document shows it. A
 * discharge leaning on a picture nobody can open reads in the file exactly like one that holds.
 *
 * <p><b>Whether the component is still unbuilt is not in the bytes.</b> The day it is built the
 * line is false and nothing here changes, so that reading is in `../SKILL.md`'s second table with
 * its reader and its moment.
 */
export const dischargedDemandNamesItsProof = {
  id: 'dischargedDemandNamesItsProof',
  title: 'a demand discharged as already proved, naming no picture that proves it',
  needs: ['evidenceDir', 'chapterDir', 'evidenceLabels', 'placeholderLine'],
  run: (ctx) => {
    const labels = labelsOf(ctx);
    const placeholder = placeholderOf(ctx);
    if (labels === null || placeholder === null) return [];
    const dir_ = ctx.declared('evidenceDir');

    const findings = [];
    for (const [, file] of [...chapterFiles(ctx)].sort()) {
      const rel = `${dir_}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      const stem = file.slice(0, -'.md'.length);
      const sections = evidenceSections(text, labels, placeholder);
      const shown = new Set();
      for (const section of sections) {
        for (const { target } of section.images) {
          if (target.startsWith(`${stem}/`)) shown.add(target.slice(`${stem}/`.length));
        }
      }

      for (const section of sections) {
        for (const { proof, no } of section.discharged) {
          // The bare file name, resolved against this document's own folder. A discharge that
          // reached into another chapter's folder would lean on a component that chapter may since
          // have built, and 「one capture per chapter proves the component」 is what makes the
          // discharge safe in the first place.
          const name = proof.replace(/^[`'"《「]+|[`'"》」.,]+$/g, '').replace(`${stem}/`, '');
          if (!CAPTURE_NAME.test(name)) {
            findings.push(
              `${rel}:${no}: 「${section.title}」 discharges its demand against 「${proof || '(nothing)'}」, `
              + `which is not a capture name. A discharge names the picture that already proves that `
              + `component — <frame>${CAPTURE_SUFFIX}, <frame>-t<pane>${CAPTURE_SUFFIX} or `
              + `<frame>-empty${CAPTURE_SUFFIX} — because a discharge leaning on nothing reads exactly `
              + 'like one that holds'
            );
            continue;
          }
          if (!shown.has(name)) {
            findings.push(
              `${rel}:${no}: 「${section.title}」 discharges its demand against ${name}, which no section `
              + `of ${rel} shows. The picture a discharge leans on is one a reader of this document `
              + 'meets — otherwise the section says a component was proved somewhere nobody can open'
            );
            continue;
          }
          if (byteSize(ctx, `${dir_}/${stem}/${name}`) === null) {
            findings.push(`${rel}:${no}: 「${section.title}」 discharges its demand against ${name}, which is not on disk`);
          }
        }
      }
    }
    return findings;
  },
};

// A chapter section is a unit of work, and what makes it one is that something closes it: a
// persona proves it by walking the screen, or a machine proves it by holding a rule the whole
// console has to obey. A section carrying neither has a build line and nothing under it — the
// screen gets built and the chapter closes on having proved nothing of it.
//
// **It reads as a chapter with nothing wrong.** Every gate downstream of this one takes its
// demands from the persona and verdict lines a section carries, so a section that carries none
// contributes no demand, no heading and no capture — and `closedChapterHasEvidence`,
// `everyPlacedFrameIsCaptured` and `evidenceQuotesTheChapter` all come out green over a screen
// nobody ever asked anything of. The absence is what makes them quiet, which is why nothing
// already here could find it.
//
// **The two cases it separates are a generator's, not a person's.** A chapter set is generated
// from the board, so a frame the persona map resolves to nobody produces a section with a build
// line and no line beneath it — 43 of them in one chapter, and four more scattered singly through
// chapters whose other sections were fine. A per-chapter count sees the first and is blind to the
// second: a chapter reading 8 build lines and 24 persona lines looks healthy while one of its
// eight sections closes on nothing. The section is the unit, and this is the only reading that
// takes it.
//
// **Which of the two lines closes it is not this gate's question, and the answer is easy to get
// wrong.** A shared pattern reads as nobody's, so the tempting fix is to label its demands with
// the verdict word. Read what those demands say first: press the tab, press the row action, open
// the empty list at its address, leave a capture. Every one of them is a person in a browser, and
// where the project declares an address that renders one frame, a pattern is opened at its own
// address like anything else — so it wants the persona the chapter itself names. The verdict word
// is for a line a MACHINE proves, and labelling browser acts with it makes one word mean two
// things in the field every check over a chapter's evidence keys on.
//
// So this gate takes either line and judges neither. What it refuses is a section with no line at
// all, which is the only shape that is wrong whichever answer a project reaches.

/**
 * Every numbered section of a chapter carries the line that closes it.
 *
 * <p>Either line satisfies it: a persona line where somebody walks the screen, a verdict line
 * where a machine holds the rule instead. What it refuses is a section with neither, which is a
 * unit of work nothing can ever prove.
 *
 * <p><b>It keys on the section rather than on a build line</b>, and that is wider on purpose.
 * There is no declared word for a build line — `chapterLines` names the lines a check has to
 * recognise, and a build line is read by nobody — so keying on one would mean a new role every
 * project has to declare. It is also the weaker rule: a numbered section demanding nothing cannot
 * close whether or not it says what to build, and the header sections a chapter carries are
 * unnumbered and never reach this.
 *
 * <p><b>A project that declares neither line is skipped rather than failed</b>, by `needs` —
 * a project with no vocabulary for either has nothing here to compare against, and a gate firing
 * on every section of such a repository would say only that the config is incomplete, which
 * `configGate` already says better.
 */
export const everySectionCarriesItsClosingLine = {
  id: 'everySectionCarriesItsClosingLine',
  title: 'a chapter section nothing closes — no persona line and no verdict line under it',
  needs: ['chapterDir', 'chapterLines'],
  run: (ctx) => {
    const { persona, verdict } = ctx.lines;
    if (!persona && !verdict) return [];
    const dir = ctx.declared('chapterDir');
    const findings = [];
    for (const [, file] of [...chapterFiles(ctx)].sort()) {
      const rel = `${dir}/${file}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      let section = null;
      let opened = 0;
      let closed = false;
      const judge = () => {
        if (section === null || closed) return;
        findings.push(
          `${rel}:${opened}: 「${section}」 carries no line that closes it. A section is proved by `
          + 'somebody walking it or by a machine holding it, and one with neither is built and never '
          + 'asked for anything — every check over this chapter\'s evidence takes its demands from '
          + 'these lines, so the section contributes no demand, no heading and no capture, and the '
          + 'whole chapter reports green over it. Give it the persona that proves the screen — for a '
          + 'shared pattern the board settles no actor for, the persona the chapter itself names — or '
          + 'the verdict line where what proves it is a machine rather than somebody in a browser'
        );
      };
      for (const { line, no } of proseLines(text)) {
        const named = CHAPTER_SECTION.exec(line);
        if (named) {
          judge();
          section = `${named[1]}. ${named[2]}`;
          opened = no;
          closed = false;
          continue;
        }
        if (section === null) continue;
        if (persona?.test(line) || verdict?.test(line)) closed = true;
      }
      judge();
    }
    return findings;
  },
};

export const EVIDENCE_GATES = [
  closedChapterHasEvidence,
  everySectionCarriesItsClosingLine,
  everyPlacedFrameIsCaptured,
  evidenceQuotesTheChapter,
  deferredCheckNamesAChapter,
  chapterOwedACheckDoesNotClose,
  everyCaptureIsAtADeclaredWidth,
  everyCaptureDemandGivesItsReason,
  dischargedDemandNamesItsProof,
];

// ── The cases that prove them ───────────────────────────────────────────────
//
// **The words below are one project's and the shapes are the skill's.** Every Korean string here
// arrives through `WORDS`, which is a project's config rather than this file's knowledge — so a
// case written in another language would exercise exactly the same code, and a reader can tell at
// a glance which half of a gate is fixed. What the cases pin down is the shape: a section per
// demanded line, three labels under each, a picture or a fenced block, and a quote that is part of
// the chapter's own sentence.

/** One project's vocabulary, declared as a project declares it. */
const WORDS = {
  evidenceDir: 'docs/evidence',
  chapterLines: {
    persona: '**테스트 · {text}**…',
    verdict: '**판정**…',
    states: '…상태 {n}장이 딸린다 — {text}.',
  },
  evidenceLabels: { did: '한 일', demanded: '챕터가 정한 것', saw: '본 것' },
  closedStatus: '닫힘',
  verdictRole: '판정',
};

/**
 * A foundation chapter demanding one machine verification, and a screen chapter demanding two
 * persona lines. The screen chapter also places a shared pattern — a frame drawn inside other
 * screens, with no address of its own and nobody told to open it.
 *
 * <p><b>That last section carries a build line and nothing under it on purpose</b>, and it is what
 * `everySectionCarriesItsClosingLine` fires on. Every other gate here reads past it — a section
 * with no persona line and no verdict line contributes no demand, no heading and no capture — so
 * this fixture is the shape of a chapter that reports green while one of its screens was never
 * asked for anything, and the cases below hold it against the section that closes properly.
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

/** The one capture the screen chapter's document shows, with the bytes it takes. */
/**
 * A capture fixture. The default body is padded past the blank-capture floor on purpose: a
 * twelve-byte placeholder stands in for a picture in every dimension except the one the floor
 * measures, so a fixture that looks nothing like a screenshot would make every case here report a
 * blank capture and the rule would have to be weakened to fit its own fixtures.
 */
const CAPTURE = (body = `RIFF····WEBP${'\0'.repeat(9 * 1024)}`) => ({ 'docs/evidence/w02-org-shell/a-01.webp': body });

/**
 * A capture whose header really does state the canvas given, padded past the blank floor.
 *
 * <p><b>The bytes are the real layout rather than a stand-in</b>, because the thing under test is
 * a reader of those bytes: a fixture that agreed with the reader by construction would pass
 * whatever the reader did with an actual file. `lossy` writes the `VP8 ` header a plain encode
 * produces, and the `VP8X` form is what appears the moment alpha or metadata is present — both
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
 * The same screen section proved by an endpoint probe instead of by a picture. Every label is
 * there and something was run, so the shape gate above passes it whole — which is the defect this
 * is a fixture of: the server answered and nobody opened a browser.
 */
const W02_PROBE_SECTION =
  '## 1. A-01 로그인 · 시스템 관리자\n\n'
  + '**한 일** — 로그인 주소를 부르고 응답을 확인한다.\n'
  + '**챕터가 정한 것** — 실패 문구에 무엇이 틀렸는지 표시하지 않는다.\n'
  + '**본 것** — 서버가 200으로 답한다.\n\n'
  + '```\nPOST /auth/login → 200\n```\n\n';

/** One evidence document, made of the sections given. */
const W02_EVIDENCE = (...sections) => `# W02. 조직·계정 — 검증 결과\n\n${sections.join('')}`;

// ── A rule the board moved, against the section that says it proved it ──────

/** The second half of the demand line the first section quotes, and the board fix that replaced it. */
const TAIL = '「아이디 또는 비밀번호가 올바르지 않습니다」가 표시된다.';
const RULE = `로그인 화면을 연다. ${TAIL}`;
const REWORDED = '로그인 화면을 연다. 「로그인하지 못했습니다」가 표시된다.';

/**
 * One chapter section carrying every shape a result document quotes from: a two-part demand line,
 * a demand line long enough to wrap, a demand line with nothing but the generic sentence on it,
 * and the board rules the section lists as bullets under all of them.
 */
const QUOTED_CHAPTER = (rule) =>
  '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
  + '`a-01-login` · 데스크톱 · `/login`\n\n'
  + '**개발** — 보드의 `a-01-login`을 그대로 만든다.\n'
  + `**테스트 · 시스템 관리자** — ${rule}\n`
  + '**테스트 · 안전관리자** — 자기 범위의 것만 목록에 보인다. 범위 밖 레코드는 주소로 불러도\n'
  + '서버가 막는다.\n'
  + '**테스트 · 보건관리자** — 로그인 화면을 연다.\n\n'
  + '보드가 이 화면에 건 규칙 — 시험은 이것을 확인한다.\n'
  + '- 언어 전환이 이 화면에 있다\n'
  + '- 잠금 상태에는 남은 시간을 표시한다\n';

/**
 * The result document that section leaves behind. Not one of its three quotes is the whole of the
 * line it came from: the first drops the opening clause, the second wraps two lines earlier than
 * the chapter does, and the third quotes a board rule off the bullet list instead of the generic
 * sentence its own demand line carries.
 */
const QUOTED_EVIDENCE =
  '# W02. 조직·계정 — 검증 결과\n\n'
  + '## 1. A-01 로그인 · 시스템 관리자\n\n'
  + '**한 일** — 로그인 화면을 열고 틀린 비밀번호로 로그인한다.\n'
  + `**챕터가 정한 것** — ${TAIL}\n`
  + '**본 것** — 그 한 줄만 표시되고 어느 쪽이 틀렸는지는 없다.\n\n'
  + '![A-01 로그인](w02-org-shell/a-01.webp)\n\n'
  + '## 1. A-01 로그인 · 안전관리자\n\n'
  + '**한 일** — 범위 밖 사업장의 주소를 직접 부른다.\n'
  + `**챕터가 정한 것** — 자기 범위의 것만 목록에 보인다. 범위 밖\n`
  + '레코드는 주소로 불러도 서버가 막는다.\n'
  + '**본 것** — 서버가 403으로 답한다.\n\n'
  + '```\nGET /api/sites/9 → 403 SCOPE_DENIED\n```\n\n'
  + '## 1. A-01 로그인 · 보건관리자\n\n'
  + '**한 일** — 계정을 다섯 번 틀리게 넣어 잠근 뒤 화면을 읽는다.\n'
  + `**챕터가 정한 것** — 잠금 상태에는 남은 시간을 표시한다.\n`
  + '**본 것** — 「10분 뒤에 다시 시도할 수 있습니다」가 표시된다.\n\n'
  + '```\nPOST /auth/login × 6 → 423 ACCOUNT_LOCKED  retryAfter=600\n```\n';

// ── A capture demanded for a reason, and one demanded out of habit ──────────

/** One project's three reason vocabularies, declared as a project declares them. */
const REASONS = {
  firstSight: ['아무도 열어 본 적이 없어'],
  presence: ['응답 본문에 없는 것이라'],
  transient: ['열려 있는 동안에만 있는 상태라'],
};

/** A chapter demanding two pane captures and saying nothing about why either is owed. */
const PANES_UNREASONED =
  '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
  + '**개발** — 보드의 `a-01-login`을 그대로 만든다.\n'
  + '**테스트 · 시스템 관리자** — 로그인 화면을 연다. 나머지 두 칸을 눌러 칸마다 캡처를 남긴다 — `a-01-t2.webp` · `a-01-t3.webp`.\n'
  + '**테스트 · 안전관리자** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n';

/**
 * The reason on the clause BESIDE the one that names the files.
 *
 * <p>The shape a line-wide reading passes on its neighbour's sentence, and the shape a generator
 * produces the day one clause is written by hand and the next by a loop over the board's panes.
 */
const PANES_REASON_NEXT_DOOR =
  '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
  + '**개발** — 보드의 `a-01-login`을 그대로 만든다.\n'
  + '**테스트 · 시스템 관리자** — 아무도 열어 본 적이 없어 화면을 먼저 연다. 나머지 두 칸을 눌러 칸마다 캡처를 남긴다 — `a-01-t2.webp` · `a-01-t3.webp`.\n'
  + '**테스트 · 안전관리자** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n';

/** The same demand, with the reason in the clause that names the files. */
const PANES_REASONED =
  '# W02. 조직·계정\n\n## 1. A-01 로그인\n\n'
  + '**개발** — 보드의 `a-01-login`을 그대로 만든다.\n'
  + '**테스트 · 시스템 관리자** — 로그인 화면을 연다. 칸마다 든 것이 응답 본문에 없는 것이라 나머지 두 칸을 눌러 캡처를 남긴다 — `a-01-t2.webp` · `a-01-t3.webp`.\n'
  + '**테스트 · 안전관리자** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n';

/** The line this project discharges a demand with, and what its `{text}` carries. */
const PLACEHOLDER_LINE = '**같은 컴포넌트** — {text}';

/** A section showing a pane capture of its own, so a discharge has something to lean on. */
const W02_PANE_SECTION =
  '## 1. A-01 로그인 · 보건관리자\n\n'
  + '**한 일** — 두 번째 칸을 누른다.\n'
  + '**챕터가 정한 것** — 칸마다 무엇이 있는지 적는다.\n'
  + '**본 것** — 아직 자리표시자다.\n\n'
  + '![A-01 두 번째 칸](w02-org-shell/a-01-t2.webp)\n\n';

/** A section that discharges its demand against the picture named. */
const W02_DISCHARGE = (proof) =>
  '## 1. A-01 로그인 · 안전관리자\n\n'
  + '**한 일** — 세 번째 칸을 누른다.\n'
  + '**챕터가 정한 것** — 칸마다 무엇이 있는지 적는다.\n'
  + '**본 것** — 두 번째 칸과 같은 자리표시자 컴포넌트다.\n\n'
  + `**같은 컴포넌트** — ${proof}\n\n`;

/** A section carrying every label and showing nothing — no picture, no block, no discharge. */
const W02_SILENT_SECTION =
  '## 1. A-01 로그인 · 안전관리자\n\n'
  + '**한 일** — 범위 밖 사업장의 주소를 직접 부른다.\n'
  + '**챕터가 정한 것** — 범위 밖 레코드는 주소로 불러도 서버가 막는다.\n'
  + '**본 것** — 서버가 막는다.\n\n';

export function cases(t) {
  const evidence = (files) =>
    t.project({ config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md' }, files: { ...CHAPTER_TEXT, ...files } });

  t.add('closedChapterHasEvidence', 'a closed chapter that left no result document', evidence({ 'tracking/STATE.md': LEDGER('닫힘', '열림') }), true);
  t.add(
    'closedChapterHasEvidence',
    'a closed chapter whose document proves one of its two persona lines',
    evidence({
      'tracking/STATE.md': LEDGER('열림', '닫힘'),
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION),
      ...CAPTURE(),
    }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a section with no capture and nothing run under it',
    evidence({
      'tracking/STATE.md': LEDGER('열림', '열림'),
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION.replace(/!\[[^\]]*\]\([^)]*\)\n\n/, '')),
    }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a capture the document cites and disk does not hold',
    evidence({ 'tracking/STATE.md': LEDGER('열림', '열림'), 'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION) }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a capture over the size ceiling',
    evidence({
      'tracking/STATE.md': LEDGER('열림', '열림'),
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION),
      ...CAPTURE('x'.repeat(160 * 1024)),
    }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a capture too small to be a picture of a built screen',
    evidence({
      'tracking/STATE.md': LEDGER('열림', '열림'),
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION),
      ...CAPTURE('RIFF····WEBP'),
    }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a capture of a frame the chapter does not place',
    evidence({
      'tracking/STATE.md': LEDGER('열림', '열림'),
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION.replace('a-01.webp', 'z-09.webp')),
      'docs/evidence/w02-org-shell/z-09.webp': `RIFF····WEBP${'\0'.repeat(9 * 1024)}`,
    }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a capture tracked beside the document that no section shows',
    evidence({
      'tracking/STATE.md': LEDGER('열림', '열림'),
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION),
      ...CAPTURE(),
      'docs/evidence/w02-org-shell/a-01-2.webp': `RIFF····WEBP${'\0'.repeat(9 * 1024)}`,
    }),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'both chapters open, with nothing written yet',
    evidence({ 'tracking/STATE.md': LEDGER('진행', '열림') }),
    false
  );
  t.add(
    'closedChapterHasEvidence',
    'both closed, the screens shown as captures and the foundation as what was run',
    evidence({
      'tracking/STATE.md': LEDGER('닫힘', '닫힘'),
      'docs/evidence/w01-foundation.md': W01_EVIDENCE,
      'docs/evidence/w02-org-shell.md': W02_EVIDENCE(W02_SCREEN_SECTION, W02_SCOPE_SECTION),
      ...CAPTURE(),
    }),
    false
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
  const quoted = (files) =>
    t.project({
      config: { ...WORDS, chapterDir: 'chapters', openItemsFile: 'tracking/OPEN.md' },
      files: { 'chapters/w02-org-shell.md': QUOTED_CHAPTER(REWORDED), ...files },
    });

  t.add(
    'evidenceQuotesTheChapter',
    'a board fix reworded the rule, and the closed chapter goes on quoting the sentence it replaced',
    quoted({ 'docs/evidence/w02-org-shell.md': QUOTED_EVIDENCE }),
    true
  );
  t.add(
    'evidenceQuotesTheChapter',
    'a section whose 「챕터가 정한 것」 carries no sentence at all',
    quoted({
      'chapters/w02-org-shell.md': QUOTED_CHAPTER(RULE),
      'docs/evidence/w02-org-shell.md': QUOTED_EVIDENCE.replace(`**챕터가 정한 것** — ${TAIL}`, '**챕터가 정한 것** —'),
    }),
    true
  );
  t.add(
    'evidenceQuotesTheChapter',
    'the tail of a two-part rule, a rule the two files wrap in different places, and a board rule quoted off the bullet list',
    quoted({
      'chapters/w02-org-shell.md': QUOTED_CHAPTER(RULE),
      'docs/evidence/w02-org-shell.md': QUOTED_EVIDENCE,
    }),
    false
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

  // A project that has not named its labels has named nothing these gates read, so they say
  // nothing rather than reading the documents in this skill's own language and reporting a page of
  // findings nobody can act on. `doctor` grades the undeclared key ◑ and says which one it is.
  t.add(
    'closedChapterHasEvidence',
    'the same closed chapter with the evidence labels undeclared',
    t.project({
      config: { ...WORDS, evidenceLabels: undefined, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md' },
      files: { ...CHAPTER_TEXT, 'tracking/STATE.md': LEDGER('닫힘', '열림') },
    }),
    false,
  );

  // everyCaptureIsAtADeclaredWidth — the one half of the capture standard a file still remembers.
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
  // lossy header would report every such capture as unmeasurable — or, worse, measure none of them.
  t.add(
    'everyCaptureIsAtADeclaredWidth',
    'a capture carrying alpha, whose canvas sits in the extended chunk',
    shot({ 'docs/evidence/w02-org-shell/a-01.webp': webpOf(1440, 1200, { form: 'extended' }) }),
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
  // passes the name check, the ceiling and the blank floor, because none of those opens a byte.
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

  // ── A capture demanded out of habit, and one demanded for a reason ────────

  const demanding = (chapter) => t.project({
    config: { ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md', captureReasons: REASONS },
    files: { ...CHAPTER_TEXT, 'chapters/w02-org-shell.md': chapter },
  });

  t.add(
    'everyCaptureDemandGivesItsReason',
    'a pane capture demanded with nothing said about why a picture is the witness',
    demanding(PANES_UNREASONED),
    true
  );
  // The shape a line-wide reading walks straight through: the reason on the clause beside the one
  // that names the file. It is what a generator produces the day one clause is written by hand and
  // the next by a loop over the board's panes.
  t.add(
    'everyCaptureDemandGivesItsReason',
    'a line whose empty-list clause gives its reason and whose pane clause does not',
    demanding(PANES_REASON_NEXT_DOOR),
    true
  );
  t.add(
    'everyCaptureDemandGivesItsReason',
    'every clause that names a capture saying which of the three cases it is',
    demanding(PANES_REASONED),
    false
  );
  t.add(
    'everyCaptureDemandGivesItsReason',
    'a chapter demanding no capture at all',
    demanding(CHAPTER_TEXT['chapters/w02-org-shell.md']),
    false
  );

  // ── A section nothing closes, against one a verdict closes ────────────────

  const closing = (chapter) => t.project({
    config: { ...WORDS, chapterDir: 'chapters' },
    files: { ...CHAPTER_TEXT, 'chapters/w02-org-shell.md': chapter },
  });

  /** The pattern section with one line put under its build line, whichever line that is. */
  const BUILD = '**개발** — 보드의 `p-01-list-pattern`을 그대로 만든다.\n';
  const PATTERN_CLOSED_BY = (line) =>
    CHAPTER_TEXT['chapters/w02-org-shell.md'].replace(BUILD, `${BUILD}${line}\n`);

  // The whole file is healthy by every count a reader takes: two persona lines, a build line per
  // section, a foundation chapter proving itself. What is wrong is one section out of two, which
  // is why the reading has to be per section — a per-file or per-chapter count reports this as
  // sound, and that is how 43 sections in one chapter and four more scattered singly through three
  // others went unremarked.
  t.add(
    'everySectionCarriesItsClosingLine',
    'a pattern frame placed with a build line and no line under it, in a chapter whose other section is fine',
    closing(CHAPTER_TEXT['chapters/w02-org-shell.md']),
    true
  );
  // The same section closed the way a frame no persona reaches is closed. A pattern has no address
  // anybody can be sent to, so what holds it is a checker across the whole console rather than one
  // person opening one demo page — and the verdict line is where that is written down.
  t.add(
    'everySectionCarriesItsClosingLine',
    'the same section closed by the persona the chapter itself names, where the board settles none',
    closing(PATTERN_CLOSED_BY('**테스트 · 시스템 관리자** — 공용 목록 패턴 화면을 연다.')),
    false
  );
  // The other line satisfies it too, and both are here because the gate deliberately does not
  // choose between them. Which one a pattern takes is the project's reading of what proves it —
  // somebody in a browser, or a checker — and a case pinning only one would read as this gate
  // having an opinion it does not have.
  t.add(
    'everySectionCarriesItsClosingLine',
    'the same section closed by a verdict line, where what proves it is a machine',
    closing(PATTERN_CLOSED_BY('**판정** — 목록을 그리는 모든 화면이 이 패턴을 쓴다.')),
    false
  );

  // ── A demand discharged as 「the same component」 ───────────────────────────

  const discharging = (document, extra = {}) => t.project({
    config: {
      ...WORDS, chapterDir: 'chapters', stateLedger: 'tracking/STATE.md', placeholderLine: PLACEHOLDER_LINE,
    },
    files: {
      ...CHAPTER_TEXT,
      'tracking/STATE.md': LEDGER('열림', '닫힘'),
      'docs/evidence/w02-org-shell.md': document,
      ...CAPTURE(),
      ...extra,
    },
  });

  t.add(
    'dischargedDemandNamesItsProof',
    'a discharge naming the component in words rather than naming a picture',
    discharging(W02_EVIDENCE(W02_SCREEN_SECTION, W02_DISCHARGE('자리표시자 컴포넌트'))),
    true
  );
  t.add(
    'dischargedDemandNamesItsProof',
    'a discharge naming a picture no section of the document shows',
    discharging(W02_EVIDENCE(W02_SCREEN_SECTION, W02_DISCHARGE('`a-01-t4.webp`'))),
    true
  );
  // Cited in this document and absent from the folder. `closedChapterHasEvidence` reports an image
  // that is cited and missing; a discharge is not an image, so nothing else would look for this.
  t.add(
    'dischargedDemandNamesItsProof',
    'a discharge naming a picture the document shows and the folder does not hold',
    discharging(
      W02_EVIDENCE(W02_SCREEN_SECTION, W02_PANE_SECTION, W02_DISCHARGE('`a-01-t2.webp`'))
    ),
    true
  );
  t.add(
    'dischargedDemandNamesItsProof',
    'a discharge naming the pane capture the section above it shows',
    discharging(
      W02_EVIDENCE(W02_SCREEN_SECTION, W02_PANE_SECTION, W02_DISCHARGE('`a-01-t2.webp`')),
      { 'docs/evidence/w02-org-shell/a-01-t2.webp': `RIFF····WEBP${'\0'.repeat(9 * 1024)}` }
    ),
    false
  );
  t.add(
    'dischargedDemandNamesItsProof',
    'a document that discharges nothing',
    discharging(W02_EVIDENCE(W02_SCREEN_SECTION)),
    false
  );

  // A section showing neither a picture nor a fenced block is a section that shows nothing —
  // unless it discharges its demand against the picture that already proves that component. Both
  // directions here, because the third answer was added to a gate that had two.
  t.add(
    'closedChapterHasEvidence',
    'a section that shows nothing at all',
    discharging(W02_EVIDENCE(W02_SCREEN_SECTION, W02_SILENT_SECTION)),
    true
  );
  t.add(
    'closedChapterHasEvidence',
    'a section carrying a discharge in place of a picture',
    discharging(W02_EVIDENCE(W02_SCREEN_SECTION, W02_DISCHARGE('`a-01.webp`'))),
    false
  );
}
