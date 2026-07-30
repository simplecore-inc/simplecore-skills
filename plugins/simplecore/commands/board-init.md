---
description: Wire this project for a wireframe board — the build kit, the folder reading contract, and the instruction-file pointer
argument-hint: "[board directory]"
---

# Wire a wireframe board

Set this project up so its board is found and read correctly by a session that has none of this
conversation. Invoke `simplecore:wireframe-boards` first and follow it; this command is the setup
it asks for.

Report what already exists before writing anything, then write only what is missing. Show the user
each file you are about to create and get agreement — these are durable files in their repository.

1. **Find the project root** (the nearest ancestor holding `.git`) and the board directory: the
   argument if given, otherwise an existing board folder, otherwise ask where it should live.
   A board belongs with the project's planning documents, not at the repository root.

2. **Check what is already there** and tell the user, one line each:
   - the board directory, and whether it has `src/manifest.mjs` (built from the kit) or a single
     hand-written HTML file
   - `AGENTS.md` in the board folder
   - a folder `CLAUDE.md` pointing at that `AGENTS.md`
   - a pointer to this skill in the project's `CLAUDE.md` / `AGENTS.md`

3. **Install the build kit** when the board has more than roughly twenty frames, or repeats chrome
   across frames, and no `src/` exists yet. Copy
   `${CLAUDE_PLUGIN_ROOT}/skills/wireframe-boards/assets/build-kit/` into the board directory and
   follow its `README.md`. For a smaller board, `assets/board-template.html` is the skeleton
   instead, and the rest of this command still applies.

4. **Write the folder reading contract** when missing: `AGENTS.md` in the board folder holding the
   board-reading contract, the source layout, and the build commands; and a folder `CLAUDE.md`
   that points at it. Both must say, in the imperative, that the built HTML is not to be opened —
   it is a thousands-of-lines artifact — and that finding a screen means reading `src/manifest.mjs`
   and then the one screen file. The kit ships both as templates.

5. **Add the pointer to the project instruction file.** This is the step that matters most: the
   description trigger alone does not survive a session that starts elsewhere in the repository.
   Append to the project's `CLAUDE.md` (or `AGENTS.md` when the project uses that), adapting the
   path and the language:

   ```markdown
   ## The wireframe board is the screen contract

   Screens are built from the board: the spec decides behavior, the board renders it as
   screens / states / flow, the code matches the board. Invoke the
   `simplecore:wireframe-boards` skill before implementing a screen from it, checking code
   against it, syncing it after a change, or drawing new frames.

   - `<board path>/src/manifest.mjs` — the table of contents. Find a screen here, then open
     that one screen file. Never read the built HTML.
   - `<board path>/AGENTS.md` — the working rules for this board.

   A screen, dialog, state, or flow added during development is back-filled as a frame in the
   same change. A design decision that changes needs the design owner's sign-off and updates
   the spec in the same breath.

   The skill comes from the `simplecore` plugin
   (`claude plugin install simplecore@simplecore-skills`). When it is not in the `Skill` tool
   list, install it rather than working from memory.
   ```

   When such a section already exists, correct it in place rather than adding a second one.

6. **Offer the parity walk when the board has frames the code already serves.** Reconciling them
   is its own long job with its own wiring — say so once and point at
   `/simplecore:parity-walk-init`.

Do not draw frames as part of this command. Setup and authoring are separate.
