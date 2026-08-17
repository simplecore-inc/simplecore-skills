# Arriving from a board-parity walk

**Reading this page does not authorise executing it.** The move runs only when the user asks for
it in so many words — naming the move off the walk and onto the chapters, in their own words. A
request to build the next chapter, to fix a screen, or to set the project up is not that request,
and neither is finding a repository that would plainly be better off here. Where the situation
fits, **propose it and stop**: say what the move involves, and wait to be asked.

**Why this one is reserved when almost nothing else here is.** Everywhere else this skill holds
that the next action is derivable and is taken without asking. A migration is not derivable from
inside the repository: it rewrites how a team works and discards the documents they have been
maintaining, and no file in the project says whether they want that. It belongs to the class the
skill already reserves for a person — a decision that changes what the product is — and the
autonomous disposition every other page instills is exactly what will talk itself past this one.

A project reconciling its board frame by frame with `simplecore:board-parity-walk` moves here by
deciding its chapters, declaring one config, and retiring the arrangement it was on — which is more
than the one file that turns the walk's hooks off → *The walk leaves more behind than its two
documents*. **This is the only page in this skill that names that skill** — everywhere else this
skill describes building from a board, and a project that never walked reads none of this.

**A project declares one of the two configs, never both.** Both present means two documents claim
to say what is left, and one skill's write-time gates hold a document the other has stopped
maintaining. The two skills coexist for as long as different projects run different ones; inside
one project the move is a change, not a period.

## What transfers

| | Where it lands |
| --- | --- |
| **The board** | unchanged — same frames, same permanent ids, same sources. Both skills read the sources and neither reads the built HTML |
| **Five config keys** | `handoverFile` · `logDir` · `capturesDir` · `narrativePhrases` · `frameDeliverables`, copied verbatim into `.claude/board-to-app.json` |
| **The handover file** | the same file, under the same key, with the same discipline — facts in plain declaratives, corrected in place |
| **What those paths are called** | renamed wherever the name says the walk. The file and the directory transfer; the retired arrangement's name does not → *The walk leaves more behind than its two documents* |
| **Captures already taken** | already named the one way. The naming contract is this skill's (`references/driving-the-product.md`) and the walk points at it, so nothing is renamed |
| **The parked decisions** | out of the parity list and into `openItemsFile`, under `openItemsHeading` |
| **The frame list** | nowhere. An open chapter already says which of its frames are not yet built and tested, in the file that also says in what order and who tests them |
| **What the walk built** | nothing as state → *Work already done is not migrated as state*, below |

The five keys mean in this skill exactly what they meant in the walk, down to the failure each one
prevents:

| Key | The same in both |
| --- | --- |
| `handoverFile` | the one shared file of facts every agent reads before it starts. `handoverGate` refuses the point-of-view phrasing the walk's write-time check refused |
| `narrativePhrases` | the project's additions to that refused list, for a project writing in neither Korean nor English |
| `logDir` | one agreed, ignored directory, one file per agent, one line appended per step. What it is called is the project's to choose, except where the name says the walk — that one is renamed in step 6; the ignore rule moves with it either way |
| `capturesDir` | one agreed, ignored directory under the fixed capture name, one folder per language |
| `frameDeliverables` | what a screen owes beyond working code, one checkable sentence each. The unit it holds up renames: an unmet deliverable kept a frame on the parity list, and here it keeps the chapter from closing |

**`parityList` and `parkedSection` are not keys this skill reads, and a leftover one fails the
config gate by name.** The parked half has a successor — `openItemsFile` with `openItemsHeading` —
and the frame list has none, because the chapter set answers it. So the new config is written from
`assets/board-to-app.json` rather than edited out of the old one:

```text
✖ configGate — the declared config is incomplete, mistyped, or points at nothing
   parityList is not a key this skill reads — a mistyped key is silent; a note starts with //
   parkedSection is not a key this skill reads — a mistyped key is silent; a note starts with //
```

## The precondition: a board the kit can still build

**Run the board's own build and gates before anything else, and start from green.** Every judgment
in a migration is made against the contract the board renders, so a board the kit can no longer
build turns one piece of work into two, with the second one hidden underneath the first. Where the
board is behind the current contract, that upgrade comes first → `simplecore:wireframe-boards`.

**The walk is also not mid-cluster.** Finish or discard whatever a walker left half-done and commit
it, so the tree the first chapter is compared against is one somebody wrote on purpose.

## Deciding the chapters is the step nothing produces for you

**Nothing the walk leaves behind yields the chapter boundaries, and nothing in this skill computes
them.** The walk's unit is a cluster — the frames that have to be seen together for a disagreement
among them to show up — and its order is the board's. A chapter is a unit that can be tested on its
own, and its order is what must exist before it. A parity list groups frames by board section,
which is a subject index; grouping by subject is what this skill's dependency order exists to
replace. So the boundaries are decided once, by hand, and everything after that is mechanical.

Two passes produce them.

