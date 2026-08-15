# Routing blocks for `simplecore` skills

Three blocks. The **project block** names this repository's board, the way that board reaches code,
and the glossary, and belongs in the project's own instruction file. The **global Korean block** and the **global
local-server block** are path-free and belong in `~/.claude/CLAUDE.md`, where they cover every
project on the machine.

Writing them is what makes the routing durable. The plugin's SessionStart hook announces the same
thing, but a hook only fires where the plugin is installed, while an instruction file travels with
the repository — and a global block covers the sessions that never touch a marked project at all.

`/simplecore:init` writes them. The deeper setup each skill needs — installing the board build
kit, writing the board folder's reading contract, filling the parity list from the board — belongs
to `/simplecore:board-init` and `/simplecore:parity-walk-init`.

---

## Project block

Insert into the project's `CLAUDE.md` (or `.claude/CLAUDE.md`, or `AGENTS.md` when the project
keeps its instructions there). Delete the sections the repository does not have, and replace every
path with what the detector reported.

**A board reaches code one of two ways and a project runs one of them**, so exactly one of
「Building the app from the board」 and 「Walking the board against the app」 is written. The
detector says which: `build` for the first, `parityWalk` for the second.

```markdown
## The wireframe board is the screen contract

Screens are built from the board: the spec decides behavior, the board renders it as
screens / states / flow, the code matches the board. Invoke the `simplecore:wireframe-boards`
skill before implementing a screen from it, checking code against it, syncing it after a change,
or drawing new frames.

- `<board path>/src/manifest.mjs` — the table of contents. Find a screen here, then open that
  one screen file. Never read the built HTML.
- `<board path>/AGENTS.md` — the working rules for this board.

A screen, dialog, state, or flow added during development is back-filled as a frame in the same
change. A design decision that changes needs the design owner's sign-off and updates the spec in
the same breath.

## Building the app from the board

Screens are built from the board in dependency order — one chapter at a time, the file order the
build order, and a chapter closes on its persona tests rather than on its code. Invoke the
`simplecore:board-to-app` skill before building a chapter, running its persona tests, deciding
what may run alongside, or resuming a build. This repository supplies the contents:

- `<chapter directory>` — one file per chapter; the file order is the build order
- `<state ledger path>` — the one place that says which chapter is open, and each persona's
  development account. Read it first; write to it when a chapter changes state
- `.claude/board-to-app.json` — every path, command and heading the build reads

Chapter files are generated from the board, never hand-edited: fix the board and regenerate. A
chapter runs in a subagent, never in the coordinating session.

## Walking the board against the app

Reconciling implemented screens with the board is a long walk across many sessions. Invoke the
`simplecore:board-parity-walk` skill before starting or resuming one — it carries the discipline,
and the walk itself runs in a subagent per cluster so the coordinating session never fills up.
This repository supplies the contents:

- `<parity list path>` — the frames left to walk, and the decisions parked for a human
- `<handover file path>` — how to start and stop the servers, known traps, accounts and data standing
- `.claude/board-parity-walk.json` — names those two for the write-time checks

## Korean output

This project's documents are Korean. Invoke `simplecore:korean-docs` for Korean output, ordinary
answers included, and follow `<glossary path>` for standard translations and banned spellings.
A term decided during a task is registered in the glossary in the same task.

Skills come from the `simplecore` plugin (`claude plugin install simplecore@simplecore-skills`).
When one is not in the `Skill` tool list, install it rather than working from memory.
```

---

## Global Korean block

Insert into `~/.claude/CLAUDE.md`, under the chapter that covers skill usage or output language.
It names no paths, so it applies to every project on the machine.

```markdown
### Korean output

Invoke `simplecore:korean-docs` for virtually every task that produces Korean output — ordinary
answers included, and mandatory for writing, translating, proofreading, reviewing, or auditing a
Korean document.

Before writing the session's first Korean output, read the skill's `references/response-style.md`
and apply it for the rest of the session. It is the single source for vocabulary, orthography, and
tone; do not produce Korean output without having read it. Where a project keeps its own glossary
(`.claude/GLOSSARY.md` or `GLOSSARY.md`), that glossary wins over the baseline.
```

---

## Global local-server block

Insert into `~/.claude/CLAUDE.md`. Screen verification needs a running application, and a session
that has to ask before every restart cannot walk a whole feature area — so the authority is stated
once, globally, with its boundary drawn at the local machine.

```markdown
### Local development servers

For a development server on the local machine (`localhost`, `127.0.0.1`, `[::1]`, or the
development machine's private IP), start, restart, and stop it directly as the work needs. Do not
stop to ask each time.

- **Take the commands from the project**, never from memory: its package scripts, Gradle tasks,
  compose file, or the dev-server section of its own instruction files.
- **Read the port from the server's own output or a readiness probe.** A dev server whose usual
  port is taken moves silently to another one, and a hardcoded port then verifies the wrong thing.
- **Restart rather than reason about staleness.** A screen served from a stale build looks exactly
  like a missing translation or a vanished column; when output disagrees with the source, rebuild
  or restart before writing anything down as a defect.
- **Reclaim a port you own.** When the port is held by a development server from an earlier
  session of this same project, stop that process and start a fresh one. Never kill a process you
  cannot identify as this project's development server.
- **Leave the environment as you found it.** Stop the servers this session started once the work
  no longer needs them, and say which are still running and why when you leave one up.
- **Out of scope**: remote hosts of any kind — production, staging, shared development —
  container orchestrators outside the local machine, and anything serving other people. Ask first.
```
