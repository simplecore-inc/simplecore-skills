---
description: Detect which simplecore skills bind here, write the routing, and propose the global instructions they need
argument-hint: "[--project | --global] [path]"
---

# SimpleCORE Init

Wire this repository — and, when it is missing, the machine — for the simplecore skills that
actually bind here. Nothing is written without agreement, and nothing is written for a skill the
repository shows no sign of needing.

Two halves, and most projects need both:

- **the project block** in an instruction file, which routes future sessions to the board, to
  whichever way that board reaches code, and to the glossary. It travels with the repository and
  works without the plugin.
- **the global blocks** in `~/.claude/CLAUDE.md`, which carry what no single project can: the
  Korean style baseline that ordinary answers need, and the authority to start and stop a local
  development server without asking each time.

1. Run the detector and read its report:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json
   ```

   Pass `--root=<path>` when `$ARGUMENTS` names a directory other than the current one.

2. **Report what it found in one short paragraph**: which skills bind and on what evidence (the
   board and its kind, the build config with its chapter set and state ledger, the parity-walk
   config and its two documents, the glossary or Korean documents), what `routedBy` already
   covers, and every line of `missing`.

   **A board reaches code one of two ways and a project has picked one** — `build` and
   `parityWalk` in the report say which. Route to the one it has; never propose the other as
   something it is missing, and never write both blocks.

   - No skills bind → say so and stop. Do not write a routing block into a repository that shows
     no marker; offer instead to re-run against a subdirectory, or to draw a board with
     `/simplecore:board-init` if that is what the user is after.
   - `wired: true` → say so and stop. There is nothing to write.

3. Read the block templates:

   ```
   ${CLAUDE_PLUGIN_ROOT}/templates/claude-md-section.md
   ```

4. **Write the project block** for the skills that bind, unless `$ARGUMENTS` says `--global`.
   Target `CLAUDE.md` at the repository root, or the instruction file the repository already
   keeps (`.claude/CLAUDE.md`, `AGENTS.md`). Delete the sections for skills that do not bind, fill
   every path from the detector, and write it in the language the file is already written in.

   Show the exact text and where it goes, then write only after the user agrees. Merge rather than
   overwrite: when a section for that skill already exists, correct it in place; when it does not,
   append it at the file's existing heading level and tone.

5. **Propose the global blocks that are missing**, unless `$ARGUMENTS` says `--project`. These are
   the ones a project cannot supply for itself, so say plainly what each buys and let the user
   decide:

   - **Korean style baseline** — when `globalKorean.present` is false and this project writes
     Korean. Without it, an ordinary Korean answer is written without the style baseline, and the
     korean-docs skill only fires when a task sounds like document work.
   - **Korean habits block** — when `globalKorean.present` is true but `globalKorean.card` is
     false. Routing alone leaves the rules in force only while the file it points at is still in
     context, and a long session keeps the pointer while losing the file — a state that cannot be
     told apart from following them. Offer
     `skills/korean-docs/references/global-korean-card.md` **whole**; summarising it on the way
     recreates the pointer this replaces. It carries its own `<!-- simplecore:korean-habits -->`
     marker, which is what the detector reads next time.
   - **Local development servers** — always worth offering when the repository serves screens (a
     board, a parity walk, or a frontend). Without it, every restart during a screen walk is a
     question, and a walk that has to ask cannot cover a feature area. Say where the boundary
     sits: the local machine only, never a remote host.

   Show each block and its insertion point in `~/.claude/CLAUDE.md`, and write only what the user
   accepts. When a chapter on the subject already exists there, correct it in place.

6. **Hand off the deeper setup.** This command writes routing, not contents. Name the next step
   for each `missing` line it cannot fix itself, and offer to run it now:

   - a board with no build kit, no folder reading contract, or no board at all →
     `/simplecore:board-init`
   - **a board wired to nothing that builds it** → the two ways are alternatives, so say what each
     buys and let the user pick one rather than writing either. `simplecore:board-to-app` builds
     the board chapter by chapter in dependency order and closes each chapter on its persona
     tests, and it needs a chapter set plus `.claude/board-to-app.json` — invoke the skill and
     follow its precondition. `/simplecore:parity-walk-init` wires a walk that reconciles the
     frames against a running app. Both need a board and are offered only where one exists.
   - a chapter set or state ledger the build config names that does not exist →
     `node "$HOME/.claude/skills/simplecore/skills/board-to-app/scripts/bta.mjs" doctor`, which
     reports every declared path
   - a parity list that does not exist, or a missing handover file →
     `/simplecore:parity-walk-init`. A walk configured in a project with no board is wiring to
     remove, not to complete.
   - **both configs declared** → the project is between the two arrangements. Deleting one is the
     user's decision and is never made here; say which one the rest of the repository points at
     and ask.
   - no project glossary → `node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/check-glossary.mjs" --init`

7. **Verify** by re-running the detector: every line you fixed must be gone from `missing`, and
   `routedBy` must name the file you wrote. Report the result, and say that the routing applies
   immediately to anyone reading the instruction file while the SessionStart note changes only for
   new sessions.

Do not commit. Report; the user commits.
