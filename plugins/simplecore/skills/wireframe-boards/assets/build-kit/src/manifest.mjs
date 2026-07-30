// The board's table of contents and build order. An author reads THIS first to find
// a screen, then opens only that screen's file under src/screens/. Adding a screen =
// one file + one line here.
//
// A screen's NUMBER lives in its FILE NAME (`a-20-contract-detail` → A-20) and is
// PERMANENT: assigned once when the screen is born, never renumbered when a screen is
// inserted above it, when this list is reordered, or when a neighbour is deleted. That
// is what lets a note, a parity list, a reviewer, and an agent all name the same screen
// and mean the same thing. Do not renumber to close a gap — gaps are free, and a
// renumber invalidates every reference anyone has written down.
//
// This list's ORDER is the board's visual order, and only that. The build prints it as
// the bracketed position on each frame — `[02]A-20` — so reordering changes the brackets
// and nothing else. Reorder freely.
//
// A narrow/wide pair is ONE screen: both halves take the same number, differ only by
// their `variant`, and occupy one position.
//
// `count` (optional) is the exact caption shown after the section title; omit it and
// the build writes "<n> frames", or "<n> screens · <m> frames" when a pair is present.
export default [
  { letter: 'S', title: 'Sample (component composition)', screens: [
    { file: 's-01-sample', label: 'phone — built from components' },
    { file: 's-02-sample-desktop', label: 'desktop — app shell' },
  ] },
  // Add product sections here, in board order:
  // { letter: 'A', title: 'Sign-in', screens: [
  //   { file: 'a-01-login', label: 'sign-in · default' },
  // ] },
];
