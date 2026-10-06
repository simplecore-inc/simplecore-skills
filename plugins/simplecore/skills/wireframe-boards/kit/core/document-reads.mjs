// Which declared documents something actually read.
//
// A board declares a document under `board.config.mjs` `documents` so a gate holds the board to
// it. A key no gate reads holds the board to nothing, and a board in that state looks exactly like
// one whose documents agree with it: every gate is green because none of them looked. That is the
// state a board reaches when the gate that parsed a document moves out of the kit, or when a key
// is misspelled, so the build names it instead of ignoring it.
//
// The record is taken at the point of reading rather than declared beside each gate, so a gate in
// a board's own `board.gates.mjs` is counted the same way as the kit's without saying anything.
import { CONFIG_CHANGES } from './migrations.mjs';

/**
 * Replace `config.documents` with a view that records every key read through it.
 *
 * @param config the loaded board config; its `documents` object is wrapped in place
 * @returns `{ declared, unread() }` - the declared keys, and the ones nothing has read so far
 */
export function trackDocuments(config) {
  const declared = config.documents;
  if (!declared || typeof declared !== 'object') return { declared: [], unread: () => [] };
  const seen = new Set();
  config.documents = new Proxy(declared, {
    get(target, key, receiver) {
      if (typeof key === 'string') seen.add(key);
      return Reflect.get(target, key, receiver);
    },
  });
  const keys = Object.keys(declared);
  return { declared: keys, unread: () => keys.filter((k) => !seen.has(k)) };
}

/**
 * One notice per declared document nothing read, with the step that applies where a recorded
 * change explains it.
 *
 * @param reads what {@link trackDocuments} returned
 * @returns the lines to print, empty when every declared document was read
 */
export function unreadDocumentNotices(reads) {
  const out = [];
  for (const key of reads?.unread() ?? []) {
    out.push(`notice: documents.${key} is declared in board.config.mjs and no gate read it - the board is held to nothing by it`);
    const change = CONFIG_CHANGES.find((c) => c.documentsKey === key);
    if (change) {
      out.push(`  ${change.title}`);
      for (const s of change.steps) out.push(`    · ${s}`);
    } else {
      out.push('    · Write a gate in board.gates.mjs that reads it, with its two cases, or remove the key.');
    }
  }
  return out;
}
