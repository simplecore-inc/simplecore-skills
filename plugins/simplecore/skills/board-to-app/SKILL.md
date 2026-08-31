---
name: board-to-app
description: >-
  Use when building an application from a wireframe board in dependency order —
  chapter by chapter, foundation first — and when running the persona tests that
  close each chapter. Also for resuming a build across sessions, deciding which
  chapters may run in parallel, and generating or regenerating the chapter set
  from the board — 시나리오 개발 · 챕터 개발 · 단계별 개발 · 개발 순서 · 페르소나 시험 ·
  병렬 개발 · 어느 챕터부터 · 다음 챕터. Requires a wireframe board and a chapter set
  derived from it; the application itself need not exist yet. NOT for authoring or
  syncing the board itself (simplecore:wireframe-boards), and NOT for auditing one
  feature area in one sitting (the project's own e2e skill).
---

# Building from the board, chapter by chapter

A board says what every screen holds. It does not say what has to exist before a
screen can work, and a pass that takes the board section by section will build a
list screen whose records nothing can create. **This skill builds in dependency
order**: the foundation first, then each chapter on top of the one before it,
each closing with the persona tests that prove it works.

**The chapter is the unit.** One chapter is one file, the file order is the build
order, and a chapter does not start before the chapter before it has closed.

**This document is the coordinator's.** What the agent holding one chapter does
inside it is that agent's definition, which is equally binding and read there
rather than here.

## Invoking this skill is the request for the agents it dispatches

**Read this before the first unit of work, because it is the one that decides whether
any of the rest happens.** The method below is agents: one `simplecore:chapter-builder`
per chapter, one `simplecore:capture-taker` and one `simplecore:capture-judge` per
screen, a read-only agent for the chapter audit, and a coordinator that builds nothing
itself. **Every one of those dispatches is asked for by the act of invoking this skill.**
No further permission is needed for them, and none is sought.

That has to be said here because many harnesses carry a standing default of *do not
reach for the Agent tool unless the user asked for it*. **That default was written for
an agent reaching for delegation on its own initiative, and it never addressed the case
where a skill's own procedure prescribes the agents.** Read as covering this, it does
not make the build careful — it silently replaces the method with a worse one.

- **The default still holds everywhere else.** No agent for a search a `grep` would
  answer, no workflow, no deep research, unless the user asks in their own words.
- **Say which agents were dispatched and why**, in the reply, so it is never silent.
- **Where the harness genuinely cannot spawn one** — no such tool at all — say so
  before starting and name what the run gives up, rather than proceeding as though the
  arrangement were intact.

> **Read it this way and it is wrong**: 「the ban is absolute and the dispatch is one
> line inside a procedure, so obeying the ban is the careful reading」. It is the
> reading that discards the method while leaving every sentence describing it in place.
> What comes out is a coordinator that builds each chapter in its own context, dries
> out partway through, and leaves half-built code behind — with every judgment it still
> owes made on a context with no room left. The build reads as the method from outside,
> because the coordinator is doing all the same steps; what is gone is the property the
> steps depend on, that whoever judges a chapter is not whoever built it.

## Precondition: a board, and a chapter set derived from it

**No board, no build.** With nothing to build against, every judgment collapses
into somebody's opinion of the screen in front of them. Do not substitute a spec, a
screenshot, a list of routes, or a description of what the screens ought to be, and
do not draw frames while building — that is authoring a board
(`simplecore:wireframe-boards`), and it produces a board shaped by the code rather
than a contract the code is measured against. Offer `/simplecore:board-init` and let
the board come first. **A build config sitting in a project with no board is the
same situation wearing a hat**: report it as wiring that cannot hold rather than
building anyway.

**The application is the opposite case: it does not have to exist yet.** A board
drawn before the code has every screen still to build, and that is what this skill
is for.

**No chapter set and no other build arrangement in place: generate one before
starting** (below). Building from the board directly, chapter by chapter in
somebody's head, is the thing this skill exists to replace: the order stops being
written down, and the second session cannot tell what the first one closed.

**A project already running a different arrangement is the other case, and generating
a chapter set there is not setup — it is a migration, and a migration starts only when
the user asks for it in so many words.** The tell is concrete: another build skill's
config file sits in `.claude/`, where this one's would go. Converting the project on
the strength of that discovery rewrites how a team works and discards the documents
they have been maintaining, and nothing readable from inside the repository says
whether they want it — which is what puts it in the class this skill already reserves
for a person. So **stop, say what the move would involve, and wait.** The procedure is
`references/migrating-from-a-walk.md`, and reaching it is not permission to run it.

**Asked in so many words means the request names the move** — off the other
arrangement and onto the chapters, in the user's own words. A request to build the
next chapter, to fix a screen, or to set the project up is not that request, and each
of those is answered by saying which arrangement the project is on and asking whether
to move it.

## What the project declares — `.claude/board-to-app.json`

**Moved to `references/config.md`, read when you are wiring a project, or a key you need is not declared.** It holds every key, what it buys, what its absence costs, and the rules for editing the file as text rather than through an encoder.

## The rules the build runs on

1. **Dependency order, not board order.** A chapter starts only when every chapter
   in its `prerequisites` section has closed. The board's section letters are a
   subject index, not a build order.
2. **A chapter closes on its tests, not on its code.** Working screens with no persona
   run is an open chapter, and so is a foundation chapter whose verifications nobody
   executed.
3. **Parallel chapters join before they are tested.** Two chapters that reference
   none of each other's frames may be built at once by separate agents — but the
   persona tests wait until both are standing, because the test walks between
   screens that live on both sides.
4. **The board is the contract.** A screen that disagrees with its frame is wrong
   even when it looks better. Where the board is wrong, fix the board in the same
   change (`simplecore:wireframe-boards`) and regenerate the chapter.
5. **Chapters are generated, never hand-edited — except the ones the generator excludes.**
   The expectations quote what the board draws; editing them by hand makes the file agree
   with the code instead of with the contract. Fix the board, regenerate, rebuild. **A
   chapter that places no frames is the exception**: a foundation chapter has no board to
   fix, so `chapterGenerator` leaves it alone and it is written and corrected by hand.
   Which chapters those are is read off the generator's own exclusion rather than guessed,
   and a chapter that places even one frame is never one of them.
6. **The persona is the tester, not a label.** Each screen names the personas that
   reach it and what each one must and must not be able to do. A run that only
   exercises the full-access role has tested a quarter of the screen.
7. **A correction becomes an instruction.** A builder that built the wrong thing, an
   agent that returned nothing, a handover the next session could not use — none of
   those is the agent's failure, and correcting that one agent leaves the next to make
   the same mistake in the same place. Fix what the agent was told, in the same change
   → *What is learned goes back into the instructions*, below.

## Opening a session

1. **The config**, read against the table above — a missing required key is reported
   before anything else happens.
2. **The chapter table and the state ledger.** The open chapter is the first one whose
   tests have not all passed — not the first with missing code.
3. **The open items.** What the last session parked is read before anything is
   dispatched: settling one usually changes what the next chapters should look like.
   A decision settled is applied to the code or the board, and its line is deleted.
4. **The handover file** — how to stand the system up, the known traps, which
   accounts and data are already standing.
5. **The chapter file, whole**, before touching anything. It states the state the
   previous chapter left behind; if the running system is not in that state, the
   previous chapter did not close and that is the work.

Then say which chapter is being built and which are running alongside it.

## The chapter's scenario is re-reviewed at its start, never merely read

Step 5 above says to read the chapter file whole. **Reading it is not reviewing it**, and that
difference is the whole of this section: a generated chapter reads as derived and therefore
correct, and it was correct — on the day it was generated. Everything it quotes has been moving
since. **So before a chapter's first agent goes out, regenerate the chapter and then hold it
against the sources it was computed from.** The review is the coordinator's, it costs a handful of
commands, and what it finds is otherwise found by an agent halfway through building the wrong
thing.

**Regenerate first.** A chapter still carrying a board fix from three chapters ago states
expectations that quote a frame no longer saying that. Where `chapterGenerator` is absent, say so
and read the frames directly rather than trusting the file.

Then six readings, each against a different source:

| Read the chapter's | Against | Because |
| --- | --- | --- |
| `prerequisites` | the entities its screens actually need, and whose `creates` names each | the list is derived from frame cross-references, so it carries what the screens say about each other rather than what their tables need. A tile whose stated basis is another chapter's entity is a dependency no cross-reference could have produced |
| persona lines | that entity's own scope column in the design | the lines come from the role matrix, which is per cluster and knows nothing about whether the record has an axis to be scoped on. 「only their own scope appears in the list」 asked of an installation-global entity is a demand nothing can satisfy, and an agent handed it builds a filter to satisfy it |
| every statutory or policy value it quotes | `factSources`, now | the chapter naming a value is not the value having been verified — the chapter quotes the frame, and the frame quotes whoever drew it. Read the article's own text against the sentence, and check that the cited paragraph is the one placing the duty the sentence states |
| a design line it calls stale | that design chapter today | 「the dictionary's line is stale」 is a claim somebody made at generation time, and the commonest reason it is now wrong is that the line was corrected afterwards |
| what its seed owes | `storyDocument` | a chapter in neither the story's step table nor its exclusion table has a seed nobody has placed in the story — and the cross-chapter facts a seed needs, such as two people whose correlation must fail, are settled here or nowhere |
| the parked lines naming it | `openItemsFile` | one of them may hold the chapter, and meeting that at the close is meeting it too late |

**What makes this skippable is that nothing about the file looks stale.** It is regenerated prose
in the project's own voice, every number in it came from the board, and the sections are uniform —
so the reading that would catch a wrong demand feels like re-reading a document just produced.
**The tell is that the chapter was generated once and everything it cites has been edited since**,
which is true of every chapter after the first.

**What the review finds is fixed where it came from, before the dispatch** — the board where the
board is stale, the design chapter where the design is, `creates` and `entities` where the graph
is — and the chapter is regenerated after each. A finding that travels into a brief as a warning is
one the agent has to re-derive; a finding fixed in the source is one the regenerated chapter states
by itself.

## The unit of work is a chapter, and one agent takes one chapter

**Moved to `references/dispatch.md`, read when you are writing a brief, dispatching an agent, deciding what may run alongside, or judging whether one has stalled.** It holds the whole dispatch discipline — what a brief names and what it must never demand, the resource slots, the git index as a shared resource, what a report owes, and a stalled agent told from a slow one.

## The wave: parallel backends, one restart, then the screens

Judging six rows per dispatch is right and it is also a lot of coordination. **One
arrangement makes most of that judgment unnecessary**, because it separates the work
that collides from the work that does not.

```text
wave n
  ① backends in parallel   several agents, a database each, nobody runs a server
  ② the barrier            all report → the coordinator restarts once and runs the integration pass
  ③ the screens            screens need a running server — parallel where slots exist, otherwise in turn
```

**Why it holds.** Backend work is code, migrations and its own tests; nothing in it
needs a **shared** running server, so the restart collision cannot happen in ①. An
agent may run its own process on its own port to test against its own database —
what it must not do is touch an instance on somebody else's slot. The one restart lives at
②, where exactly one actor runs it. By ③ the contract is fixed, so the screens no
longer move under each other.

**A screen agent's instrument is the browser, not the port.** Where ③ runs in turn
because there is one server, the agent taking its turn drives that server through a
browser — taking turns is what stops two agents writing over each other's rows, and it
is never a reason for any of them to finish without opening a screen. **A screen half
split among several agents is still ③**: each of them needs the browser, so either they
take turns at it or they get a profile each, and a split that hands them the building
while keeping the looking is a split that cannot close.

**The coordinator has three jobs and no others**: dispatch ①, run ② itself, dispatch
③. Everything else is the agents'.

**What still collides inside ①, and what to do about it:**

| Collision | The arrangement |
| --- | --- |
| migrations — two agents extend the same lineage at once | read the project's scheme off `migrationDir`, then give each agent its share in the brief (below) |
| generated API clients — each regeneration overwrites the last | nobody regenerates in ①; the coordinator regenerates once at ② |
| registries, barrels, locale catalogues | one owner per file, named in the brief; the others report the line they would have added |
| the git index — commits sweeping each other | separate checkouts, or agents stage nothing and the coordinator commits at ② |
| entity order — one chapter's table references another's | the wave is ordered by entity, not only by chapter: an agent whose table references one being created in the same wave waits for that agent's migration and says so |
| the state ledger — several agents close at once | **in a wave the coordinator writes every row at ②**; the agents report and do not touch it |

**How migrations are shared out depends on how the project orders them, and there are two
schemes.** Read which one it is off `migrationDir` before the wave is briefed — the directory
holds the answer, because the file names are the scheme:

| The project's scheme | What the brief hands out |
| --- | --- |
| **numbered** — a migration's position is a number in its name | a number range per agent, so two agents cannot claim the same position |
| **a parent chain** — a migration names its predecessor and the order is the chain (Alembic, and anything shaped like it) | **one agent extends a head at a time.** There is no range to divide: two agents each adding to the same head fork it, and the next agent to run them is refused. The others report the migration they would have written, and it is applied after the barrier |

**Where `migrationDir` names several lineages, the lineage is the unit** — a database with its
own audit or vault schema is several chains, and one agent per chain extends them at once.

**A parent chain refusing loudly is the arrangement working, not a worse case.** Numbers collide
silently — two migrations at position 0042 both apply, in whichever order the runner walks them —
so the range exists to prevent something nothing would report. A forked head stops the runner with
both heads named, which is why the discipline for it can be as thin as "one at a time".

**A wave is one chapter's backend, or several chapters' backends together** — the
chapters in a wave are the ones whose `prerequisites` are all already closed. That
set is readable from the state ledger, which is what makes the wave decidable rather
than a judgment call.

**The prerequisite list is derived and therefore incomplete.** It is computed from the
frames' cross-references, which capture what the screens say about each other — not
every entity one chapter's tables need from another's. **An agent that finds a
dependency the list does not name stops, reports it, and does not invent the table.**
The coordinator adds it to the owning chapter's `creates` section and regenerates, so
the next wave is assembled from a graph that has learned.

**When a wave cannot be assembled cleanly, run the chapter whole and alone.** The
arrangement is worth it for a wave of three or more; for two it costs more
coordination than it saves.

## What the chapter already knows about the future

Two of a chapter's header sections are computed from the board and are worth opening
before a line of code is written:

- **`usedLater`** — later chapters whose frames point at this chapter's screens, with
  the frame ids. Those screens already say what they expect of yours. **Open them
  now.** A column they will need costs nothing today and costs a migration and a
  re-run of a closed chapter's persona lines later.
- **`promises`** — screens this chapter's frames point at that do not exist yet.
  Leave the destination unbuilt, but leave the promise visible rather than quietly
  dropping the link.

This is the cheap half of looking ahead, and it is available before the build starts.
The expensive half — an entity dependency nobody wrote down — surfaces while building,
and the rule for it is the same: stop, report, let the graph learn.

## Touching a chapter that already closed

Work sometimes has to change something an earlier chapter built — an entity gains a
column, a screen gains a state, a rule turns out to be wrong. **Do not reopen that
chapter and do not edit its file.** A closed chapter is a record of what was true
when it closed; editing it destroys the history this build exists to leave behind.

Instead, in the chapter you are in now:

1. **Write it under the `touchedEarlier` section** — that section is hand-authored and
   the generator preserves it. Name what changed, in which chapter it was built, and
   why.
2. **Find who else uses it, in both directions.** Backwards: which closed chapters
   read this entity or screen — their persona tests must still pass, so re-run the
   ones that touch it. Forwards: **which chapters not yet built already depend on it**
   — the chapter files say so, and a change made without reading them is a change the
   later chapter will have to undo. Adjust once, now, for what is coming.
3. **Say it in the commit**, so the history can be read as a tree: a trailer naming
   this chapter and every chapter the change reaches.

**A change to a closed chapter's code that is not written down is the one thing this
arrangement cannot survive** — the next agent reads a chapter file that no longer
describes the code, believes it, and builds on a fiction.

### A frame the board gains later goes at the END of the closed chapter's list

The one thing that cannot follow the rule above. A new frame belongs to whichever chapter
owns its subject, and that chapter's `creates` section is the only placement declaration
there is — so a frame added after that chapter closed has to be written into a closed
chapter's file after all. **Append it; never insert it in subject order.**

`chapterGenerator` numbers the per-frame sections from that list's order, so a frame
slipped into the middle shifts every section after it by one. Nothing warns, because each
renumbered section is individually correct — what breaks is everything OUTSIDE the file
that cites a section number: a result document whose headings carry them, a note saying
「§9 is the one that failed」, a review comment, a plan. One insertion moved twenty-nine
headings at once and turned a clean tree red in a way that read as twenty-nine separate
defects.

Appended, the frame takes the next free number and every earlier section keeps its own.
**Write the reason on the line as a forward rule** — 「a screen added to a closed chapter is
written at the end so the earlier sections keep their numbers」 — so the next person does not
tidy it back into subject order.

**Expect the chapter to stay red on that frame, and say so.** It is placed but not built,
not verified and not captured, and `closedChapterHasEvidence` and `everyPlacedFrameIsCaptured`
say exactly that — what to do about it is `references/evidence.md` § *When a closed chapter gains
a screen*, and the answer there is that the chapter is not closed. That finding is true and is not the placement's fault: clearing it means
building the screen, running its lines and capturing it. **An agent that cannot do those —
no server, no browser, no ledger of its own — reports the finding with its cause rather
than placing the frame somewhere it does not belong to make a gate quiet.**

### A change that reaches many screens is verified by a sample and a census

A shared component gains a prop, a dialog's close button gets a label, a date is formatted one way
everywhere. **Walking forty-five screens in a browser to watch one mechanism work forty-five times
is not verification, it is the same measurement repeated** — and it costs so much that the honest
outcome is that nobody takes it. So the change is verified in two halves, and the second half is
the one that is new:

1. **The sample.** Every screen the change is directly about, in full — and **one** of the rest.
   Then the remaining affected screens are done.
2. **The census.** Count the sites that reach the mechanism and the sites that do not, **by name**.

**The sample half holds because a global change has one mechanism.** If it works on one instance it
works on all of them; they are the same code path. What varies per screen is context, and the
screens the change is directly about are where the context differences live — which is why they are
the ones walked in full and the further one is drawn from the rest.

**What a sample cannot prove is that every site goes through the mechanism.** A dialog that
hand-rolls its own close button is untouched by a fix to the shared dialog component: the mechanism
is sound, that site still says the wrong thing, and no amount of sampling finds it reliably —
sampling looks at instances of the mechanism and this is a site that has none.

**The census is a search, not a browser, and it is cheap.** Run on a real change it read 26 files
through the framework component, zero hand-rolled and zero bypassing, after which one browser check
settled 45 call sites. **How it is searched is the project's** — the import graph, the component
name, the helper — so it is written wherever the project keeps `auditScript`, not here.

**What is here is that a census reports both sides.** 「26 reach it」 and 「26 reach it, 0 do not」
are two different sentences, and only the second says the search looked for the negative — the same
thing *The third category comes back as a checker that did not run* says of every count in this
skill. And where the second number is not zero, **the names are the finding**: 「3 do not reach it」
gives nobody anything to do.

So it goes in the commit, beside the two trailers that are already there, in that order — the count
that reaches the mechanism first, the count that does not second, and its names after them:

```
Chapter: W22
Touches: W11 W12 W17
Census: the shared confirm dialog — 26 through, 2 outside: DocumentPurgeDialog PermitRevokeDialog
```

**The whole line is one line, and the cost of wrapping it is not the census.** The census gate reads the trailer line by line and takes the names after the colon from the same line as the second count, so a list wrapped onto the next line reads as no names at all and the commit is refused for a census that is in fact complete. Two agents met this from different directions on one afternoon: the fix each reached for was to shorten the census, and what was wrong was the wrapping. Write the names on the count's line however long it runs.

**What it really costs is the chapter.** git reads a trailer block only where it is the message's last paragraph and consists entirely of trailers and lines indented under one, so **one line wrapped at column 0 makes git discard the whole block** — `Chapter:` included. `git log --format='%(trailers:key=Chapter)'` then comes back empty for a commit whose `Chapter:` line any person can read, which is the single thing the trailer exists to provide. `trailerGate` takes its answer from `%(trailers)` for that reason rather than matching `^Chapter:` itself; a line-by-line reader is green over exactly the commit whose trailer answers nobody. Two commits in one repository sat that way with every gate green, and two more had a blank line between `Chapter:` and `Touches:` — which puts `Chapter:` in a paragraph of its own, above the block, so the history kept the edges and lost the node. **Where a line genuinely has to wrap, indent what it wrapped onto**: git folds an indented continuation back onto its trailer and the block parses.

`censusCountsBothSides` reads that line wherever one appears. Whether a change owed a census at
all, and whether the sample was drawn from the right place, are readings — the second table below
names whose and when.

## The dependency tree the history leaves behind

Every commit carries the chapter it belongs to, and every cross-chapter change carries
the chapters it reaches. That is enough to read the build afterwards as a tree: chapter
by chapter in order, with an edge wherever one chapter changed another's ground.

```
Chapter: W15
Touches: W11 W12
```

Two lines in the commit trailer, and the tree is recoverable with `git log`. Without
them it is not recoverable at all — a diff shows which files changed, never which
chapter's contract moved.

### Whether the build may commit at all is the project's answer, given once

Everything above assumes commits happen while the build runs — the trailers are read off them,
`trailerGate` fails a commit that carries none, and `importsTravelWithTheirCommit` reads what one
carried. **None of that reaches a build that stops to ask for permission at every close**, and
whether it may commit is genuinely not this skill's to decide: it is a standing decision about how
the repository is worked, and it differs per project and per user.

So it is settled once and the build never raises it again:

| `commitPolicy` | The build |
| --- | --- |
| `commit` | commits as the work lands, without asking. Pushing still waits for the user |
| `commitAndPush` | commits as the work lands and pushes, without asking |
| `ask` | stops before each commit and asks. Safe, and it costs the build its ability to run unattended: a chapter cannot close without somebody present, and the two gates that read commits see nothing until they land |

**A repository whose own rules already answer this has answered it**, and the key does not override
them — it is for the repository that says nothing, and for a project that would rather have the
answer in one machine-readable place than in a paragraph somebody has to find. **With neither, the
build asks**, because a skill installed in somebody else's repository must not take a standing
permission nobody granted.

**The policy settles permission and nothing else.** What a commit message says beyond the two
trailers — the subject convention, whose name is on it, what must not appear in it — is the
repository's own rule and is read there, not guessed from here.

**A commit that belongs to no chapter says `Chapter: setup`.** Wiring the project up is real work
and it is not a chapter — the config, the state ledger, the chapter set, the generator, this
arrangement itself — so there has to be a word for it, and the gate takes any non-empty one. That
is why the word is fixed here: a project left to invent its own invents a different one, and then
telling a chapter's commits from the setup's is a different `git log` incantation in every
repository, which is the single thing the trailer exists to prevent.

## Development, then the persona run

Each screen in a chapter carries two kinds of line: what to build, and what each
persona must find. Build the whole chapter first — a persona test that walks
between two screens cannot run while one of them is missing.

**A chapter that places no screens carries the same two kinds**, with a machine
verification where a screen chapter has a persona: a foundation chapter's second line
says what has to hold once its half is built — the migration that rolls back to the same
schema, the expired token that is refused — and it is executed rather than reasoned
about. Everything below is written for the persona run because that is the common case;
it holds for a verification line word for word.

**Then run the personas, one at a time, as that person.** Sign in with that
role's account, start where that person would start, and use only what that
person can reach. A test run as an administrator who then "checks the supervisor's
view" by switching a filter has not tested the supervisor.

**Record what the run found, not that it ran.** A persona line that passed needs
no note. A line that failed names the screen, the expectation, and what happened
instead.

## Matching the board is the floor, not the verdict

A screen can match its frame exactly and still be one nobody can work in. The board
settles what is on the screen; it does not settle whether the screen holds up when a
real person opens it in the longest language it ships in and presses everything.

So each screen is **judged as well as built**, in character — by the operator whose work
it carries, by the end user the service is for, and by every persona the chapter names.
**Looking means pressing**: an overflow that exists only in the language nobody opened
and a second tab that was never opened both read as a clean screen.

The lenses in full, the locale and alignment rules, and the anchor every finding needs
→ `references/judging-frames.md`.

## When a screen and its frame disagree

1. **Fix it there.** Then take the same path again, and the neighbouring screens with
   it. Where the board is the stale side, fix the board and regenerate the chapter.
2. **A defect a machine could see becomes a rule the moment you understand it.** Not
   on the second sighting — that is the floor, not the bar. Ask the question every
   time: **can a machine see this?** Most defects that reach a person are mechanically
   visible once somebody has described them precisely — a value computed in two
   places, a string that should exist once, a control with no destination. Describing
   it well enough to detect is most of understanding it. Where it belongs and how it
   is proved → `references/checks-and-eyes.md`.
3. **Only what needs a person goes to a person**, and it goes to the open items, not
   into a pause.

Do not write audit findings into documents. A finding was fixed, became a rule, or is
a line in the open items.

## Parking is a last resort, and most things do not qualify

**The default is to decide.** An open question is answered by designing the answer —
**architecture first, then consistency with what the product already does, then
stability, then performance** — and the decision is applied to the code and the board
in the same change. Those four are an order, not a list: a fast screen built on the
wrong shape is a rewrite, and a screen that disagrees with its neighbours is a defect
no benchmark can see. A build whose open items keep growing is not being careful; it
is deferring the design work, and every deferred decision makes the next chapter
harder because it rests on nothing.

**These are never reasons to park:**

| "I can't decide this because…" | What to do instead |
| --- | --- |
| it would add screens or states | Add them. Draw the frames, then build them. Scope is not a reason to leave a product incoherent. |
| it is complex to implement | Complexity is the work. Design it properly and build it. |
| there are two reasonable options | Pick the one more consistent with the rest of the product, and say why. Two reasonable options is a decision, not a blocker. |
| the requirement is not written down | Derive it from the design documents and the personas the board names. Write down what you derived. |
| an external system's behaviour is unknown | Design so the answer does not matter — declare the capability, handle both, reject explicitly what is unsupported. A product that changes shape when a vendor's answer arrives was not designed. |

**Three things genuinely qualify**, and they share a property — no amount of design
makes the answer derivable:

- **A decision that changes what the product is.** Somebody owns it and it is not the
  build.
- **A commercial or legal value nobody can derive** — a price, a contractual term, a
  retention period a regulator sets. Where `factSources` names a tool that can settle
  it, that is not parking, it is a lookup. Design everything around it so the value is
  the only thing missing.
- **A blocker in the world.** An environment that cannot reach a service, hardware
  nobody has yet. Build and judge everything that does not depend on it, and park only
  the part that does.

Even then, park the narrowest thing. "The whole chapter is blocked" is almost always
"one decision inside it is blocked, and nobody separated it from the rest".

When something does qualify: **do not stop, and do not guess.** Add one line to the
open items and move to the next screen — which frame · what the choice or blocker is ·
which side looks stale. A line missing the third part sends the next session back to
re-derive it, which is the cost parking exists to avoid.

**The first part is one unbroken token** — a frame id, a chapter number, whatever that project
names the subject with. It is what a reader's eye and the gate both key on, so a phrase there is
read as the second part having started before the separator arrived. A decision that hangs on a
chapter rather than on a frame is the case that tempts a phrase, and it is still one token.

```markdown
- C-07 — board draws a bulk reverse; the API reverses one record at a time.
  Board looks stale, but the operator does 40 a day. Product decision.
- D-02 — needs a role that does not exist in any environment yet. Blocked, not stale.
```

**Write the line before saying it is parked.** A decision announced in a message and
never written down is one the next session cannot find, and the coordinator is the
likeliest author of that gap: an agent reports something undecided, the reply
acknowledges it, and both sides then believe it is recorded. Nothing is. So when an
agent surfaces a parked decision, write it yourself in the same turn or tell the agent
to — then say which one happened. "Recorded" is a claim about a file, and the file is
the only place it is true.

### One kind of parked line does hold a chapter, and it is not a park at all

A decision deferred **because a chapter that has not been built yet would settle it** is a
dependency written in prose, and prose is read by nobody. The case is concrete: a check that
cannot be made to hold on the current volume, whose only fix destroys accounts the product cannot
yet remake, because the chapter that builds the addresses for remaking them has not run.
「we will do it after 04」 is the right decision and is also a sentence with nothing behind it.

So such a line **names the chapter it blocks, on the line itself**, and the project's own gate
refuses that chapter's close while the line stands. **The marker is opt-in**, because blocking is
the rare case: a line without one is an ordinary park, and the default stays exactly what it
already was — a chapter closes with its parked lines still open.

> **Read it this way and it is wrong**: 「it is agreed and it is written down, so it will be
> honoured」. Written down where? The line sits in the open items, the chapter closes on its tests,
> and between the sentence and that close there is nothing that reads the two against each other —
> the only thing that would have noticed is somebody re-opening a document they had no reason to
> open.

## Two kinds of leaving-behind, and only one is shared

Sequential agents must not re-derive what the last one learned. But left to append
freely they produce a diary with several authors, and the next agent cannot tell a
confirmed fact from somebody's impression.

| | Shared — facts | Not shared — narrative |
| --- | --- | --- |
| Where | `handoverFile` — there is exactly one | one file per agent under `logDir` |
| What | how to stand the system up, known traps, accounts and data standing | what was built, what diverged |
| How | present state in plain declaratives; **overwrite** when wrong | one line appended per step |
| Read by | every agent, at the start | its own agent, and whoever is watching |

**The handover file has no room for a point of view.** No "I found that", no "this
time", no "it used to be". A fact that changes is corrected in place, with no history
left behind. That is what lets any number of authors maintain it. **Do not create a
shared narrative file** — several agents stacking their stories in one place produces
exactly the confusion this split prevents.

**A trap named only in a report is one the next agent walks into.** An agent that loses an hour
to something and works it out has produced two things — the fix, and the knowledge — and the
knowledge reaches the next chapter only through the handover file, never through the
coordinator's inbox. **So the coordinator asks where it landed before that agent stands down**,
and treats 「I told you」 as unwritten. The same hour is otherwise paid twice: a sign-in endpoint
that takes HTTP Basic rather than a JSON body was reported to one coordinator and written
nowhere, and the next agent hit it identically a chapter later — then, because a wrong request
shape and a wrong password answer with the same 401 and the same sentence, concluded the seed
was broken and built a task on that.

**A log written afterwards is not a log.** Its whole value is answering "where is this
now" while the answer is still changing; written at the end it answers a question
nobody still has, and every hour before that was spent looking silent. Silence reads as
a stall, and a stall gets a running agent killed — so the cost of skipping the line is
not tidiness, it is somebody stopping work that was fine. That lands hardest on an
agent that **dispatches** sub-work rather than building screens itself: its own file
stays empty because it is not the one touching screens, and it is the only file anybody
watching can read. An agent that hands out work still writes one line per step it takes
— briefed, judged, committed — under its own name.

## A handover file grows, and the answer is not another trim

**Every chapter has a reason to add to it and none has a reason to take anything away.** That is
what the file is for — an agent holding a chapter must not work out again what the last one worked
out — so it grows by design, and it passes the size where anybody reads it whole without anything
announcing that it did. **A fact nobody reads is worth what an absent one is worth, with the
difference that it still looks like coverage.**

**Trimming buys one round and then it grows back.** By the time the file is long, most of what is
in it is true and cited; what is left to cut is the part that was already dead, and cutting that
leaves the shape untouched. The shape is the problem: **one file read by every chapter means every
agent pays for every other chapter's facts** — a chapter's backend map is dead weight to the six
chapters that load it and never open it.

**So a handover file is allowed to be an index that routes.** `handoverFile` may name a document
holding the facts, or a **skill's `SKILL.md` whose `references/` hold them by subject** — the
index says which file answers which question and restates none of it. A project splits when the
reading, not the writing, is what costs: the test is whether an agent opening it reads past the
part it needs.

**Two things have to move with the split, or it is worse than not splitting.**

- **The index restates nothing.** A fact in both the index and a reference is the duplication this
  arrangement bans everywhere else, and the copy that drifts is indistinguishable from the one that
  did not.
- **Whatever reads the handover file has to follow the routing.** A check that reads
  `handoverFile` as one document now reads a table of contents: it goes quiet on every fact in the
  references and reports the same clean result it reported when it was reading facts. **That
  silence is the failure mode**, so a gate over the handover file reads the index *and* what it
  routes to.

**Grouping is by who asks and when, never by where the fact came from.** 「what the migration
found」 is an origin; 「how a screen reaches its address」 is a question somebody has. Origin
groupings read fine to whoever wrote them and send everybody else through three files.

### Splitting one, in order

**Group from the file's own section list, not from a template.** Read the headings and ask what
question each answers; the groups a project needs are its own, and a borrowed set of topic names
puts a section in the file whose name is closest rather than the file its reader opens.

1. **Move the prose, do not rewrite it.** Each section keeps its own words; what changes is which
   file it sits in. A split that rewrites is a split nobody can check.
2. **Count in and count out, and check it by machine.** Re-split both sides, normalise whitespace,
   and compare every section body — 「61 in, 61 out」 is only worth saying when something compared
   them. A section that quietly went nowhere leaves no mark afterwards, which is the whole reason
   this repository counts items before deleting a file.
3. **The index states no fact.** It says which file answers which question, and nothing a reference
   also says.
4. **Point `handoverFile` at the index.** That one line is what makes the build use it — the
   builder is already told to read the handover file, so nothing new has to be written to route it.
5. **Repoint everything that linked into the old file**, and change the project's own document
   index and instruction file in the same commit. The old file's deletion and the new files land
   together, so anything dropped shows in the diff.
6. **Widen every check that read the handover file** — the skill's own point-of-view sweep does
   this already; a project's gates over that file are the project's to widen.
7. **Bring the new tree inside the checks that scope by path.** A locale audit, a glossary check, a
   prose linter — each reads a declared set of paths, and a tree that has just been created is in
   none of them. **The references would stand there checked by nothing**, reporting the same clean
   result as a tree that passes. Declare the new path, then plant a violation and confirm it is
   reported before removing it.

**Step 7 is the one that gets skipped**, because everything else fails loudly and this fails
silently: the split lands, every gate is green, and the checks that used to hold the file now hold
nothing.

## An agent that ends, and an agent that only paused

An agent that has stopped moving does not say so. It announces that it is idle, which
reads like availability and is indistinguishable from the announcement of an agent
between two bursts of real work. A coordinator that answers each of those with another
instruction ends up with a queue nobody is consuming and a build that has not moved.

**Judge by the artifact, never by the signal.** Every dispatched agent writes to a
file, and its first line says how far it got. That line is the only progress report
that cannot lie.

**A quiet agent is either stalled or inside something long, and the two look
identical from outside.** Killing the second kind throws away everything it had
worked out; waiting on the first kind costs the build a chapter. So the difference is
established rather than guessed, from the four things that move while real work
happens:

| Read | Working, keep waiting | Stalled, replace it |
| --- | --- | --- |
| its step reports | still arriving, each naming a path | stopped arriving, or arriving with no path in them |
| its artifact — the log's last line | growing; the line names a step that plausibly takes this long — a full gate run, a migration over real data, a suite, a capture sweep | unchanged since the previous check, or the line repeats |
| the tree and the index | files changing, commits landing, a process of its own still running | nothing has moved |
| what it says it is doing | it can name the command it is inside and what it is waiting for | it announces availability, or restates its assignment |

**The first two rows together are the test**, and they are why step reports exist:
quiet **and** a still artifact is a stall, while quiet with a growing artifact is
something long and is left alone. A long gate produces no commits either, so the
artifact is what separates it from a stall — and an agent that cannot say what it is
waiting for is not waiting.

**The threshold is two.** When the readings say stalled — no step report and no change
to the artifact since the previous check, and the agent has announced idle twice —
treat it as stalled. **Two of the three is not a stall**: an agent replaced on a still
artifact alone was usually inside something long, and everything it had worked out goes
with it. Then, in one turn:

1. **Tell it to stop** and to stop writing the artifact. Say why, and ask it to send
   anything unsaved as a message rather than writing it.
2. **Dispatch a replacement**, starting from the artifact's progress line. This is what
   the line is for — a replacement resumes at the sentence the file already wrote.
3. **Never leave both alive over one artifact.** Two writers on one file is the
   collision this skill spends its length preventing, and a stalled agent that wakes up
   is still a writer.

**Do not queue more work at a silent agent.** Another instruction to a session that
consumed neither of the last two is not persistence; it is the coordinator refusing to
read the artifact.

A session can also end for reasons that have nothing to do with the work — a usage
limit, a dropped connection. Three rules cover every such ending, and what each one
costs when it is skipped is in `references/harness.md` § An agent that ends:

- **Read the tree rather than guessing**, and finish or discard what is half-done
  **before** dispatching the next agent into it.
- **Check whether the work is still moving before replacing anybody.** A pause looks
  exactly like a death, and a replacement dispatched over a live agent puts two on one
  job. If it is moving, wait: that agent still holds everything it worked out.
- **Only the agent's own "I am finished" ends its hold on the tree**, and stopping is
  the only thing that reaches an agent before it wakes. A commit, a clean status, an
  idle notification and a report that reads like a conclusion are all things an agent
  produces *mid-assignment*. **Stop the previous agent before dispatching the next one,
  every time**, with the tool that kills it rather than a message asking it to stand
  down — a message arrives after its next write. Stopping an agent that was genuinely
  finished costs nothing.

## Letting a person watch, without paying for it

An agent returns conclusions, which leaves a question: where does everything else go,
and how does a person see progress without reading it?

**Into files whose paths are the report.** Builders write their run log to `logDir` and
their captures to `capturesDir`, and hand back paths. The coordinator — and the user —
can open one, and neither pays for it by default.

| Watch | Answers |
| --- | --- |
| `logDir`, filtered to the step words | *is it moving, and where is it* |
| `capturesDir`, for new image files | *what does the screen actually look like* |

**`costLog` is the third of those files and answers a different question — what the arrangement
cost** — with the wall-clock span and the consumption of each chapter appended as it closes,
measured against a start stamped when that chapter's first agent went out → *The dispatch is
planned, written down, and then made*. **What earns the file is that it separates a run that
bought something from one that bought nothing.** A capture run taken through the wrong window is
spend like any other and is taken again from the start; a record that carries only the second
makes the arrangement's cost look like the sum of its useful work, and the waste leaves no trace
in any total. One such run cost 157,540 tokens and produced not one usable picture, which is a
figure nothing that omitted it could ever have shown — and it is the figure that argues for the
pre-flight the `capture-taker` now runs.

**Arm both watches in the same turn the agent is dispatched**, not afterwards. A
coordinator is busy between events and two turns is an hour, so "I will check the log"
is the failure, every time.

**A watch dies quietly, and a watch that was never alive is quieter still** — both
produce exactly what a working watch produces on a quiet minute. So prove every watch
the moment you arm it, in the same turn: make it fire once, then watch it go silent.
Read silence as suspect rather than as reassurance, and re-arm at once →
`references/harness.md` § A watch is a check.

Saving context and hiding the work are different things. Three ways the build stays
visible while the coordinating context stays empty:

1. **The agent's own work streams to the client.** What it clicked and captured can be
   expanded in the conversation. The coordinator never receives it, so it costs nothing.
2. **Captures go to files; the coordinator forwards them the moment they appear**, by
   path and **without opening the file**. Forward them as they are shot, not at the end
   of the chapter — a person following a build wants to see the screen while it is
   still the subject. Say which frame and which locale in one line, and send the
   language a person reads rather than the pseudo-locale, which is an instrument →
   `references/driving-the-product.md`.
3. **Progress goes into the builder's own log, one line per step** — a line per
   *screen* is a heartbeat every thirty minutes, which from outside is
   indistinguishable from an agent that has stalled.

**Never put an image in a report.** A few of those and the session is dry. Captures and
logs are byproducts — keep them out of the repository.

**A screen that changed is shown, not described.** "The tab strip is in place and the
activity pane fills the rest" is equally true of a screen that works and one that draws
its rows in the wrong order, off the edge, or in the wrong language. The three
different reasons a screen gets photographed, and why none substitutes for another →
`references/frame-artefacts.md`.

## What a chapter owes besides working code

Working screens are the floor. A chapter also owes, for every screen in it:

- **The states the board draws** — the dialogs, panel forms and empty states are
  part of the screen, not a later polish pass.
- **The role boundary, enforced on the server.** A hidden button is not a
  boundary; the persona test for a scoped role must fail if the record can be
  reached by its address.
- **The screen copy the board wrote**, in the board's own words rather than the
  developer's paraphrase.

Whatever `frameDeliverables` declares is part of the chapter's close, one checkable
sentence at a time — and **a screen that owes one is not finished until it exists** →
`references/frame-artefacts.md`.

**That list is also where a defect the running product showed lands when no frame can draw it** —
a value derived wrongly from what the system reports, a demand that cannot be answered at the
address it is answered at. It grows as such defects are found, and the generator emits each
sentence per frame so every later chapter re-asks it rather than the defect being fixed once →
`references/demands.md`.

## Running without stopping to ask

The build is meant to continue on its own while the dependencies hold and the tests pass. Four
things otherwise turn into a question, and none of them has to.

1. **Where am I?** `stateLedger` is a table of chapters and whether each is open, in progress,
   waiting on its tests, or closed. Read it first, write to it when a chapter's state changes, and
   never infer progress from the code.
2. **Who do I sign in as?** The ledger names one development account per persona, and **signing
   into this build's development server as that persona is part of the run rather than something
   to get permission for.** A screen is judged by the person whose work it carries, so a run that
   stops at the sign-in form has not started. Do not ask for credentials, and do not test one role
   by filtering another role's screen.

   **What that authorises, exactly**, because the boundary is what makes it safe to state at all:

   | | |
   | --- | --- |
   | **Where** | the development server this build stands up — `localhost`, `127.0.0.1`, `[::1]`, or the development machine's own address. The handover file names the origins this build uses; anything it does not name is not this build's server |
   | **Out of scope** | a remote host — production, staging, a shared environment — the user's own accounts, and any external service. Each of those is asked for, and none of them is on the way to a chapter closing |
   | **Where a credential comes from** | the project's development configuration, its seed, a `.env`-shaped file, a fixture, or a value the user supplied. **Never invented.** Where none can be found anywhere, that is one of the four things below that waits for a person |
   | **Where there is no account** | a development server exposing a sign-up screen gets a test account made on it, and the run continues |
   | **Where a credential must not go** | a reply, a log line, a capture caption, a result document, a commit, or any file. It reaches the process signing in and stops there |
3. **What data should exist?** The numbers the board draws are the fixture specification: a frame
   drawing a count of 119 valid records says the seed makes 119. One story, one site, every chapter
   on top of the last → `references/scenario.md`.
4. **An unresolved question in a frame.** A frame carrying an open question — `OPEN:`, or whatever
   marker that board writes for one — is built as drawn and does not hold the chapter: the open
   question travels with the frame, not with the build.
   Where `factSources` names a tool that settles it — article text, the version in force on a date,
   **the annex forms whose boxes are the record's fields** — verify it there and correct the board.
   Only a question no source can answer waits for a person, and it is left marked rather than
   asserted.

**Write the handoff as you go, not at the end.** A session cannot reliably tell how much room it
has left — there is no gauge, only the growing weight of what it has already read. So the state
that lets the next session start without asking anything is written the moment it changes; a
handoff composed once the context is nearly spent is the one that does not get written.

**Stop and ask only for these four**: a decision that changes what the product is, a term whose
translation is genuinely undecided, a value no source can settle, and **moving a project off
another build arrangement onto this one** — plus anything the repository's own rules reserve for
the user. **Committing and pushing are not a fifth**: it is answered once — by the repository's own
rules where they say, and by `commitPolicy` where they do not — and the build follows the answer
without raising it again → *The dependency tree the history leaves behind*. **Everything else has a written answer here**, and a session that
opens the ledger, reads the first open chapter and dispatches has already answered "what next".

### Design the answer; scope is not a reason to take the worse one

An open question is designed rather than asked, in the order *Parking is a last resort* sets
out — architecture, consistency, stability, performance.

**A wider refactor is not a reason to decline the better structure.** The cost is said out loud —
which chapters it reaches, which persona lines have to be re-run, what has to be regenerated — and
then the right shape is built. What is never done is quietly taking the smaller worse option and
reporting it as the choice: a screen built on the wrong shape is a rewrite that arrives three
chapters later, when it costs everything built on top of it as well.

**Design against the code that will implement it, not against the documents alone.** The board and
the design document agree with each other far more readily than either agrees with the branches
already standing in the server, so a contract settled from the two of them is settled from a
picture of the product rather than from the product. Read what will hold the contract — the
branches it already takes, the states it distinguishes, what it does when the value is absent —
and design against that. A contract designed from the documents alone is wrong in exactly one
place: where the code carries a third case neither document drew.

Where the wide change genuinely belongs to somebody else's decision, that is the first of the four
reserved above — ask it as a decision with its cost attached, not as a preference.

## The documents, the board and the code say the same thing

Three artifacts describe one product: the design documents decide behaviour, the board renders
that as screens and states and flow, the code implements it. **A change updates all three in the
same change.** Two out of three is the state that reads as agreement and is not — the reader who
opens the odd one out has no way to tell it is stale.

| The change starts in | What moves with it |
| --- | --- |
| a design document | the frames that draw the behaviour, then the screens built from them |
| the board | the design document that decided it, then the code — and the chapter is regenerated |
| the code, because building found the board wrong | the frame first, then the document behind it; never the code alone |

**Where they genuinely cannot agree, the disagreement is written down** — in the open items or the
project's own tracking document, naming which two disagree, which side is stale, and what has to
happen for them to meet. An undocumented gap is indistinguishable from an oversight, and the next
session resolves it by guessing which artifact to believe.

**Never resolve a disagreement by editing whichever is cheapest to edit.** The board is the
contract for what a screen holds; the documents are the contract for why. Cheapness is not
authority.

### What is authority — date them, then rank them

**Saying what is not authority and stopping there is what produces two lanes fixing each other.**
Every disagreement then gets adjudicated from scratch, so the same pair comes out one way on
Tuesday and the other way on Wednesday, and whoever spoke last wins. One chapter had two judges
return opposite verdicts on the same picture, and a label fixed in one layer put back by the
generator that owns it — neither agent disobeyed anything.

**Date both sides first, because most disagreements are not disagreements.** `git log -S` on each
sentence says which was written when, and a side written before the other, on a subject the older
side has a document behind it for, is not a peer — it is the stale one. Four commands settle more
of these than any ranking does.

**Where dating leaves them level, this order decides, and no reading is taken twice:**

| | Beats everything below it because |
| --- | --- |
| 1. the statute, through the statute tool | nothing in the repository can make an article say something else |
| 2. the design document | it is the record of a decision somebody made, and the rest are renderings of it |
| 3. the board | it is the contract for what a screen holds, and it was drawn to be held against code |
| 4. the code | it is the newest and the least reviewed, so it is evidence of what happens rather than of what should |
| 5. a capture, a transcription, a report | it describes one boot of one build, and it is right only until the next one |

**The bottom row is the one that surprises people.** A picture feels like the hardest evidence in
the room, and it is the softest claim about the contract: it says what one screen did once. It
settles nothing against the board, and a finding that reads 「the board is wrong because the screen
does this」 has the ladder upside down — the board is wrong when the *design document* says so.

**Where a rung genuinely has to move, the change starts at the rung above it and comes down.**

## Every rule here is held by a machine or marked as needing eyes

**Moved to `references/checks-and-eyes.md`, read when you are adding a rule anywhere, or asking whether a rule is actually being held.** It holds the two tables of what no machine can judge, who takes each reading and at which moment, and how a rule is proved in both directions before it counts as added.

## What is learned goes back into the instructions, in the same change

A defect fixed once and walked past grows back next session, so the finding is worth more than
the fix. **Never end with only the work corrected.**

**And this rule is the one most likely to destroy the thing it protects, so it comes with a
ceiling.** Written without one it says only 「add」, and every session adds; one repository reached
about 1.1 million characters of reachable instruction that way — more than a context window, so no
agent could hold the rules it was judged by, and every repeat it suffered had a paragraph
forbidding it that nobody had read. **`instructionBudget` is what stops that**: a ceiling per file,
declared at what the file measures the day it arrives, so nothing is red on arrival and the next
append is the one that fails. Adding then means trading, and `instructionFitsItsBudget` says so at
the moment of the append rather than a year later.

**A rule that gets a check gives up its paragraph in the same change.** The reasoning belongs in
the check's own message, where a reader meets it at the moment it fires; what stays behind is one
sentence naming the check. Carrying both is how machine coverage and prose grow together, and
`aGateIsTaughtOnce` reports it. **The instinct to keep the essay 「so people understand why」 is
exactly the instinct to guard against** — nobody reads a file looking for a rule they do not yet
know they are breaking, and everybody reads a message that just fired at them.

| The finding is | Where it goes |
| --- | --- |
| a defect type a regex or a tree walk can judge | a detection rule in `auditScript`, run across the whole tree, and what it finds is fixed now |
| something about how the build is coordinated — a brief that misled, a report that never arrived, a rule with a hole | this skill, or the brief every agent of that kind receives |
| a convention or trap that needs eyes | this skill or the project's instruction file, with the misreading printed beside the rule |
| a path, a list, or a policy true only of this project | the project's config or instructions — never this skill |

Three things make it stick, and skipping any one of them means nothing happened:

1. **In the same change as the work**, not deferred to a cleanup that never comes.
2. **Proved to fire.** A gate is run against the broken form and then the fixed form
   (`bta.mjs gates` does exactly this); a written rule names the case it now catches. A rule
   added without that is a claim, and it converts *nobody has checked* into *something is
   checking* — which is much harder to doubt.
3. **Said out loud.** These files live outside the repository being built, so name which file
   changed; otherwise nobody sees the change that was the point.

**Write it into the checkout, not into the installed copy.** A skill reached through a plugin
directory is replaced wholesale by the next install of that plugin, so a finding written there is
deleted by a command nobody connects to it — and it fails the way this whole section exists to
prevent, silently and later. Where the skill is installed rather than checked out, **say the
finding and where it belongs instead of writing it into a copy that will not survive**; nobody can
be told afterwards what a reinstall removed. Committing in that checkout follows its own rules, not
`commitPolicy`, which is about the repository being built.

**"I will be careful next time" is not a fix.** Memory ends with the session, and the same
misreading grows back. If no sentence and no gate changed, the finding was not recorded.

## Closing a chapter

### The product's owner can end a chapter, and the ledger says that is what happened

**Whoever owns the product may decide a chapter is done, and the build has no standing to refuse.**
The screens are good enough, the round has cost more than it is worth, the work has moved on —
none of those are the build's call, and a skill that answers 「the evidence is not finished」 to the
person the evidence is for has mistaken who it works for.

**What the build does owe is that the two kinds of close never look alike afterwards.** A chapter
closed on its verification has captures somebody who did not take them read against the board; a
chapter closed by decision has whatever happened to be true when the decision was made. Written
with the same word, the second is indistinguishable from the first six months later — and every
check that reads a closed chapter's evidence reports its absence as a defect, which teaches the
next reader to turn the check off.

So the ledger writes a different word, `decidedStatus`. The evidence checks skip those chapters,
and the row goes on saying plainly which kind it was.

**Three things go in the row with it**, because a decision nobody can weigh later is worse than an
open chapter:

| | |
| --- | --- |
| who decided | not the build, and not an agent — name the person |
| what was true when they decided | what had been verified and what had not, in the state it was left |
| what is owed if it is reopened | the run that was not finished, so a later round starts from a fact rather than a guess |

**Never close a chapter on the build's own judgment.** The build closes a chapter on evidence or it
leaves it open; the other word is the owner's to spend, and an agent writing it because a round got
long has forged the one signature in the ledger that is not its own.


A chapter closes when every screen in it works, every persona line has been run,
and the failures are fixed rather than listed. Before saying so:

1. **The coordinator opens the chapter's captures, one by one, and looks at them.** Not the
   builder that took them — this is the one reading in the arrangement taken by a party that
   did not produce what it is reading, and that is the whole of its value. It comes first
   because what it finds feeds the two steps below: a defect nobody has seen yet cannot be
   cross-swept.

   Three questions per picture, and the third is the one that fails:

   - **Is this the frame it is named after?** A swallowed deep link leaves the previous
     screen, and the file is then a perfectly good picture under the wrong name.
   - **Is the screen in it built, or is it the shell?** A route that answers 200, raises no
     console error and paints the chrome with nothing inside it is what every other check in
     this skill sees as a pass. Rows, values, content — look for what should be there and is
     not.
   - **Does what the chapter wrote down about this screen match the picture?** Where the
     project keeps a verification record, its sentences are read against the images they
     cite, one at a time. A sentence written from the responses rather than from the screen
     is fluent, specific, and about a screen that does not exist →
     `references/judging-frames.md` § Taking a capture is not reading one.

   **A frame with no capture is this step's finding, not the gate's.** Say which frames were
   looked at, **by id** — a count is not an answer, because the frames nobody opened are
   exactly the ones nobody can name afterwards.

   **A verification record quoting a generated chapter file goes stale when that file is
   regenerated.** The chapter's expectations are rewritten from the board, so a sentence
   quoted into the record weeks ago can be a sentence the chapter no longer contains — and it
   still reads as a quotation. Re-check the quotations immediately before writing 닫힘, not
   when they were first written; where a project has a gate that matches the record's
   quotations against the chapter, that gate is what to run, and re-quote whatever it names.
2. **Cross-sweep by defect type.** Each defect found is a *type*; search the whole
   codebase for other instances and fix those too. Report the sweep per type,
   including "0 others". A type that already became a detection rule is swept by what
   `auditScript` names — run it, or the whole family where the key names a directory,
   and report that; the manual search is for the types seen only once.
3. **Audit the chapter's code, and act on it.** Not optional, and not the same thing as
   the cross-sweep: that hunts instances of defects somebody already found, this looks
   for what nobody found because no single builder could see it. A chapter is built by
   several agents in sequence, none seeing the others' code; they solve the same problem
   in different files without knowing the other exists, and every one of those
   duplicates compiles, passes and reviews cleanly on its own. It is only visible from
   above, once, at the moment the chapter is finished and before the next chapter copies
   from whichever variant it happens to open.

   Do it with a **read-only agent while nothing else is running**, so the audit cannot
   fight a builder for the tree. Ask it for: the same logic in two places, a file whose
   parts stopped belonging together, one idea under two names, a rule the chapter obeys
   by habit that no checker holds, and dead ends. Rank by cost, not by ease.

   Then **act on the findings in the same session**, and every finding leaves as one of
   exactly two things:

   | The finding is | It becomes |
   | --- | --- |
   | Something wrong in the code — a duplicate, a seam, a name | **A refactor.** Done now. |
   | Something the code happens to get right, with nothing holding it | **A checker.** Written now. |

   There is no third column. "Worth doing later" is where findings go to die: the report
   is filed, the duplicate is copied by the next chapter before anybody returns to it,
   and the audit spent its context for nothing. If a finding is genuinely not worth
   either — say so and why, and it is closed rather than deferred.

   The second row pays for the whole exercise and is the easiest to miss because nothing
   is broken. Eight screens doing the right thing because their authors happened to is
   not a rule; it is eight coincidences, and the ninth screen is written by somebody who
   never saw the other eight. Ask of every convention the chapter follows: **what stops
   the next screen breaking this?** If the answer is "somebody would notice in review",
   write the checker.
4. **Run every command in `gates`**, all of them, green, each read by its exit status
   rather than by the tail of its log → `references/harness.md`. `bta.mjs check` is one
   of them, and `bta.mjs gates` runs whenever a gate was added or changed.

   **This run happens AFTER the builder has returned, never beside it.** The builder runs the same
   gate before it stands down, so a coordinator that starts its own while the builder is finishing
   puts two full runs on one database — the collision *Judge the overlap* already names, with the
   coordinator as a party to it rather than a second chapter. Both sides pay: one run is killed
   mid-suite and the other's last checker blocks for ten minutes on locks the dead one never
   released. Until the builder returns, the coordinator judges by artifact — the captures, the
   result document, `git log` — none of which touches the database.

   **And a killed run is a third state that the exit status cannot tell you apart from a failure.**
   `143` is not red and not green; it is a reading that does not exist, and anything checking only
   for zero files it as a defect in the code. Say which it was — 「terminated during checker 50 of
   50」 rather than 「the gate failed」 — and re-run from clean rather than reasoning about the
   fragment. **The residue is the part that bites next**: processes from an interrupted run keep
   whatever locks they held, so the following run fails somewhere that has nothing to do with the
   work. Clear them, and say in the report that you did.

   **Where one entry is itself a chain of checkers, red does not mean 「one of them is wrong」 — it
   means 「everything after it was not measured」.** The exit status is honest; the reading is what
   goes wrong, and 「one place is not green」 and 「twenty-two have not been looked at」 are the same
   picture on the screen and completely different states. What closes a chapter is **one run that
   reached the end and came out green**, never how far the last one got. So say what did not run,
   as a count: 「stopped at checker 12 of 34」 names the twenty-two, and 「`check:ids` failed」 names
   none of them → *The third category comes back as a checker that did not run*.
5. **Sync the board in the same change** where the code was right and the board was
   stale — but only the layer a board contracts, which is structure rather than the
   values in its illustration → `references/judging-frames.md`.
6. **Fold what the chapter learned back into the graph, then regenerate.** A dependency
   the prerequisite list did not name, an entity that turned out to belong elsewhere, a
   table the chapter had to create — each goes into the owning chapter's `entities` or
   `creates` section, and `chapterGenerator` runs before the chapter is called closed.
   **A graph that is not regenerated at the close is a graph that stops learning**, and
   the next wave is assembled from what was true two chapters ago.
7. **Declare what this chapter brought into existence.** A key `deferredKeys` promised to
   this chapter — a migration directory, an address that renders a frame, a generated
   locale — is declared now and its promise deleted in the same change. `bta.mjs check`
   fails while the subject is on disk and the key is not declared, so this is a step that
   holds itself; what it cannot do is declare the key for you.
8. **Write the chapter's row in the state ledger**, and say what closed and what the next
   chapter is. **Do not edit the chapter file to mark it done** — its state is the
   system's state, and a file that says "done" while the system disagrees is worse than
   no file.

A chapter closes with its parked lines still open if nobody could settle them. Say which they
are; do not close them by choosing for the user. **A line naming this chapter as the one it blocks
is the exception** — that one is settled, or explicitly released on the line, before the chapter
closes → *One kind of parked line does hold a chapter*.

## Waste does not announce itself — the check that passed is the one to suspect

**Almost every hour this arrangement wastes is spent on a proxy.** Something was checked, the check
passed, and what the check was for was never looked at. Nobody notices, because a passing check and
a sound thing are the same green.

**The test, and it takes one sentence: what would have to be true for this check to pass while the
thing it protects is broken?** If the answer comes easily, the check is a proxy. One chapter's
round produced ten of these and every one answers instantly:

| The check | Passes while |
| --- | --- |
| the seed produces the figure the board draws | the figure is one a wireframe author typed and describes nothing |
| the empty-data fixture returned a response | it returned a shape the server has no way to return |
| the generated package typechecks | every module importing it is broken |
| the capture came out at a width | it is not the declared width, and the chapter now holds two instruments |
| no findings in this file | three sit under a per-file threshold |
| the rule's examples pass | its stated boundary is in the prose and not in the pattern |
| the judge read the board | it read one of the two frames that draw the screen |
| the picture is named for its frame | it is the sign-in screen at the right width in the right container |

**The proxy is never obviously wrong when it is written.** Each of those was a reasonable thing to
check; what makes it a proxy is that something else — a sketch, a fixture, a package, a threshold —
stands between the check and the subject, and the check cannot see past it.

### The question a chapter closes with

**Before the ledger row is written, ask what this round did twice.**

> Which work was undone, redone, or withdrawn — and what would have had to be different for it
> never to have been done at all?

The answer names a proxy nearly every time, and it is the cheapest finding available because the
evidence is already in the round's own messages. **A round that redid nothing has not proved it
wastes nothing** — it has usually not looked.

**Three answers are not proxies and should not be recorded as waste.** Work redone because the
product genuinely changed underneath it; a finding withdrawn because a judge read the evidence and
was right to; and an investigation that came back empty on a real question. Those are the
arrangement working.

**What is waste, and each of these happened**: a lane sent to a screen a second lane was already
shooting. An observation about a file another lane was mid-edit in, relayed as a fact and dated
nowhere. A brief that named one artifact where two govern. A demand asking for a picture the
existing captures already contain. **The common half is that the coordinator held both sides and
compared neither.**

### Fix the mechanism, not the instance

**A waste found and fixed once is a waste that returns next chapter.** So the finding lands where
the proxy lives — the check's own definition, the brief's template, the script that inherited what
it should have set — and the report says which of the three it was. A round that lists what it
wasted and changes nothing has produced a confession rather than a repair.

## What the coordinator reports

To the user, in the conversation, never into a file — the ledger and the open items hold what is
left, and git holds what happened. Aggregate the builders' returns into this shape, so two
consecutive sessions are comparable:

```text
CHAPTER: <id and name> — closed / still open
BUILT: <one line per screen: frame id, what now exists>
CAPTURES READ: <frame ids the coordinator opened and looked at / frame ids nobody opened>
PERSONA RUNS: <per persona: lines run, lines that failed and what was done>
FIXED: <grouped by defect type, one line per instance>
CROSS-SWEEP: <per defect type, other instances found and fixed, including "0 others">
CHAPTER AUDIT: <what the read-only pass found — then every finding under one of:>
  REFACTORED: <the code was wrong; what changed>
  NOW CHECKED: <the code was right by habit; which checker now holds it>
  CLOSED:     <neither, with the reason — never "later">
RULES ADDED: <defect type → where the detection rule now lives, or "none">
BOARD SYNCED: <frames corrected and the chapter regenerated, or "nothing — the code was wrong every time">
GRAPH: <what the chapter taught the prerequisite graph, and that it was regenerated>
STILL TRUE: <standing prose an agent read against what it guards and did not have to
             change — which document, what it stands over, or "none — nothing was re-read">
PARKED, STILL OPEN: <one line each, with what decision it needs and from whom>
VERIFICATION: <each gate and its result>
LEDGER: <the row written, and the next chapter>
DELIVERABLES: <what each screen owed beyond code and where it landed, or "none declared">
CAPTURES: <paths only>
```

**`CAPTURES READ` is two lists of frame ids, and the second one is the point.** 「built,
typechecked, and never opened」 is a different claim from 「done」, and a report that folds them
together hands the reader a chapter's worth of false confidence. A count cannot do it either —
the frames nobody opened are exactly the ones nobody can name afterwards, which is why the
field takes ids on both sides and 「all of them」 is not an answer. An empty second list is a
strong claim and is written out as `none` rather than left off.

**`STILL TRUE` is how standing prose gets an age.** A handover fact, a parked line, a note that
names files — each keeps saying what it said after the thing beneath it moved, and only somebody
who read it against that thing can date it. Such a reading ends with nothing to change and so
leaves no other trace, which is why it gets a field rather than a mention: without one, the agent
who looked and the agent who did not are reported identically.

`PARKED, STILL OPEN` is the part the user acts on, so it is never folded into a sentence about
progress.

**A returned item that nobody but the coordinator holds is written into a file before the next
agent is dispatched.** A builder's return lands in one place — the coordinator's context — and that
is the one place in the arrangement guaranteed not to survive: a summary keeps the shape of a
report and drops its items, and the agent that produced them is gone. So a defect the return names
in another chapter's ground, a surface it says it could not verify, a fix it deferred — each goes
to the ledger or the open items **on reading the report**, not at the end of the round. Measured:
a report naming seven pre-existing defects in other chapters' ground was read, acknowledged, and
left in context; what survived to the next window was the number seven and not one of the seven,
and recovering them means running that cluster again.

**A count is what survives, and a count reads as a record while being none.** 「seven defects in
other chapters' ground」 tells the chapter that owns them nothing it can act on, which is why the
line to write down is the item and its chapter rather than the tally.

**A builder that returns nothing has not reported.** Going quiet after committing is the common
failure, and it is expensive in a specific way: the coordinator then has to read the repository to
find out what happened, which spends the context the subagent existed to protect. Ask once. If the
answer does not come, **verify the few claims that decisions rest on — by running the thing, not by
reading the diff** — and move on rather than chasing.

**Before asking twice, check how that agent's report was supposed to reach you**, and let the
second ask name the mechanism rather than repeat the request → `references/dispatch.md` (*The unit of work is a chapter, and
one agent takes one chapter* § 8, where the brief that settles it is written.

**A reading that contradicts a report is a clock before it is a defect** — take the reading out of a
commit, never off the working tree → `references/harness.md`.

**A brief owes the same reading, and owes it harder.** Whoever holds a file has been working since
it was last opened, so an instruction written off an hours-old copy directs work against reasoning
the file already answers — and it arrives with the authority of an instruction rather than as a
claim the reader knows to check. Open the file at the moment the brief is written, not at the
moment you last had a reason to.

**Brief against the command, never against the reading it produced.** A measurement handed over as
an expectation — 「that gate is red and it is not yours」, 「the suite has two known failures」, 「the
server is already up」 — is true when written and silently false afterwards, and it is worse than
saying nothing: **it disarms the one check the agent would otherwise have made.** An agent told in
advance that a gate is red reports a genuinely new failure as the known one, in good faith, having
run the command and read its output correctly. Hand over the command and let the agent take its own
reading; where a state genuinely has to travel, mark it as a reading with its age on it, and say
which command re-takes it.

**Withdraw such a sentence the moment it goes stale, in its own message.** A correction folded into
the next instruction arrives as background and is read as background. This is not hypothetical: one
brief here named a red gate as somebody else's problem, that session fixed it four minutes later,
and the agent went on holding a briefing that told it to discount the one signal that would have
caught its own breakage.

**The same failure has a second half, and it is the one that feels like diligence.** A stale
measurement is a claim whose verification has expired; **a diagnosis inferred from reading is a
claim that never had one.** Both travel with the authority of a finding, and the second is easier
to send because working it out from the source feels like the careful version of guessing. It is
not — running it is. Where a reading is cheap, take it before the sentence leaves; a gate whose
message says it could not read the board is one command away from telling you exactly why, and two
lines of source will hand you a mechanism that is plausible, specific, and wrong.

**A file-name search answers which files contain a word, never which files do the thing.** `grep -l`
and its cousins match a comment that denies the behaviour exactly as they match the behaviour, so a
brief built from a hit list states as fact what the file may say the opposite of — 「that component
already draws on canvas」, from a file whose comment reads *drawn on a canvas-free grid of spans*.
It is the cheapest possible mistake to make and it arrives with an instruction's authority: the
agent builds on it, and the correction costs a round trip. **Open the hit before writing it into a
brief**, or hand over the search and let the agent read it.

**Send it anyway when the reading is not yours to take**, and mark which half it is. 「the anchor
is doubled」 and 「it fails here, and here are the two lines I would look at」 cost the reader very
differently when the mechanism turns out wrong: the first has to be disproved, the second is
already an invitation. A diagnosis into somebody else's file is worth sending unverified **and is
worth labelling as unverified** — what is never worth it is the confident mechanism, because the
reader spends their first command confirming your story rather than reading their own.

**A sentence in a report becomes a sentence in a document, and no gate reads a report.** The
coordinator writes the ledger and the tracking documents out of what agents send up, so an agent's
phrasing arrives there unaltered — which makes the report the one surface with no check behind it.
Two things follow, and both belong to whoever writes the sentence rather than to whoever copies it:

- **Write a defect so its direction survives being copied.** Name what is missing, not the order of
  two verbs: 「the link is written without being read first」 cannot invert, while 「reads before
  writing」 can — and inverted it names the correct behaviour instead of the fault, and reads
  perfectly either way.
- **A phrase worth quoting is written to the project's prose standard in the report**, not cleaned
  up later in the file it lands in. Whoever copies a report's sentence into a document owns what it
  now says, and runs that project's prose checks over the result.

**The hop that defeats both is a sentence drafted for somebody else's file**, and it has three
hands rather than two. An agent writes a paragraph for a document it does not own, a coordinator
relays it, a third party pastes it in — and **not one of them is writing a file at the moment they
handle it.** The rule above addresses the first and the last; the relay is where it falls through.

**The rule that closes all three is that the check belongs to the WRITE, not to the authorship.**
Whoever's edit puts the prose into a file runs the project's checks over it, whatever its
provenance. Say it that way rather than by naming roles, because the temptation is different at
each hand and each one feels like a reason:

| Hand | What it tells itself |
| --- | --- |
| the drafter | it is going into somebody else's file, so it is a proposal rather than a document |
| the relayer | it is text in a message, and a message is not a file |
| **the writer** | **it arrived looking reviewed, from a careful source, so it read as already checked** |

**The third is the one to put in front of people**, because it is the only hand where somebody
actually ran a command and was reassured by it — a document checker came back clean while the
sentence rule that would have refused the paragraph was never run. **A pass is only a pass for the
question it asked.**

This is not hypothetical: a paragraph drafted in one agent's report, relayed verbatim, and pasted
by a third session broke two rules of that project's prose standard and turned a gate red that had
been green when the work started.

**And verifying the fix has its own version of the same trap.** A prose checker that enumerates
through version control never sees a scratch file outside the repository, so it returns zero for a
draft it never opened — **the same character as a pass**, and 「I checked it first」 becomes true
and worthless. The procedure, not the anecdote: put the draft inside the tree, `git add -N` so the
enumeration reaches it, run the check, read the count, remove it.

## Generating and regenerating the chapters

The chapter set is derived from three things — the placement (which frame belongs to
which chapter), the board (what each frame draws and which roles reach it), and the
persona map. **Generate it once, regenerate it whenever the board changes**, with the
command `chapterGenerator` names — **except into a chapter whose verification is running.** A
round of verification quotes the chapter it is proving, so a sentence that moves mid-round
unfinishes every section already written; collect the change and release it when the round ends
→ `references/evidence.md` § *The demands do not move while the verification is running*.

What a generated chapter carries: the previous chapter and the state it leaves, the
chapters that must close first and those that may run alongside, the frames it owns as
board ids, and per screen a build line plus one test line per persona.

**What goes ON that test line is the whole value of the arrangement, and it is not
obvious.** A line quoting the frame's tabs, counts, messages and primary action describes
a screen being LOOKED AT; every control a person presses — the panes behind the open one,
the empty state, the search and its filters, the row actions, the header buttons, the
panel's verbs — is invisible to it, and a screen can satisfy such a line while having
none of them. Widening one chapter set from the first shape to the second had seven
screens answer 「that is not there」 which had all passed before. **`references/demands.md`
is what a demand list has to hold and why**, written for a generator this skill does not
ship.

**A frame the role map is silent about falls back to the chapter's own persona, never to silence.**
A shared pattern — a list shape, a confirm dialog, a read-only mode — is drawn inside other screens,
so the matrix that says which role reaches which screen has no row for it and a generator writing
one test line per persona writes none at all. What comes out is a section with a build line and
nothing under it, which is a screen built and never asked for anything. **Emit the same demands
under the persona the chapter's own header already names**: the body is unchanged and only the
addressee is filled in, and it comes from the value that header is computed from rather than from a
role invented for the occasion — a frame demanding of somebody the header does not name is a chapter
contradicting itself in two adjacent lines.

**Reach for the verdict word here and it is the wrong word, which is worth saying because it is the
tempting one.** A pattern reads as nobody's, and the verdict line is the skill's other way to close
a section. Read what the demands actually say before choosing: press the tab, press the row action,
open the empty list at its address, leave a capture. Those are a person in a browser — and where the
project declares `captureRoute`, a pattern **is** opened on its own, at its own address, which is
the sentence that makes the fallback a persona rather than a machine. `verdictRole` is declared as
the word for a line a machine proves; putting browser acts under it makes one word mean two things
in the field every check over a chapter's evidence keys on. Keep it for a chapter with no frames at
all.

> **Read it this way and it is wrong**: 「the chapter has test lines, so its screens are covered」.
> A count is taken per chapter and the defect is per section, so a chapter reading eight build lines
> and twenty-four persona lines looks healthy while one of its eight sections closes on nothing —
> and the silence is what makes every gate downstream quiet about it, since each of them takes its
> demands from the lines that section does not carry. `everySectionCarriesItsClosingLine` reads the
> section rather than the chapter for exactly that reason.

**A chapter with no frames is outside all of that, and the generator says which.** There
is nothing to derive for a foundation chapter — no frames, no personas, so no quoted
expectations — and a generator that wrote one anyway would produce an empty file where a
hand-written one belongs. So it excludes that chapter by name, and the exclusion is the
one place the exception is recorded: a chapter the generator skips is edited by hand, and
every other chapter is regenerated.

Two shapes must survive regeneration because the board's own gates read them: the
per-chapter placement lines that name each frame once, and the tallies that count them.
**Keep the generator with the project** — it reads that project's board layout, so it
does not belong in this skill.

## The references beside this file

Each of these is long, and only one of them is needed at a time — which is why they sit
beside this document rather than inside it. Read the one the moment calls for rather than
rediscovering it:

| When | Read |
| --- | --- |
| you are writing a brief, dispatching an agent, deciding what may run alongside, or judging whether one has stalled | `references/dispatch.md` — what a brief names and what it must never demand, the resource slots, the git index as a shared resource, what a report owes |
| you are adding a rule anywhere, or asking whether a rule is actually being held | `references/checks-and-eyes.md` — the two tables of what no machine can judge, who takes each reading and when, and proving a rule in both directions |
| you are wiring a project, or a key you need is not declared | `references/config.md` — every key, what it buys, and what its absence costs |
| a rule needs a check, or a project needs its own gates wired in | `references/checks.md` — where a gate belongs, the context it reads, and what makes one trustworthy |
| a screen disagrees with its frame and you are deciding which is wrong | `references/judging-frames.md` — the three lenses, the locale and layout rules, the anchor every finding needs |
| a screen owes something besides working code and you are listing what | `references/frame-artefacts.md` — the three reasons to photograph a screen, capture axes, fingerprints, what a stale artefact costs |
| you are writing the result document a chapter closes on, or a board fix has left a closed chapter quoting a sentence it no longer carries | `references/evidence.md` — the shape of a section, the capture naming and its ceiling, one picture per content pane, and the four paths out of a drifted quote |
| you are about to drive the product — browser, simulator, device | `references/driving-the-product.md`, which also says where a low-level command beats the tool |
| two agents must write one file, or a measurement surprises you, or a check has never fired | `references/harness.md` |
| you are deciding what the seed and the captures tell as one story | `references/scenario.md` |
| you are writing or widening the generator that produces the chapters | `references/demands.md` — what a demand list holds, why a demand is an act rather than an observation, and the three ways an irreversible verb is walked up to |
| the project has been reconciling its board frame by frame and has no chapter set yet | `references/migrating-from-a-walk.md` — what its config carries over, how the chapters are decided, and the order that leaves the project working at every step |

## Where the other skills stand

| Skill | What it owns |
| --- | --- |
| `simplecore:wireframe-boards` | authoring and syncing the board — the contract itself |
| `simplecore:board-to-app` | building the product from it, in dependency order, with the persona runs |
| the project's own screen-audit skill | driving one feature area in the browser and judging it in one sitting. A stack usually has one; where it does not, this skill's own lenses are the floor |