**1. Placement — every frame belongs to exactly one chapter.** The boundary sits where the chapter
can be tested on its own, standing on the chapters before it and on nothing after them. A chapter
whose test cannot run without a screen from a later chapter is drawn in the wrong place; either the
screen belongs here or the two chapters are one.

**2. Entity ownership — which chapter's migrations own which table.** This is what the order is
computed from, and it is the reason a derived graph of frame-to-frame links is not enough: screens
say what they expect of each other, never what a table needs from another table. Each chapter
carries three lines:

| Line | What it holds |
| --- | --- |
| **creates** | this chapter's migrations own the table |
| **uses** | this chapter's tables point at it with a foreign key, or its screens read that record in a list, a detail or a picker |
| **attaches later** | a chapter after this one creates it, and it reaches these screens once that chapter closes |

**One question separates them: must that table already exist while this chapter is built?** If it
must, it is *uses*; if the chapter closes without it, it is *attaches later*. A dashboard tile
counting a later chapter's records and a runtime capability check read no record and are neither.

Then the order falls out — the chapter that creates an entity comes before every chapter that uses
it — and one invariant says the pass is finished: **no chapter uses an entity a later chapter
owns.** A violation means the order is wrong or the table belongs to an earlier chapter; the third
line exists so that nothing is written loosely into *uses* to slip past the check.

`parallelWith` falls out of the same two passes: chapters that reference neither each other's
entities nor each other's frames. On a product built in layers most of those are empty, and empty
means the chapters run in turn rather than that something is wrong.

## The generator is the project's to write

`chapterGenerator` names a command that reads this project's board layout, so it does not ship with
this skill and a migrating project writes it. **Name it as work rather than meeting it at the first
regeneration**: without it a chapter cannot be regenerated after a board fix, and every close
regenerates the graph.

It reads the placement, the board and the persona map, and writes per chapter the header — previous
chapter, the state it leaves, prerequisites, `parallelWith`, entities, `usedLater`, `promises` — and
per screen one build line plus one test line per persona, quoting that frame's own tabs, counts,
messages and primary action. The hand-authored sections it preserves are the chapter's heading, what
the chapter creates, and `touchedEarlier`.

## Work already done is not migrated as state

**Every chapter starts open**, however many of its screens the walk already built.

A chapter closes on its persona tests, not on its code. A screen the walk built and judged makes a
chapter cheap to close; it does not close it. The distinction is exact rather than cautious: a walk
judges each frame in character, by the three personas that stand on any board, but **the chapter's
own persona lines cannot have been run, because they do not exist until the chapter set is
generated** — one line per persona that reaches the screen, quoting what that frame draws, run
signed in as that persona with that persona's account.

So the first pass over an already-built chapter is a comparison against the board, then the persona
run, then the ordinary close. This is what makes the migration cheap: nothing has to reconcile a
shrinking list against a growing chapter table, because there is no list.

**Write into the handover file that the screens exist.** One present-tense fact — which frames are
already built, and that a chapter naming them is compared against the board before anything is
built. That file is what every builder reads before it touches anything, it survives many authors,
and the sentence is corrected in place as it stops being true. It does not go in a brief: a brief
carries what is true of one agent, and this is true of every one of them until it is false for all.

## The walk leaves more behind than its two documents

**Two documents and one config is what the move plans for, and it is not everything the walk put
in the repository.** Two other things carry it, neither of them a document, and both are invisible
to a step that repoints instruction files:

| What still carries the walk | What it costs, and where it is handled |
| --- | --- |
| **what a transferred path is called** — the handover file and the log directory keep whatever the walk named them | a session searching the repository for the walk's name finds a living document and a living directory, and reads the walk as still running. Renamed in step 6, with its config key, its ignore rule and every pointer at it |
| **a program that opens one of the two documents by path** — a script, whatever the project's gate runs, a design document, an instruction file | it says nothing at all while the file is there and fails the moment it is gone, inside whatever runs it. Found in step 7, moved or retired in the commit that deletes them |

**Both come from one premise**: that the walk exists in the repository as two documents and a
config, so removing those three removes it. A file's *name* is outside that premise, and so is
every program that opens those paths.

> **Read it that way and the migration lands broken**: 「the instruction file names the chapters
> now, so nothing points at the walk any more」 — while `docs/walk-notes.md` and `.walk-logs/` still
> say its name in every path anybody greps, and a script inside the project's gate opens the parity
> list by path and asks `git log -S` when a line left it. The pointer was the half a person can see.

## The order of operations

Each step ends with what proves it landed. **Delete nothing until the step after it is green** — at
every point in this order one of the two skills is working, and a project is never left with
neither.

