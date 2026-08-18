---
description: Wire this project to build its board chapter by chapter — the config, the tracking files, the evidence folder, and the instruction-file pointer
argument-hint: "[--chapters <dir>] [--evidence <dir>]"
---

# Wire a board-to-app build

Set this project up so its wireframe board can be built chapter by chapter and, more importantly,
so a session holding none of this conversation can pick the next chapter up. Invoke
`simplecore:board-to-app` first and follow it; this command is the setup it asks for.

**This is for any project that has a board**, whatever else it already has. A project with no
chapter set gets everything; a project with thirty-six chapters, three tracking files and a green
config gets whatever is missing and a report — **and the more that is already there, the shorter
this command runs.** Step 2 counts what exists and step 3 writes only the rest.

**Do not read a half-wired project as out of scope.** A project that has most of this and cannot
finish a chapter is exactly the one that needs the pass: everything present reads as done, and the
one absent piece is invisible precisely because nothing else is. A project whose config was green
on twenty-nine keys still could not close a chapter, twice.

Coming off a board-parity walk is a different move with different costs, and it is reserved for the
user's own words — `skills/board-to-app/references/migrating-from-a-walk.md` says why and what it
discards. When you find a walk here, say so and stop.

Report what already exists before writing anything, then write only what is missing. Show the user
each file you are about to create and get agreement — these are durable documents in their
repository.

