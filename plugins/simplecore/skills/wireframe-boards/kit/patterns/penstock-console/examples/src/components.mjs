// The composition kit, re-exported: the pattern's pure primitives and this board's bound chrome.
//
// **This file is a pointer, not a place to add anything.** A primitive belongs in the pattern, a
// product word in `chrome.mjs`. It exists because the screen files import `../components.mjs`, and
// an ESM re-export needs a STATIC specifier. The two star-exports share no name — the pattern
// exports no chrome under the bound names — so nothing is dropped as ambiguous.
export * from '../.kit/patterns/penstock-console/components.mjs';
export * from './chrome.mjs';
