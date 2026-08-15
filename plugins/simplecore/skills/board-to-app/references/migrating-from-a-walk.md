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
deciding its chapters, declaring one config, and deleting one file. **This is the only page in this
skill that names that skill** — everywhere else this skill describes building from a board, and a
project that never walked reads none of this.

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
| `logDir` | one agreed, ignored directory, one file per agent, one line appended per step. Renaming the directory is the project's to choose; the ignore rule moves with it |
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

## The order of operations

Each step ends with what proves it landed. **Delete nothing until the step after it is green** — at
every point in this order one of the two skills is working, and a project is never left with
neither.

| | Step | Proof |
| --- | --- | --- |
| 1 | The board builds and its gates pass | the board's own kit |
| 2 | Decide the placement and the entity ownership. Write the chapter overview and the state ledger, every chapter open | the invariant: no chapter uses an entity a later chapter owns |
| 3 | Write `.claude/board-to-app.json` from `assets/board-to-app.json`. Carry the five keys verbatim; leave out what the project does not have yet rather than inventing a path | `bta.mjs doctor`, then `bta.mjs check` |
| 4 | Run `chapterGenerator`, and give every chapter a row in the ledger | `bta.mjs check` — `ledgerGate` names a chapter the ledger does not |
| 5 | Move the parked decisions into `openItemsFile`, one line each in three parts | `bta.mjs check` — `openItemsGate` reads the heading and the shape |
| 6 | Point the project's instruction file at this skill, and stop pointing it at the walk | a session that starts anywhere in the repository reaches the chapters |
| 7 | Delete `.claude/board-parity-walk.json` and the parity list, in the same commit as the change that carries their content | `bta.mjs check` still green, and the walk's hooks are silent |

**Step 7 is one commit, not two.** The deleted lines and the lines that received them stand side by
side in one diff, which is the only place anything dropped in the move shows up. Say in the commit
body what went where.

### Where the two documents' content goes

| From | To |
| --- | --- |
| the parity list's frame list | the chapter set — deleted rather than moved, because `chapterDir` and the ledger already answer it |
| the parity list's parked section | `openItemsFile`, under `openItemsHeading` |
| the handover file's facts — servers, traps, accounts, standing data | the same file, under `handoverFile` |
| the handover file's list of commands a section must pass | `gates`, where a close reads each one by its exit status. A copy left behind is not what runs, and two lists of commands drift — declare them once |
| the walkers' logs and captures | byproducts under `logDir` and `capturesDir`; nothing is migrated |

**Three config keys hold everything the walk's two documents carried** — `stateLedger`,
`handoverFile`, `openItemsFile`. A project may keep tracking documents of its own beside them, for
what neither skill declares; those are the project's and this skill reads none of them.

**A capture the walk left behind is already named correctly or it is nothing.** `capturesGate` reads
`<language>/<YYYYMMDD-HHMM>-<frame-id>[-variant].png` and fires on anything else, so a directory
holding older shapes is emptied rather than renamed — captures taken for looking are thrown away
when the walk that took them is over.

## Retiring the walk

**Deleting `.claude/board-parity-walk.json` is the whole of the mechanism.** Both of the walk's
hooks find their config by walking up from the file being written and do nothing when there is
none — the write-time checks on its two documents, and the stop-time gate that blocks a session
which shortened the parity list with no subagent having run. With the file gone they never fire
again, and nothing else in the project has to change to silence them.

**The instruction file is the half that is not mechanical.** A `CLAUDE.md` or `AGENTS.md` still
pointing at the walk sends a session that starts elsewhere in the repository into a skill this
project no longer runs, and that session will look for a parity list that is gone. Replace the
pointer in step 6, and say in its place that the chapters are how this project builds.
