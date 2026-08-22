// Reading a document without reading its examples.
//
// A file that states a rule about a phrase quotes that phrase, so a check that matches on
// text alone fires on the sentence forbidding the thing. Fenced blocks and quoted spans are
// removed before anything is matched.

/**
 * Point-of-view phrasing that turns a facts file into somebody's diary.
 *
 * <p>Korean and English by default. A project writing in another language adds its own
 * through `narrativePhrases`; the two are concatenated, so the defaults keep holding for the
 * mixed-language case.
 */
export const NARRATIVE_PHRASES = [
  '내가 보기',
  '이번에',
  '예전에는',
  '해 보니',
  '했었다',
  'I found',
  'we found',
  'this time',
  'used to be',
];

/**
 * Naming the run that produced a fact, which dates the document to a session nobody can recover.
 *
 * <p><b>Separate from `NARRATIVE_PHRASES` because it governs a different set of files.</b> Those
 * turn a facts file into a diary and are checked in the handover; these turn a record of what was
 * on a screen into a record of what a round changed, and belong to every result document — 「this
 * line appeared in this round」 says nothing a reader of the screen needs, and it is false the day
 * the next round runs.
 *
 * <p><b>Every entry carries a demonstrative on purpose.</b> A round is a real thing in some
 * domains — a workplace-measurement round, an inspection round — so the bare word is a screen
 * label rather than a trace. `이번 회차 측정값` is a field on a real screen in one project and
 * `이 회차에 만든` is a session trace in the same repository; only the demonstrative-plus-round
 * pairing separates them, and quoted spans are stripped before matching so the label survives
 * even when it takes this exact shape.
 */
export const ROUND_PHRASES = [
  '이 회차',
  '이번 회차',
  '앞 회차',
  '지난 회차',
  '이번 라운드',
  '앞 라운드',
  '지난 라운드',
  'this round',
  'this pass',
  'last round',
  'the previous round',
];

/** Line indexes that sit inside a fenced code block, so examples are never audited. */
export function fencedLines(lines) {
  const fenced = new Set();
  let open = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      open = !open;
      fenced.add(i);
      return;
    }
    if (open) fenced.add(i);
  });
  return fenced;
}

/**
 * Whether a phrase appears on this line only as quoted or code-span text.
 *
 * <p>A rule stated about a phrase is not a use of it, and both ways of marking a phrase as
 * being talked about — quotation marks and a code span — are removed before the test.
 */
export function onlyQuoted(line, phrase) {
  const stripped = line
    .replace(/`[^`]*`/g, '')
    .replace(/["“”'『「][^"“”'』」]*["“”'』」]/g, '');
  return !stripped.includes(phrase);
}

/** The lines of a document, paired with their index, minus everything inside a fence. */
export function proseLines(text) {
  const lines = text.split(/\r?\n/);
  const fenced = fencedLines(lines);
  return lines.map((line, i) => ({ line, no: i + 1, fenced: fenced.has(i) })).filter((l) => !l.fenced);
}

/**
 * Whether a line is a markdown heading whose text is exactly the one declared.
 *
 * <p>**Exactly, and never by containment.** A key such as `openItemsHeading` declares the
 * heading's text, so a declaration that is merely a fragment of a real heading would satisfy
 * every reader here while naming no heading the project actually wrote. A pattern that accepts
 * more than it should makes every comparison pass, and the comparisons are still counted — so it
 * reads as a rule that is held right up to the day a second heading contains the same fragment,
 * and then it silently reads the wrong section, with nothing having changed.
 *
 * <p>The markers and the surrounding space are stripped from both sides first: the declaration
 * carries the heading's text, not its markdown.
 */
function isHeading(line, heading) {
  if (!/^#{1,6}\s/.test(line)) return false;
  return line.replace(/^#{1,6}\s*/, '').trim() === String(heading).trim();
}

/** Whether a markdown heading with this exact text appears in the document. */
export function hasHeading(text, heading) {
  return text.split(/\r?\n/).some((line) => isHeading(line, heading));
}

/**
 * The lines under a heading, up to the next heading of any level.
 *
 * <p>It finds the heading with the same predicate `hasHeading` uses — otherwise a gate locates a
 * heading by one rule and reads the section under it by another, and the second heading it lands
 * on is nobody's mistake to find.
 *
 * @returns the section's lines with their 1-based numbers, or null when the heading is absent
 */
export function sectionUnder(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => isHeading(line, heading));
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    out.push({ line: lines[i], no: i + 1 });
  }
  return out;
}

/** A markdown table row's cells, or null when the line is not one. */
export function tableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}
