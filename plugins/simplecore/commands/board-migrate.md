---
description: Migrate an existing wireframe board to the current board contract — ask first, then move it wholesale
argument-hint: "[board directory]"
---

# Migrate a wireframe board

Bring a board built against an older contract up to the current one. The board keeps its frames,
its content and its flows; what changes is where the machinery lives and how frames are numbered.

Invoke `simplecore:wireframe-boards` first and follow it. **Nothing here is written without the
user agreeing to it** — and when they do agree, the board is moved **wholesale**, not partially.
A half-migrated board builds one way in some places and another way in others, and nothing in the
artifact shows which halves.

## 1. Read what the board is on, and what that costs

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json     # --root=<path> when not cwd
cd <board dir> && node wf.mjs doctor        # when the board already has wf.mjs
node "${CLAUDE_PLUGIN_ROOT}/skills/wireframe-boards/kit/bin/wfb.mjs" migrations
```

`migrations` prints every contract, what changed in it, and the steps to cross it — that list is
the migration, written when each change was made rather than reconstructed from a diff now.

- `needsMigration: false` → say the board is already current and stop.
- `board: null` → there is nothing to migrate. Offer `/simplecore:board-init`.
- `board.contractFrom` says where the number came from: `built` the released board carries the
  stamp · `kit` nothing is released yet, so the kit's own value stands in — **not** a migration
  candidate · `null` a released board carries no stamp, which is a genuine contract-1 board.

## 2. Ask — and say plainly what changes and what does not

Put it to the user with **AskUserQuestion**, with the measured numbers in hand. Do not start until
they say yes.

**What does not change:** every frame, every permanent id, every note, the board's structure, the
content of `board.html` apart from the intended differences below.

**What changes**, crossing into contract 3:

| | Before | After |
| --- | --- | --- |
| Where the machinery lives | `tools/` in the board — build, gates, exports, checks | the skill's `kit/`, reached by a 20-line `wf.mjs` |
| Components, shells, styles | `src/components.mjs`, `src/chrome.mjs`, `src/styles.css` in the board | the declared pattern; the board keeps a one-line shim and its own IA data |
| The reading contract | one `src/intro.html` holding all of it | three layers — the kit's standing items, the pattern's, then the board's own |
| Where the contract sits | the top of the board | the **foot** of the board, with a link from the header. The PDF carries none of it |
| Gates | one list in the board | the kit's, then the pattern's, then `board.gates.mjs` for this repository's own |
| The PDF | one file beside the board, swept each build | `pdf/<name>-<stamp>.pdf`, kept, git-ignored |

**What it costs:** the board can no longer be built on a machine without the plugin installed.
Say this out loud — it is the one real trade, and it decides whether a CI job has to change.

For a **contract-1** board, two further decisions come first; both are irreversible once the board
is rebuilt and re-circulated, so do not choose for the user. Measure the drift, put the number in
front of them, and ask which numbering becomes permanent — the file-name ids, or what the board
displays today. `migrations` spells out the rest of that step.

## 3. Move it — every step, in one change

Follow the `steps` the `migrations` output lists for each contract being crossed. For contract 3:

1. **Snapshot the built board first.** `cp board.html /tmp/board-before.html`. It is the only way
   to prove afterwards that the frames did not move.
2. **Read the working tree before deleting anything.** A board in active use has uncommitted
   edits; `git status` and `git diff` name them, and they are carried across, never overwritten.
   Copy `tools/`, `src/partials.mjs` and `src/styles.css` to a scratch directory before removing
   them — those files are the only record of anything the board added.
3. **Split the board's files three ways.** Whatever is true of any board goes to the kit; whatever
   is true of any board drawn this way goes to the pattern; whatever knows this repository stays.
   That last group is usually small: the menu tree, the roles, the CRUD ledger, the gates that
   parse this project's documents.
4. **`src/chrome.mjs` keeps the data and loses the shells.** The pattern exports `makeConsole`,
   `makeWorker`, `makeKiosk`, `makeAuth`, `makeConsolePhone`; the board hands them its tabs, menu,
   roles and purchase and re-exports the finished shells under the names the screens already
   import. **No screen file changes.**
5. **`src/components.mjs` becomes one line** re-exporting the pattern through `.kit`.
6. **`src/intro.html` keeps only the product's own items**, as bare `<li>`. Anything the pattern
   already says is deleted, not restated.
7. **Add `contract: 3` and `pattern:` to `board.config.mjs` LAST.** Raising the number is the
   final act; doing it first makes the build stop reporting what is still undone.
8. `.gitignore` gains `.kit` and `pdf/`; existing PDFs move into `pdf/`.

A component or a gate the board added that the pattern lacks goes **into the pattern**, not into a
local file — that is the whole point of the move, and a board-local copy is a fork by another name.

## 4. Prove the frames did not move

```bash
node wf.mjs build --no-pdf
node wf.mjs gates
node wf.mjs check
```

Then diff against the snapshot and report the numbers:

```bash
ids() { grep -o 'article class="frame[^"]*" id="[^"]*"' "$1" | sed 's/.*id="//;s/"//'; }
diff <(ids /tmp/board-before.html) <(ids board.html) | grep -c '^[<>]'    # must be 0
```

**Only three differences are allowed**: the contract stamp, the reading contract moving to the
foot, and whatever the user asked to change on the way. Anything else is a defect in the
migration, not a result of it.

Where the build refuses, read the finding before touching it: a gate that fires during a migration
is usually reporting something the old board had and nobody could see. Fix the board, never the
gate.

## 5. Report

- which contracts were crossed, and what each one changed
- every id that was reassigned, old → new, so the user can update what they have circulated
- what moved to the kit, what moved to the pattern, and what stayed in the board — by name
- what the verification showed, including the id diff count
- anything left undone, and why

Do not commit. Report; the user commits.
