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

/** Whether a markdown heading with this exact text appears in the document. */
export function hasHeading(text, heading) {
  return text
    .split(/\r?\n/)
    .some((line) => /^#{1,6}\s/.test(line) && line.replace(/^#{1,6}\s*/, '').trim().includes(heading));
}

/**
 * The lines under a heading, up to the next heading of any level.
 *
 * @returns the section's lines with their 1-based numbers, or null when the heading is absent
 */
export function sectionUnder(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => /^#{1,6}\s/.test(line) && line.replace(/^#{1,6}\s*/, '').trim().includes(heading)
  );
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    out.push({ line: lines[i], no: i + 1 });
  }
  return out;
}
