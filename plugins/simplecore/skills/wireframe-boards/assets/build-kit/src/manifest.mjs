// The board's table of contents and build order. An author reads THIS first to find
// a screen, then opens only that screen's file under src/screens/. Adding a screen =
// one file + one line here. Screen numbers are assigned by position within a section
// (S-01, S-02, then A-01, …), so they stay human- and LLM-addressable.
//
// `count` (optional) is the exact caption shown after the section title; omit it and
// the build writes "<n> frames".
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
