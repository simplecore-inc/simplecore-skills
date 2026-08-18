// Compiling a project's chapter lines into readers, from phrases rather than from regexes.
//
// **A config holding raw regular expressions is a config nobody can read.** It also fails in the
// worst available way: a pattern with a typo matches nothing, and a check that matches nothing is
// indistinguishable on screen from a check that found nothing wrong. So a project writes the line
// as it writes it, with two placeholders and one mark for 「more text here」, and this compiles it.
//
// **The vocabulary is closed and an unknown token is a hard failure.** Passing one through as a
// literal produces a regex that can never match — the same silent pass as a typo, arriving the day
// somebody reaches for a third placeholder. This compiler is itself a reader built from the tokens
// in use today, and the rule this repository learned about readers applies to it: build from the
// set of values that may occur, not from the ones you happen to be writing.

/**
 * Everything a phrase may carry beyond its own words, and whether the check READS it.
 *
 * <p>A placeholder that captures shifts every capture after it, so what a placeholder stands for is
 * half the answer and whether anybody reads it is the other half. `{n}` marks 「a number belongs
 * here」 and is stepped over; `{text}` marks a value the check takes. Compiled the other way the
 * pattern still matched every line it should and handed back the count where the caller expected
 * the list — the match was right and the reading was wrong, which no run of the check would show.
 *
 * <p>A check that needs the number wants a third token rather than a re-reading of `{n}`, and the
 * closed set below makes the day it is added loud.
 */
const PLACEHOLDERS = {
  '{n}': String.raw`\d+`,
  '{text}': String.raw`(.+?)`,
};

/** 「more of the line, unread」 — at the front, the back, or both. */
const ELLIPSIS = '…';

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * One line's reader, from the phrase a project writes it with.
 *
 * <p><b>Anchoring is what the phrase says, not what the caller remembers.</b> A phrase is a whole
 * line unless it starts or ends with `…`, and every anchor comes from that — a config that writes
 * `^` and `$` is a config writing regexes again. Getting this wrong is not visible: a pattern that
 * lost its end anchor goes on matching, mid-line, and drags in the neighbouring sentence.
 *
 * @param phrase the line as the project writes it, with `{n}`, `{text}` and `…`
 * @param key what the phrase is for, so a failure says which declaration is wrong
 * @returns the compiled reader
 */
export function compileLine(phrase, key) {
  if (typeof phrase !== 'string' || !phrase.trim()) {
    throw new Error(`${key}: a line grammar is a non-empty phrase`);
  }
  const openStart = phrase.startsWith(ELLIPSIS);
  const openEnd = phrase.endsWith(ELLIPSIS);
  const body = phrase.slice(openStart ? ELLIPSIS.length : 0,
    openEnd ? phrase.length - ELLIPSIS.length : undefined);
  if (body.includes(ELLIPSIS)) {
    throw new Error(`${key}: ${ELLIPSIS} marks an open end of the line, so it goes at the front or the back and nowhere between`);
  }
  for (const found of body.matchAll(/\{[^{}]*\}/g)) {
    if (!(found[0] in PLACEHOLDERS)) {
      throw new Error(
        `${key}: ${found[0]} is not a placeholder this skill knows (${Object.keys(PLACEHOLDERS).join(' · ')}). `
        + 'Passing it through as literal text would compile a pattern that can never match, and a '
        + 'check that never matches reads exactly like a check that found nothing'
      );
    }
  }
  const source = body
    .split(/(\{[^{}]*\})/)
    .map((part) => (part in PLACEHOLDERS ? PLACEHOLDERS[part] : part.replace(ESCAPE, '\\$&')))
    .join('');
  // A line's trailing whitespace is not part of what it says, so a closed end tolerates it.
  return new RegExp(`${openStart ? '' : '^'}${source}${openEnd ? '' : String.raw`\s*$`}`);
}

/**
 * Every line reader a project declares, compiled.
 *
 * <p>A role declared `null` is a project stating it writes no such line, and it compiles to
 * nothing — a reader that is absent rather than one that matches nothing. Every check reads these
 * with `?.`, so an absent role skips the clause it governs instead of failing every line against
 * an impossible pattern. A `//<role>` entry alongside carries the reason and is not a role.
 *
 * @param lines the `chapterLines` map
 * @returns role → RegExp, with a role declared absent left out
 */
export function compileLines(lines) {
  return Object.fromEntries(
    Object.entries(lines ?? {})
      .filter(([role, phrase]) => !role.startsWith('//') && phrase !== null)
      .map(([role, phrase]) => [role, compileLine(phrase, `chapterLines.${role}`)])
  );
}