1. **Find the project root and confirm there is a board.** Run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json`.

   **`board: null` means stop.** Chapters are cut from frames; with no board there is nothing to
   cut and the chapter set would be a folder of headings nobody can fill. Say so in one sentence
   and offer `/simplecore:board-init` — the board comes first, always.

   **An application with no screens yet is the normal starting point**, not a reason to wait. That
   is what the chapters are for.

   **A board before the current contract is a different matter, and it is the one thing here that
   is worth stopping for.** Every check the kit holds — permanent ids, balanced markup, reachability,
   the documents agreeing with the board — reaches a board through the kit, so a board that builds
   itself is a board none of them has ever read. Chapters cut from it are cut from frames nothing
   has checked. **Say so, name `/simplecore:board-migrate`, and let the user decide whether to
   migrate first or wire the build over a board that is not yet held.** Where the board's components
   are mostly its own, `node wf.mjs pattern adopt` is the step that makes the migration possible at
   all — `skills/wireframe-boards/references/build-kit.md` § *A board may carry its own pattern*.

2. **Check what is already there** and tell the user, one line each:
   - `.claude/board-to-app.json`
   - a chapter directory and its overview
   - the three tracking files — the state ledger, the handover notes, the open items
   - an evidence folder
   - **whether the board is built BY THE KIT and at its current contract** — run
     `node <kit>/bin/wfb.mjs migrations` for the steps and `node wf.mjs doctor` in the board folder
     for where it stands. **A board with its own `build.mjs` and no `board.config.mjs` is before
     the contract**, which means no kit gate has ever reached it
   - a pointer to this skill in `CLAUDE.md` / `AGENTS.md`
   - the project's verification commands (build, typecheck, lint, convention audit, the board's own)

3. **Write `.claude/board-to-app.json`** from
   `${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/assets/board-to-app.json`, setting each path to where
   the thing actually is. Then run `node
   "${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/scripts/bta.mjs" doctor` and read its grades:

   - `✖` — required, and nothing works until it is declared.
   - `◑` — **every chapter needs it to CLOSE.** Everything runs, nothing finishes. Five keys carry
     it, and they are one decision rather than five: `evidenceDir` says where a result document
     goes, and `chapterLines`, `evidenceLabels`, `closedStatus` and `verdictRole` are the words
     every check over that document compares. A build with a page of green that cannot end a
     chapter is what this grade exists to stop being invisible. **The two markup conventions are
     opposite and the template says so on each key**: a `chapterLines` phrase is the line as
     written, markup included, and an `evidenceLabels` value is the word alone, because the checks
     add the emphasis themselves. Declared the wrong way round, they match nothing and report the
     same zero as a project with nothing wrong.
   - `◐` / `●` — a key some chapter promised in `deferredKeys`; the second says its subject now
     exists, so the promise is due.
   - `○` — the project does not use that.

   **Leave out a key whose subject does not exist rather than inventing a path**, and where a later
   chapter will create it, name that chapter in `deferredKeys`. An invented path is worse than an
   absence: the absence is reported and the invention is not.

4. **Create the evidence folder and its index.** A chapter closes on evidence, so a project with
   nowhere to put it closes nothing. **Read
   `${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/references/evidence.md` first** — it is the
   specification: the shape of a section, the three labels, the capture naming and both ceilings,
   one picture per content pane, and what to do when a board fix moves what a closed chapter
   quotes. Write the folder named by `evidenceDir` and an `00-overview.md` in it that carries only
   what the specification cannot: **the project's own worked examples**, using frames it actually
   has — an id from somebody else's board names nothing here — the commands it runs while a screen
   is open, and **the table saying whose eyes take each of the three readings no machine makes, and
   at which moment.** That table is the project's because it is a staffing decision; everything
   else is in the reference and is not copied out of it.

5. **Write the three tracking files** when they are missing, in the language the project's other
   documents use. Each answers one question and no other, and each has a key: the state ledger
   (`stateLedger`) says which chapter is open and what runs beside it; the handover notes
   (`handoverFile`) say what an agent working a chapter worked out; the open items
   (`openItemsFile`) say what a person has to decide. **Progress lives in these and nowhere else**
   — a design document that carries a status column goes stale silently.

   **A fourth is written only where the project needs one, and it has no key.** Where several
   numbering schemes share one shape — a frame `A-01`, a cluster group `S1`, a statutory code
   `E-9`, an equipment tag `A-3` — a numbering document says which scheme a given `X-N` belongs
   to, and the project's own gates enforce it. A project with one scheme has nothing to write down.
   **No key, because nothing here reads it**: the schemes are the project's and only the project's
   gates can hold them, so a key would be a promise this skill could never keep. Say which of the
   two the project is, rather than leaving the fourth file unexplained.

6. **Generate the chapter set** if the project declares a `chapterGenerator`, and otherwise say
   that it owes one. A chapter set written by hand drifts from the board the first time a frame
   changes, and nothing reports it.

7. **Add the pointer to the instruction file.** This matters most: the description trigger alone
   does not survive a fresh session that starts elsewhere in the repository. Append to `CLAUDE.md`
   (or `AGENTS.md`), adapting the paths and the language:

   ```markdown
   ## Building the app from the board

   The board is built chapter by chapter in dependency order. Invoke the
   `simplecore:board-to-app` skill before building a chapter, running its persona tests, planning
   a wave, or resuming — it carries the coordination discipline. This repository supplies the
   contents:

   - `<chapter dir>/00-overview.md` — the chapter table; the file order is the build order
   - `<state ledger>` — the one place that says which chapter is open
   - `<evidence dir>/00-overview.md` — what a chapter's verification leaves behind
   - `.claude/board-to-app.json` — the paths, and what each chapter passes before it closes

   The skill comes from the `simplecore` plugin
   (`claude plugin install simplecore@simplecore-skills`). When it is not in the `Skill` tool
   list, install it rather than working from memory.
   ```

   When such a section already exists, correct it in place rather than adding a second one.

8. **Prove a chapter can close, by watching the refusal.** Everything above can be green and the
   arrangement still finish nothing — that is precisely what the `◑` grade means, and a report
   saying 「all keys declared」 is not evidence that the checks behind them work. **So close one
   chapter on paper and watch the gates say no.**

   Pick a chapter that is genuinely unfinished, write the ledger's closed word into its row, run
   `bta.mjs check`, and read what comes back. It should name the missing result document, and — if
   that chapter places frames — the captures nothing shows. **Then put the row back.**

   **Where anything else may be running, do not edit the real ledger at all.** It is the one file
   every agent reads, and a row that is wrong for ten seconds is a row somebody else can read or
   commit. Copy it, point a config of your own at the copy, and leave the shared file alone:

   ```bash
   cp <state ledger> /tmp/prove-STATE.md          # then write the closed word into one row of the copy
   # a config beside it, identical but for `stateLedger`, with the other paths made absolute
   node <kit>/bta.mjs check --config /tmp/prove/.claude/board-to-app.json
   ```

   The gates read the real board, the real chapters and the real evidence folder; only the ledger
   is yours. **Read only the gate you are proving** — a scratch root makes the git-reading and
   document-link gates report on a repository that is not there, and those findings are the
   harness rather than the project.

   **You know the wiring works because it refuses the opposite.** A check that passes proves
   nothing about itself: silence is what a working check and a check that reads nothing both
   produce. Report which chapter you tried, what was refused, and that the row was restored.

9. **Report what the project still owes.** Name each and do not invent a substitute: no way to
   reach an arbitrary frame in an arbitrary state with the moving parts pinned (without which every
   re-capture is a change nobody can read); no verification command that can ratchet a repeated
   defect into a rule; no `projectGates` file, so the next mechanically visible defect has nowhere
   to become a check. Having no screens built is not a debt — it is the work.

Do not start building as part of this command. Setup and building are separate, and a chapter runs
in a subagent.