| | Step | Proof |
| --- | --- | --- |
| 1 | The board builds and its gates pass | the board's own kit |
| 2 | Decide the placement and the entity ownership. Write the chapter overview and the state ledger, every chapter open | the invariant: no chapter uses an entity a later chapter owns |
| 3 | Write `.claude/board-to-app.json` from `assets/board-to-app.json`. Carry the five keys verbatim; leave out what the project does not have yet rather than inventing a path. **Read `bta.mjs doctor` over it** — the `✖` rows and the deferrals are what says whether it is finished | `bta.mjs check` — `configGate` names every required key that is absent and every declared path that is not there |
| 4 | Run `chapterGenerator`, and give every chapter a row in the ledger | `bta.mjs check` — `ledgerGate` names a chapter the ledger does not |
| 5 | Move the parked decisions into `openItemsFile`, one line each in three parts | `bta.mjs check` — `openItemsGate` reads the heading and the shape |
| 6 | Point the project's instruction file at this skill, and stop pointing it at the walk. **Rename every transferred path whose name still says the walk** — the handover file and the log directory among them — carrying its config key, its ignore rule and every pointer at it in the same step | a session that starts anywhere in the repository reaches the chapters, and a search for the walk's name returns nothing the project still maintains |
| 7 | **Find every program that opens the two documents or the walk's config by path** — the project's own scripts, whatever its gate runs, the design documents, the instruction files. Move each onto what answers its question now — the chapter set, the state ledger, `openItemsFile` — or retire it | searching the tree for both paths returns the two documents and nothing that reads them |
| 8 | Delete `.claude/board-parity-walk.json` and the parity list, in the same commit as the change that carries their content | `bta.mjs check` still green, the walk's hooks silent, **and the project's own gate green run whole** — every command in it, not the one that looks related |

**`doctor` is a report and `check` is the proof, and step 3 is where the two get confused.** They
are different instruments. `doctor` prints what the project declares and what it owes — every key
with its `✔` or `✖`, every deferral with the chapter that owes it — and **it exits zero on anything
it prints**; a config it cannot find at all stops earlier, at 2, and that is the only status it
tells apart. So its exit status says nothing about whether the config is complete, and a step that
reads a proof off it is reading a guarantee the command never offered. `check` is the half that
fails: a required key absent, a declared path that is not there. Read `doctor`, exit on `check`.

**Steps 7 and 8 are one commit, not two.** The deleted lines, the lines that received them, and the
readers moved off them stand side by side in one diff, which is the only place anything dropped in
the move shows up. Say in the commit body what went where.

**Step 7 has no natural stopping point**, because a reader that is about to break looks exactly
like a file nobody has opened in a year. Search by path rather than by name — a script names
`docs/screen-parity.md`, not "the parity walk" — and search everything the gate runs before
anything else, since a broken reader there stops the whole repository rather than one command.

### Where the two documents' content goes

| From | To |
| --- | --- |
| the parity list's frame list | the chapter set — deleted rather than moved, because `chapterDir` and the ledger already answer it |
| the parity list's parked section | `openItemsFile`, under `openItemsHeading` |
| the handover file's facts — servers, traps, accounts, standing data | the same file, under `handoverFile` |
| the handover file's list of commands a section must pass | `gates`, where a close reads each one by its exit status. A copy left behind is not what runs, and two lists of commands drift — declare them once |
| the walkers' logs and captures | byproducts under `logDir` and `capturesDir`; nothing is migrated |
| a program that opens either document by path — a script, whatever the gate runs, a design document | whichever of the three answers the question that reader was asking. A reader nothing answers is retired in the same commit, never left pointing at a file that is gone |

**Three config keys hold everything the walk's two documents carried** — `stateLedger`,
`handoverFile`, `openItemsFile`. A project may keep tracking documents of its own beside them, for
what neither skill declares; those are the project's and this skill reads none of them.

**A capture the walk left behind is already named correctly or it is nothing.** `capturesGate` reads
`<language>/<YYYYMMDD-HHMM>-<frame-id>[-variant].png` and fires on anything else, so a directory
holding older shapes is emptied rather than renamed — captures taken for looking are thrown away
when the walk that took them is over.

## Retiring the walk

**Deleting `.claude/board-parity-walk.json` silences every hook the walk had, and that is all it
does.** Both hooks find their config by walking up from the file being written and do nothing when
there is none — the write-time checks on its two documents, and the stop-time gate that blocks a
session which shortened the parity list with no subagent having run. With the file gone they never
fire again, and nothing else in the project has to change to silence them.

**Two things the deletion does not reach, and both are somebody's to find.**

**The instruction file is the first.** A `CLAUDE.md` or `AGENTS.md` still pointing at the walk
sends a session that starts elsewhere in the repository into a skill this project no longer runs,
and that session will look for a parity list that is gone. Replace the pointer in step 6, and say
in its place that the chapters are how this project builds — then rename whatever the pointer
pointed at, wherever that name still says the walk.

**Anything that reads the walk's documents as input is the second, and it is the expensive one.**
A hook that stops firing costs nothing, and a stale pointer costs a person a wrong turn. A script
that opens the parity list finds nothing there and **fails**, inside whatever runs it — and what
runs it is usually the repository's own gate, which is the one command everything else waits on.
Step 7 is where those are found, and the proof is that gate green **after** the deletion.

> **Read it that way and the repository stops**: 「the parity list is a document for people, so
> deleting it costs a reader one document」 — while two scripts in `pnpm run check` open it by path,
> one of them running `git log -S` over it to date a line that left. Nothing warns; the gate simply
> turns red on the commit that was supposed to finish the move.
