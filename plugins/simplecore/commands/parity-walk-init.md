---
description: Wire this project for a board-parity walk — config, the two documents, and the instruction-file pointer
argument-hint: "[--parity-list <path>] [--handover <path>]"
---

# Wire a board-parity walk

Set this project up so a board-parity walk can start and, more importantly, so it can be resumed
by a session that has none of this conversation. Invoke `simplecore:board-parity-walk` first and
follow it; this command is the setup it asks for.

Report what already exists before writing anything, then write only what is missing. Show the user
each file you are about to create and get agreement — these are durable documents in their
repository.

1. **Find the project root and confirm there is a board.** Run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json`.

   **`board: null` means stop.** A parity walk reconciles the running app against frames somebody
   drew; with no board there is nothing to walk against, and wiring the walk anyway leaves two
   documents nobody can fill. Say so in one sentence and offer `/simplecore:board-init` instead —
   the board comes first, always. Do not write any of the files below.

   Everything else is relative to the project root.

2. **Check what is already there** and tell the user, one line each:
   - `.claude/board-parity-walk.json`
   - the parity list and handover file it names (or, when there is no config, any plausible
     existing pair — a remaining-screens list, a walker's notes file)
   - a wireframe board, and its source directory
   - a pointer to this skill in `CLAUDE.md` / `AGENTS.md`
   - the project's verification commands (test, typecheck, lint, convention audit)

3. **Write `.claude/board-parity-walk.json`** when it is missing. Copy
   `${CLAUDE_PLUGIN_ROOT}/skills/board-parity-walk/assets/board-parity-walk.json` and set the two
   paths to where the documents live — the arguments if given, otherwise the existing documents you
   found, otherwise `_plans/SCREEN-PARITY.md` and `_plans/WALK-NOTES.md`. Set `parkedSection` to
   the heading the parity list actually uses for parked decisions, written exactly, in whatever
   language the document is written in.

   This file is what turns the write-time checks on. Without it the walk's rules hold only while
   somebody remembers them.

4. **Write the two documents** when they are missing, from
   `${CLAUDE_PLUGIN_ROOT}/skills/board-parity-walk/assets/parity-list.md` and `.../handover.md`.
   Write them in the language the project's other documents use. Then fill the parity list from
   the board: one line per frame that has a route, grouped into sections. Leave the handover file's
   placeholders for the walker to fill on its first session, but fill in anything you can already
   read from the repository — how the servers start, what the verification commands are.

5. **Add the pointer to the instruction file.** This is the step that matters most, because the
   description trigger alone does not survive a fresh session that starts somewhere else in the
   repository. Append to the project's `CLAUDE.md` (or `AGENTS.md` when the project uses that),
   adapting the paths and the language:

   ```markdown
   ## Walking the board against the app

   Reconciling implemented screens with the board is a long walk across many sessions. Invoke the
   `simplecore:board-parity-walk` skill before starting or resuming one — it carries the
   discipline. This repository supplies the contents:

   - `<parity list path>` — the frames left to walk, and the decisions parked for a human
   - `<handover file path>` — how to start the servers, known traps, accounts and data standing
   - `.claude/board-parity-walk.json` — names those two for the write-time checks

   The skill comes from the `simplecore` plugin
   (`claude plugin install simplecore@simplecore-skills`). When it is not in the `Skill` tool
   list, install it rather than working from memory.
   ```

   When such a section already exists, correct it in place rather than adding a second one.

6. **Report what the project still owes**, if anything: no board, no verification command that can
   ratchet a repeated defect into a rule, no route-bearing screens to walk yet. Name them; do not
   invent substitutes.

Do not start walking as part of this command. Setup and walking are separate, and the walk belongs
to a subagent.
