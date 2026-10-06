// simplix-basic - the pattern a SimpliX-shaped admin product is drawn in.
//
// It covers all three device classes in one pattern on purpose. A console, the phone app its
// users carry, and the shared terminal in the lobby are one product: they share the components,
// the copy register, the control vocabulary and the CRUD discipline, and splitting them into
// separate patterns would mean deciding, for every gate, which of the three it belongs to -
// a boundary the product itself does not have.
//
//   desktop  console      list-detail over a three-layer shell
//   phone    worker · consolePhone
//   tablet   kiosk        a shared terminal with no session of its own
//   any      auth         the signed-out card
//
// **What is in the pattern and what is in the board.** The pattern owns everything that would be
// the same in a second product drawn this way: the primitives, the shells, the stylesheet, the
// standing reading contract, and the gates that hold the discipline. The board owns its own
// information architecture - the tab list, the menu tree, the roles, the CRUD ledger, what the
// installation bought - and hands them to the shell factories in its `src/chrome.mjs`.
import * as gates from './gates/content.mjs';

export default {
  name: 'simplix-basic',
  title: 'SimpliX admin console · field app · shared terminal',
  description:
    'Draws a list-detail admin console together with the same product\'s phone app, shared terminal ' +
    'and sign-in screens as one set, and holds the screen vocabulary of business software and its ' +
    'Korean register with gates.',

  /** The device classes this pattern draws, and what each one is for. */
  devices: {
    desktop: 'admin console: tabs · section menu · list-detail · status strip at the foot',
    phone: 'field app and the console at phone width: app bar · body · tab bar',
    tablet: 'shared terminal: one task with no session, then back to the idle screen',
  },

  /**
   * The gates every board in this pattern runs, on top of the kit's core gates.
   *
   * <p>Every one of these came from a defect found twice. They are the pattern's rather than the
   * kit's because each judges something only a board drawn THIS way can be wrong about - a
   * register, a list-detail layout, the words its controls share.
   */
  gates: Object.values(gates).filter((g) => g && typeof g.run === 'function'),

  /**
   * What a board must supply for this pattern to draw. Read by `wf.mjs doctor`, which names the
   * missing piece instead of letting the board fail somewhere inside a render.
   */
  requires: {
    'src/chrome.mjs': 'hands this board\'s tabs, menu tree, roles and purchases to the shell factories',
    'src/manifest.mjs': 'the table of contents: sections and the order of the screens in them',
    'src/screens/': 'one file per screen',
  },
  optional: {
    'src/roles.mjs': 'who reaches each frame; without it no role strip is drawn',
    'src/crud.mjs': 'the CRUD ledger; without it the five-verb census does not run',
    'src/intro.html': 'this product\'s own reading-contract items, appended after the pattern\'s',
    'src/styles.css': 'classes this board adds, appended after the pattern stylesheet',
    'board.gates.mjs': 'gates fitted to this product\'s document formats',
  },
};
