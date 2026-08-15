// The composition kit, re-exported from the pattern this board declares.
//
// **This file is a pointer, not a place to add anything.** Every primitive lives in the pattern
// inside the `simplecore:wireframe-boards` skill, so a component added there reaches every board
// on that pattern and a component added here would reach one.
//
// It exists at all because screen files import `../components.mjs`, and an ESM re-export needs a
// STATIC specifier — it cannot resolve a path at run time. `.kit` is the machine-local link
// `wf.mjs` re-points on every run; it is not committed.
export * from '../.kit/patterns/simplix-basic/components.mjs';
