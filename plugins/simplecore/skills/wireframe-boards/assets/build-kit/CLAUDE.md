# This folder is the {{PRODUCT}} wireframe board

<!-- TEMPLATE: copy into your board folder and replace {{PRODUCT}}. Claude Code
     auto-loads a folder CLAUDE.md, so this is what steers an agent to the source
     instead of the heavy build output. -->

Read [`AGENTS.md`](./AGENTS.md) before working here — it is the authority on the
board-reading contract, the source layout, and how to build.

- **Do not open `board.html` to read it.** It is a thousands-of-lines build output;
  reading it whole just floods context. To find a screen, read `src/manifest.mjs` (the
  table of contents), then open the one `src/screens/<num>.mjs` you need and the
  components it composes from.
- Screens are addressed by **number** (e.g. `A-02`). A new screen = one file in
  `src/screens/` + one line in `manifest.mjs`. Preview with `node build.mjs` →
  `_proof.html`.
- The board is maintained with the `wireframe-boards` skill — when screens, states, or
  flow change, update the board in the same change.
