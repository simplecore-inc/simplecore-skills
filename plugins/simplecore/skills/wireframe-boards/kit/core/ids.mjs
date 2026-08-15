// A screen has TWO numbers, and conflating them is what makes a board unusable to talk about.
//
//   - Its ID (A-20) is PERMANENT. It comes from the file name, is assigned once when the screen
//     is born, and never changes — not when a screen is inserted above it, not when the board is
//     reordered, not when a neighbour is deleted. It is what a person, a note, a parity list, and
//     an agent all address the screen by.
//   - Its SEQUENCE ([02]) is the frame's position in the board's visual order, recomputed on every
//     build. It exists so a reader scanning the board left to right can see where they are.
//
// The label prints both, as `[02]A-20`. Deriving the id from the file name leaves exactly one
// source for it, so the two can never disagree the way a position-derived number does.
export const ID_FROM_FILE = /^([a-z])-(\d{2,}[a-z]?)-/;

export const idOf = (file) => {
  const m = ID_FROM_FILE.exec(file);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
};
