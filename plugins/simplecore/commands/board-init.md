---
description: Start a wireframe board here — pick the common pattern, scaffold it, and wire the project to it
argument-hint: "[board directory]"
---

# Start a wireframe board

Set this project up so its board is found and read correctly by a session that has none of this
conversation. Invoke `simplecore:wireframe-boards` first and follow it; this command is the setup
it asks for.

**The board holds content and nothing else.** The engine, the gates, the exports, the components
and the app shells live in this skill under `kit/`, and `wf.mjs` — twenty lines — finds them. Do
not write a build script, and do not copy one in.

## 1. Find where it goes, and what is already there

The board directory is `$ARGUMENTS` if given, otherwise an existing board folder, otherwise ask.
A board belongs with the project's planning documents, not at the repository root.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json
```

Report in one line each: whether a board directory exists, whether it has `board.config.mjs`
(kit-built) or a single hand-written HTML file, whether the board folder has `AGENTS.md` and
`CLAUDE.md`, and whether the project's instruction file points at the skill.

- **A kit-built board already here** → this is not the command. Offer `/simplecore:board-migrate`
  when `needsMigration` is true, and otherwise say the board is already set up.
- **A single-file board** → it can be migrated rather than restarted; say so and offer
  `/simplecore:board-migrate`.

## 2. Ask which common pattern — this is the one question

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wireframe-boards/kit/bin/wfb.mjs" patterns
```

Put the list in front of the user with **AskUserQuestion** and let them choose. A pattern decides
the components, the app shells, the stylesheet, the reading-contract items and the gates every
frame is held to, so it is not a default to slip past them — and changing it later means redrawing
every frame.

**A subagent has nobody to ask.** Where the dispatch that sent it here named the pattern, that is
the answer and it goes on, writing the choice and its grounds into the report. Where nothing named
one, it stops with the list and what each pattern is for — scaffolding a board on a guessed pattern
is the one thing here that cannot be undone cheaply.

Say what each one is for, in one line, from the `patterns` output. `simplix-basic` is the SimpliX
admin shape: a list-detail console, the phone app its users carry, and the shared terminal, all
three in one pattern because they are one product.

Ask **one more thing in the same call**: whether to keep the pattern's starter frames.

| | What it means |
| --- | --- |
| **Keep them** (recommended) | Nine frames — sign-in, a dashboard, a list-detail with its create and empty states, two phone frames, two terminal frames. Each is an answer to a question the board will be asked on its first day. Draw over them. |
| **Empty board** | Only the scaffolding. Right when the screens are about to be authored from a specification and nine frames about records would be nine frames to delete. |

## 3. Scaffold it

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wireframe-boards/kit/bin/wfb.mjs" init \
  --board <board dir> --pattern <chosen> --name "<product name>" [--no-examples]
```

It writes `wf.mjs`, `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `board.config.mjs`, `src/chrome.mjs`,
`src/components.mjs`, `src/intro.html`, `src/manifest.mjs` and the starter screens. **Nothing
already there is overwritten** — it reports what it kept.

Then prove it works, and show the user:

```bash
cd <board dir> && node wf.mjs build --no-pdf && node wf.mjs check
```

## 4. Make it this product's

The scaffold is generic on purpose. Walk these with the user rather than guessing:

- `board.config.mjs` — `headline`, `boardName`, `pdfName`, and `today` (the day every dated frame
  is read against). Delete the `phases` entry if nothing is deferred yet.
- `src/chrome.mjs` — the tabs, the menu tree, which role reaches what. This is the product's
  information architecture; the placeholder one draws two tabs and three clusters.
- `AGENTS.md` — the region under the marked line is theirs. Everything above it describes the kit
  and the pattern and is replaced wholesale on the next migration, so a rule written above the
  marker is a rule that will be lost.

## 5. Point the project at the board

This is the step that matters most: the description trigger alone does not survive a session that
starts elsewhere in the repository. Append to the project's `CLAUDE.md` (or `AGENTS.md` where the
project uses that), adapting the paths:

```markdown
## The wireframe board is the screen contract

Screens are built from the board: the spec decides behavior, the board renders it as
screens / states / flow, the code matches the board. Invoke the
`simplecore:wireframe-boards` skill before implementing a screen from it, checking code
against it, syncing it after a change, or drawing new frames.

- `<board path>/src/manifest.mjs` — the table of contents. Find a screen here, then open
  that one screen file. Never read the built HTML.
- `<board path>/AGENTS.md` — the working rules for this board.
- The board carries no build script. `node wf.mjs <command>` from the board folder; the kit
  lives in the skill.

A screen, dialog, state, or flow added during development is back-filled as a frame in the
same change. A design decision that changes needs the design owner's sign-off and updates
the spec in the same breath.

The skill comes from the `simplecore` plugin
(`claude plugin install simplecore@simplecore-skills`). When it is not in the `Skill` tool
list, install it rather than working from memory.
```

When such a section already exists, correct it in place rather than adding a second one.

## 6. Offer the parity walk when the code already serves frames

Reconciling them is its own long job with its own wiring — say so once and point at
`/simplecore:parity-walk-init`.

Do not draw product frames as part of this command. Setup and authoring are separate.
