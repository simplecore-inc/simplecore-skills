// penstock-console - the application-window pattern: a fixed window whose panes scroll inside
// themselves, drawn with the penstock console's shell (title bar · navigator · work pane ·
// inspector · status bar). For a product that is an APP - installed, or running in a browser as
// one - rather than a page-scrolling site. The same pattern draws the installed program's own
// window (`chrome: 'app'` with `appTitle`) and its tray menu (`chrome: 'none'`).
//
// Every product-bound piece (brand, navigation tree, palette, status bar, sample activity) comes
// from the board's `src/chrome.mjs` through `makeChrome`, so a second product shares the shell
// without sharing the words.
export default {
  name: 'penstock-console',
  title: 'penstock console shell · a fixed-window app',
  description:
    'Draws a fixed window (1440×900) of title bar · navigator · work pane · inspector · status bar. ' +
    'The panes scroll rather than the page, and one pattern draws an installed program\'s window, ' +
    'its tray menu and an app running in a browser.',

  /** The device classes this pattern draws. One: a desktop window. */
  devices: { desktop: '1440×900 fixed window: title bar · navigator · work · inspector · status bar, scrolling inside the panes' },

  /**
   * The gates every board in this pattern runs, on top of the kit's core gates.
   *
   * <p>Empty to begin with, and that is honest rather than finished: the core gates already hold
   * the permanent id, balanced markup, reachability and the documents. A rule true of every frame
   * drawn THIS way - a copy register, a layout discipline, a control vocabulary - belongs here,
   * and each one added is a defect that cannot come back.
   */
  gates: [],

  requires: {
    'src/chrome.mjs': 'hands this board\'s brand, navigation tree, palette, status bar and sample activity to makeChrome',
    'src/manifest.mjs': 'the table of contents: sections and the order of the screens in them',
    'src/screens/': 'one file per screen',
  },
  optional: {
    'src/intro.html': 'this product\'s own reading-contract items, appended after the pattern\'s',
    'src/styles.css': 'classes this board adds, appended after the pattern stylesheet',
    'board.gates.mjs': 'gates fitted to this product\'s document formats',
  },
};
