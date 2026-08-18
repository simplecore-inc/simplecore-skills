// The kit writes the board's chrome, so the kit has to be the thing that styles it.
//
// **This gate exists because the failure is invisible.** The rules for the sidebar index, the flow
// sections, the frame label, the fold and the viewport toggle used to live in the shipped pattern.
// A board drawn in that pattern was fine; a board that brought its own — `wf.mjs pattern adopt`
// promotes what the board's screens draw with, and a board never wrote the sidebar — built green
// with no rule for `.is-off`, which is the class the index filter hides a non-matching entry with.
// The filter then counted matches and hid nothing: a control that is present, that responds to
// typing, and that does not do the one thing it is for. Nothing on the board said so, and no gate
// could see it, because every gate reads markup and the markup was correct.
//
// So the check is the other direction: take the classes the kit's OWN files write into the board,
// and ask the assembled stylesheet whether each one is mentioned. A class with no rule anywhere is
// either chrome nobody styled or a class nobody needs, and both are worth a sentence.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = dirname(dirname(fileURLToPath(import.meta.url)));

/** The kit's own markup: everything that writes a class into the board outside a pattern. */
const WRITERS = ['partials.mjs', 'build.mjs', 'contract.mjs', 'overview.mjs'];

/**
 * Classes a file writes into the board.
 *
 * <p>Three shapes, because the kit writes them three ways: a literal `class="a b"`, a literal
 * prefix before a template hole (`class="fr ${...}"`), and a class the sidebar's script toggles
 * (`classList.add('is-picked')`). Only bare kebab-case identifiers are taken — a hole's contents
 * are the board's data, not the kit's vocabulary.
 */
function classesWritten(src) {
  const found = new Set();
  const add = (chunk) => {
    for (const word of chunk.split(/\s+/)) {
      if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(word)) found.add(word);
    }
  };
  for (const m of src.matchAll(/class="([^"$`{}]*)"/g)) add(m[1]);
  for (const m of src.matchAll(/class="([^"$`{}]*)\$\{/g)) add(m[1]);
  for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\('([a-z][a-z0-9-]*)'/g)) add(m[1]);
  return found;
}

/**
 * Classes the sidebar's script reaches by name — a handle, not something anybody sees.
 *
 * <p>These are the one honest exemption, and it is a rule rather than a list: a class the script
 * QUERIES is how it gets hold of an element (`.sb-group`, `.sb-input`), and a container that is
 * only ever a container has no appearance to give it. A class the script TOGGLES is the opposite —
 * `is-off` and `is-picked` do nothing at all unless a rule reads them, which is exactly the defect
 * this gate was written for — so toggling is not an exemption and is not looked for here.
 *
 * <p>The boundary it cannot see: a class that is both a handle and a visible thing would be
 * excused by being queryable. Nothing in the kit is both today, and a chrome class that becomes
 * both is styled by whoever gives it an appearance.
 */
function scriptHandles(src) {
  const found = new Set();
  for (const m of src.matchAll(/querySelector(?:All)?\('([^']*)'/g)) {
    for (const c of m[1].matchAll(/\.([a-z][a-z0-9-]*)/g)) found.add(c[1]);
  }
  return found;
}

/**
 * Every class the kit writes has a rule in the assembled stylesheet.
 *
 * <p>Runs at `built` rather than `preflight` because it reads `ctx.styles`, which is the three
 * layers already concatenated — the kit's, the pattern's, and the board's own. That is the right
 * thing to read: it does not matter WHICH layer carries the rule, only that one of them does.
 */
export const chromeStyledGate = {
  id: 'chromeStyledGate',
  title: '킷이 쓰는 클래스에 규칙이 없다 (킷의 마크업은 킷이 스타일한다 — core/chrome.css)',
  stage: 'built',
  run: (ctx) => {
    const written = new Set();
    const handles = new Set();
    for (const file of WRITERS) {
      const src = readFileSync(join(CORE, file), 'utf8');
      for (const c of classesWritten(src)) written.add(c);
      for (const c of scriptHandles(src)) handles.add(c);
    }
    // A selector mentions a class as `.name` followed by anything that cannot continue the name.
    const styled = new Set();
    for (const m of ctx.styles.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/\.([a-z][a-z0-9-]*)/g)) {
      styled.add(m[1]);
    }
    return [...written].filter((c) => !styled.has(c) && !handles.has(c)).sort();
  },
};
