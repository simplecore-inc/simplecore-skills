---
name: board-to-app
description: >-
  Use when building an application from a wireframe board in dependency order -
  chapter by chapter, foundation first - and when running the persona journeys that
  close each chapter. Also for resuming a build across sessions, deciding which
  chapters may run in parallel, and generating or regenerating the chapter set
  from the board - 시나리오 개발 · 챕터 개발 · 단계별 개발 · 개발 순서 · 페르소나 시험 ·
  병렬 개발 · 어느 챕터부터 · 다음 챕터. Requires a wireframe board; the chapter set
  is generated from it when there is none, and the application itself need not exist
  yet. NOT for a project reconciling its board on a parity walk
  (simplecore:board-parity-walk), NOT for authoring or syncing the board itself
  (simplecore:wireframe-boards), and NOT for auditing one feature area in one sitting
  (the project's own e2e skill).
---

# Building from the board, chapter by chapter

A board says what every screen holds. It does not say what has to exist before a
screen can work, and a pass that takes the board section by section will build a
list screen whose records nothing can create. **This skill builds in dependency
order**: the foundation first, then each chapter on top of the one before it,
each closing with the persona journeys, run as tests, that prove it works.

**The chapter is the unit.** One chapter is one file, the file order is the build
order, and a chapter does not start before the chapter before it has closed.

**This document is the coordinator's.** What the agent holding one chapter does
inside it is that agent's definition, which is equally binding and read there
rather than here.

## Invoking this skill is the request for the agents it dispatches

**Read this before the first unit of work, because it is the one that decides whether
any of the rest happens.** The method below is agents: one `simplecore:chapter-builder`
per chapter, a read-only agent for the chapter audit, and a coordinator that builds nothing
itself and looks at every screen once before a chapter closes. **Every one of those dispatches is asked for by the act of invoking this skill.**
No further permission is needed for them, and none is sought.

That has to be said here because many harnesses carry a standing default of *do not
reach for the Agent tool unless the user asked for it*. **That default was written for
an agent reaching for delegation on its own initiative, and it never addressed the case
where a skill's own procedure prescribes the agents.** Read as covering this, it does
not make the build careful - it silently replaces the method with a worse one.

- **The default still holds everywhere else.** No agent for a search a `grep` would
  answer, no workflow, no deep research, unless the user asks in their own words.
- **Say which agents were dispatched and why**, in the reply, so it is never silent.
- **Where the harness genuinely cannot spawn one** - no such tool at all - say so
  before starting and name what the run gives up, rather than proceeding as though the
  arrangement were intact.

> **Read it this way and it is wrong**: 「the ban is absolute and the dispatch is one
> line inside a procedure, so obeying the ban is the careful reading」. It is the
> reading that discards the method while leaving every sentence describing it in place.
> What comes out is a coordinator that builds each chapter in its own context, dries
> out partway through, and leaves half-built code behind - with every judgment it still
> owes made on a context with no room left. The build reads as the method from outside,
> because the coordinator is doing all the same steps; what is gone is the property the
> steps depend on, that whoever judges a chapter is not whoever built it.

## Precondition: a board, and a chapter set derived from it

**No board, no build.** With nothing to build against, every judgment collapses
into somebody's opinion of the screen in front of them. Do not substitute a spec, a
screenshot, a list of routes, or a description of what the screens ought to be, and
do not draw frames while building - that is authoring a board
(`simplecore:wireframe-boards`), and it produces a board shaped by the code rather
than a contract the code is measured against. Offer `/simplecore:board-init` and let
the board come first. **A build config sitting in a project with no board is the
same situation wearing a hat**: report it as wiring that cannot hold rather than
building anyway.

**The application is the opposite case: it does not have to exist yet.** A board
drawn before the code has every screen still to build, and that is what this skill
is for.

**No chapter set and no other build arrangement in place: generate one before
starting** (below), where the request named this way of building - chapters, dependency
order, persona journeys. Building from the board directly, chapter by chapter in
somebody's head, is the thing this skill exists to replace: the order stops being
written down, and the second session cannot tell what the first one closed.

**A request that only asks for the screens to be built, on a board with neither this
skill's config nor a parity walk's, has two answers, and the user picks.** Say what each
buys - this skill builds the board chapter by chapter in dependency order and closes each
chapter on its journeys; `simplecore:board-parity-walk` reconciles the frames against a
running application one cluster at a time - and wire neither until the user has chosen.

**A project already running a different arrangement is the other case, and generating
a chapter set there is not setup - it is a migration, and a migration starts only when
the user asks for it in so many words.** The tell is concrete: another build skill's
config file sits in `.claude/`, where this one's would go. Converting the project on
the strength of that discovery rewrites how a team works and discards the documents
they have been maintaining, and nothing readable from inside the repository says
whether they want it - which is what puts it in the class this skill already reserves
for a person. So **stop, say what the move would involve, and wait.** The procedure is
`references/migrating-from-a-walk.md`, and reaching it is not permission to run it.

**Asked in so many words means the request names the move** - off the other
arrangement and onto the chapters, in the user's own words. A request to build the
next chapter, to fix a screen, or to set the project up is not that request, and each
of those is answered by saying which arrangement the project is on and asking whether
to move it.

## What the project declares - `.claude/board-to-app.json`

→ `references/config.md`.

## One repository, two boards - every run names which one

**A session is about ONE board, and it says which before it does anything.** A repository drawing
two products declares both under `boards` and gives each its own chapters, ledger, handover and
evidence; what they share is the glossary, the gates, the locales and the repository itself. Nothing
about one board's progress is readable from the other's, which is the whole reason they are declared
apart.

- **Name it on every command**: `node bta.mjs check --board <name>`, or run the command from inside
  that board's own folder and it resolves itself. A project declaring several while nothing says
  which is refused - everything a run writes lands under one board, and a guess puts a chapter, a
  ledger row and a folder of captures somewhere somebody has to find again to undo.
- **Say it in the first line of the report**, beside the chapter: 「workbench 보드 · O 챕터」. A
  coordinator's return that names a chapter and not its board is one nobody can act on, because both
  boards number their chapters from the beginning.
- **Two boards are two builds and may run at once** - they touch different screens and different
  ledgers. What they must not do is share a working tree at the same moment for the same reason two
  chapters must not: `git` is one tree, and two agents writing it are one agent's work lost.
- **A chapter of one board never depends on a chapter of the other.** Where the two products do share
  something - a schema, a protocol, a module - that shared thing is a chapter of the board whose
  product owns it, and the other board's chapter names it in its handover rather than in its
  prerequisites. A prerequisite that crosses boards puts one build's progress inside the other's
  ledger, which is the arrangement `boardsGate` exists to keep off disk.

## The rules the build runs on

1. **Dependency order, not board order.** A chapter starts only when every chapter
   in its `prerequisites` section has closed. The board's section letters are a
   subject index, not a build order.
2. **A chapter closes on its journeys, not on its code.** Working screens with no journey
   run is an open chapter, and so is a foundation chapter whose verifications nobody
   executed.
3. **Parallel chapters join before they are tested.** Two chapters that reference
   none of each other's frames may be built at once by separate agents - but the
   persona tests wait until both are standing, because the test walks between
   screens that live on both sides.
4. **The board contracts structure, and only structure.** Which screens and states exist, how
   one reaches another, which roles reach each and how far their data goes, and which KINDS of
   control a screen carries - a list with row actions, a filter, tabs, a detail panel with these
   verbs, an empty state, a dialog with a primary action. A screen missing any of that is wrong
   even when it looks better. Everything else the board draws is guidance: a label or a message
   is the default wording, and a count, a name, a date or a sample row is illustration. Where
   the product's wording deliberately differs, sync the board (`simplecore:wireframe-boards`);
   where its data differs, nothing is owed → *What data should exist*, below.
5. **Chapters are generated, never hand-edited - except the ones the generator excludes.**
   Its structural requirements and its journeys are derived from the board; editing them by
   hand makes the file agree with the code instead of with the board. Fix the board, regenerate,
   rebuild. **A
   chapter that places no frames is the exception**: a foundation chapter has no board to
   fix, so `chapterGenerator` leaves it alone and it is written and corrected by hand.
   Which chapters those are is read off the generator's own exclusion rather than guessed,
   and a chapter that places even one frame is never one of them.
6. **The persona is the tester, not a label.** Each screen names the personas that
   reach it and what each one must and must not be able to do, and each persona has its own
   journey. A run that only exercises the full-access role has tested a quarter of the screen.
7. **A correction becomes an instruction.** A builder that built the wrong thing, an
   agent that returned nothing, a handover the next session could not use - none of
   those is the agent's failure, and correcting that one agent leaves the next to make
   the same mistake in the same place. Fix what the agent was told, in the same change
   → *What is learned goes back into the instructions*, below.

## Opening a session

1. **The config**, read against the key table in `references/config.md` - `bta.mjs doctor`
   prints every absent key with what it costs, and a missing required key is reported
   before anything else happens. **On a project declaring several boards, which board this
   session is about is settled here and named in every line afterwards.**
2. **The chapter table and the state ledger.** The open chapter is the first one whose
   tests have not all passed - not the first with missing code.
3. **The open items.** What the last session parked is read before anything is
   dispatched: settling one usually changes what the next chapters should look like.
   A decision settled is applied to the code or the board, and its line is deleted.
4. **The handover file** - how to stand the system up, the known traps, which
   accounts and data are already standing.
5. **The chapter file, whole**, before touching anything. It states the state the
   previous chapter left behind; if the running system is not in that state, the
   previous chapter did not close and that is the work.

Then say which chapter is being built and which are running alongside it.

## The chapter's scenario is re-reviewed at its start, never merely read

Step 5 above says to read the chapter file whole. **Reading it is not reviewing it**, and that
difference is the whole of this section: a generated chapter reads as derived and therefore
correct, and it was correct - on the day it was generated. Everything it quotes has been moving
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
| the journeys | that entity's own scope column in the design | the lines come from the role matrix, which is per cluster and knows nothing about whether the record has an axis to be scoped on. 「only their own scope appears in the list」 asked of an installation-global entity is a demand nothing can satisfy, and an agent handed it builds a filter to satisfy it |
| every statutory or policy value it quotes | `factSources`, now | the chapter naming a value is not the value having been verified - the chapter quotes the frame, and the frame quotes whoever drew it. Read the article's own text against the sentence, and check that the cited paragraph is the one placing the duty the sentence states |
| a design line it calls stale | that design chapter today | 「the dictionary's line is stale」 is a claim somebody made at generation time, and the commonest reason it is now wrong is that the line was corrected afterwards |
| what its seed owes | `storyDocument` | a chapter in neither the story's step table nor its exclusion table has a seed nobody has placed in the story - and the cross-chapter facts a seed needs, such as two people whose correlation must fail, are settled here or nowhere |
| the parked lines naming it | `openItemsFile` | one of them may hold the chapter, and meeting that at the close is meeting it too late |

**What makes this skippable is that nothing about the file looks stale.** It is regenerated prose
in the project's own voice, every number in it came from the board, and the sections are uniform -
so the reading that would catch a wrong demand feels like re-reading a document just produced.
**The tell is that the chapter was generated once and everything it cites has been edited since**,
which is true of every chapter after the first.

**What the review finds is fixed where it came from, before the dispatch** - the board where the
board is stale, the design chapter where the design is, `creates` and `entities` where the graph
is - and the chapter is regenerated after each. A finding that travels into a brief as a warning is
one the agent has to re-derive; a finding fixed in the source is one the regenerated chapter states
by itself.

## The unit of work is a chapter, and one agent takes one chapter

→ `references/dispatch.md`, read before writing a brief or dispatching an agent.

## The wave: parallel backends, one restart, then the screens

**Backends are built in parallel, the coordinator restarts once at the barrier, and the screens
come after it.** Backend work needs no shared running server, so the restart collision cannot
happen while it runs, and by the screens the contract is fixed. **The coordinator dispatches the
backends, runs the barrier itself, and dispatches the screens**; everything else is the agents'.
**A screen agent's instrument is the browser**, so screens taken in turn are still opened by each
agent that takes them. **A wave is the chapters whose prerequisites have all closed**, which the
state ledger states, so the wave is decided rather than judged. **An agent that finds a dependency
the prerequisite list does not name stops and reports it** rather than inventing the table: the
list is derived from the frames' cross-references, and the graph learns only when the owning
chapter's `creates` section names it and the set is regenerated. **A wave that cannot be
assembled cleanly runs its chapters whole and alone, one at a time**: the arrangement pays for
itself at three chapters or more, and for two it costs more coordination than it saves.
→ `references/dispatch.md` § *The wave: parallel backends, one restart, then the screens*, read
when a wave is planned - what still collides inside the backends, and how migrations are shared
out under each scheme.

## What the chapter already knows about the future

Two of a chapter's header sections are computed from the board and are worth opening
before a line of code is written:

- **`usedLater`** - later chapters whose frames point at this chapter's screens, with
  the frame ids. Those screens already say what they expect of yours. **Open them
  now.** A column they will need costs nothing today and costs a migration and a
  re-run of a closed chapter's persona lines later.
- **`promises`** - screens this chapter's frames point at that do not exist yet.
  Leave the destination unbuilt, but leave the promise visible rather than quietly
  dropping the link.

This is the cheap half of looking ahead, and it is available before the build starts.
The expensive half - an entity dependency nobody wrote down - surfaces while building,
and the rule for it is the same: stop, report, let the graph learn.

## Touching a chapter that already closed

**A closed chapter's file is not edited and the chapter is not reopened**: it records what was
true when it closed. A change to its ground is written in the open chapter's `touchedEarlier`
section, read against the closed chapters that use it and the unbuilt ones that already depend on
it, and named in the commit's `Touches:` trailer. **A change to a closed chapter's code that is not
written down is the one thing this arrangement cannot survive**: the next agent builds on a chapter
file that no longer describes the code. **A frame the board gains later is appended to the end of
the owning chapter's list**, so no earlier section number moves. **A change that reaches many
screens is verified by a sample and a census**: every screen the change is about plus one other,
in full, and a search naming the sites that reach the mechanism and the sites that do not.
→ `references/changing-closed-chapters.md`, read before the open chapter changes anything an
earlier chapter built.

## The dependency tree the history leaves behind

**Every commit carries `Chapter:`, and every cross-chapter change carries `Touches:`**, because a
diff shows which files changed and never which chapter's contract moved. **A commit that belongs
to no chapter says `Chapter: setup`.** **The trailer block is the message's last paragraph, one
trailer per line**, because one line wrapped at column 0 makes git discard the whole block.
**Whether the build may commit at all is answered once** - by the repository's own rules, and by
`commitPolicy` where they say nothing - and the build follows that answer without raising it again;
with neither, it asks. → `references/commits.md`, read before the first commit of a session.

## Development, then the journeys

A chapter carries two kinds of line: what to build, and the journeys that prove it. Build the
whole chapter first - a journey walks between screens, and it cannot run while one of them is
missing.

**A journey is one persona finishing one piece of work across the chapter's screens.** It starts
where that person starts, presses the way from screen to screen through the running application,
finishes the primary action, and states what must then be true - as relations, never as values:
the record it made appears in the list it belongs to, the tile above the list counts it, the
detail it opens is that record, the persona it refuses is refused at the address. A negative
journey is one journey too: a persona the chapter's screens do not admit reaches the address and
is denied on the server.

**Every journey is written as an automated test and kept with the product**, under the directory
`journeyTestsDir` names, in the project's own test framework, and it is run by `journeyCommand`.
**The passing run is the evidence.** The command writes one run record per chapter into
`evidenceDir` - one row per journey with its persona, its test and its result, and one capture per
screen-state the journey visited - and nothing about the verification is written by hand.

**A chapter that places no screens carries a machine verification where a screen chapter carries
a journey** - the migration that rolls back to the same schema, the expired token that is refused -
and it is executed rather than reasoned about. Everything below is written for the journey because
that is the common case; it holds for a verification line word for word.

**Run each journey as that person.** The test signs in with that role's account and reaches only
what that person reaches. A test that signs in as an administrator and then narrows a filter has
not tested the supervisor, and a scoped role's boundary is proved on the server - the record
reached by its address and refused - never by a hidden button.

**A journey asserts relations and structure, never the board's values.** A tile equals the count of
what its list holds; a detail shows the record the row named; a new record is in the list and the
count grew by one; the empty list shows guidance and a next action. A test that asserts 「the tile
reads 119」 or 「the first row is TN-3600M」 has copied the illustration into the fixture, and it
passes for a product that shows nothing of the kind → `references/scenario.md`.

## Matching the structure is the floor, not the verdict

A screen can carry every control its frame draws and still be one nobody can work in. The board
settles what is on the screen; it does not settle whether the screen holds up when a real person
opens it in the longest language it ships in and presses everything.

So each screen is **looked at once, in character**, at the chapter's close - by the coordinator,
opening the captures the journey run left, as the operator whose work the screen carries. Looking
is for what no test can fail on: a label cut at an edge, a font with no glyph, a control nobody
can see, a state frame that came back as its base. **One look per screen-state, and the findings
of that look are fixed in one round** → `references/evidence.md` § *One look per screen-state, and
one round*. The lenses, the locale and alignment
rules, and the anchor every finding needs → `references/judging-frames.md`.

## When a screen and its frame disagree

1. **Decide which layer disagrees, because only one of them is a defect.** A missing state, a
   control of the wrong kind, a way between screens that is not there, a role that reaches what
   it must not - that is structure, and it is fixed in the product, then the journey is run again.
   A label worded differently, a count that is not the drawing's, a sample row that is not on the
   screen - that is guidance and illustration; where the product's wording is the deliberate one,
   sync the board, and where it is data, nothing moves.
2. **A structural defect a machine could see becomes a check the moment you understand it**, in
   `auditScript` or as a helper every journey test calls - never as a sentence a person re-verifies
   per frame. Most defects that reach a person are mechanically visible once somebody has
   described them precisely: a control with no destination, a route with no server-side guard, a
   list with no empty state. Where it belongs and how it is proved → `references/checks-and-eyes.md`.
3. **Only what needs a person goes to a person**, and it goes to the open items, not into a pause.

Do not write audit findings into documents. A finding was fixed, became a check, or is a line in
the open items.

## Parking is a last resort, and most things do not qualify

**The default is to decide**, and only what no design can derive is parked: narrowly, as one line
in the open items, written there before anybody is told it is parked. **A line naming the chapter
it blocks holds that chapter's close**; any other parked line leaves the close alone.
→ `references/handover.md` § *Parking is a last resort, and most things do not qualify*, read before
parking anything and before honouring a parked line. `simplecore:board-parity-walk` follows the
same file.

## Two kinds of leaving-behind, and only one is shared

**Facts go to `handoverFile`, in present-state declaratives with no point of view; narrative goes
to one log per agent under `logDir`, one line per step as it ends.** **A trap an agent worked out
is in the handover file before that agent stands down**, because a report reaches the
coordinator's inbox and no further. **A handover file that has grown past being read whole becomes
an index that routes**, and every check over it follows the routing. → `references/handover.md`,
read before writing to the handover file and before splitting one.

## A quiet agent is stalled or inside something long

**Judge by the artifact, never by the signal**: an idle announcement races the work and settles
nothing. **Two checks in a row with no step report and no change to the artifact are a stall; a
still artifact alone is not**, because an agent replaced on a still artifact was usually inside
something long. **Then stop it, dispatch a replacement from the artifact's progress line, and never
leave both alive over one artifact. Do not queue more work at a silent agent.**
→ `references/dispatch.md` § *A quiet agent is stalled or inside something long*, read at each
check on a quiet agent. A session that ended for an outside reason is `references/harness.md`
§ *An agent that ends, and an agent that only paused*.

## Letting a person watch, without paying for it

**Progress goes into files whose paths are the report** - run logs under `logDir`, captures under
`capturesDir`, what each chapter cost under `costLog` - so the coordinator and the user can open
one and neither pays for it by default. **Arm both watches in the turn the agent is dispatched,
and prove each fires before trusting its silence**: a watch that died, or never lived, produces
what a working one produces on a quiet minute. **Forward captures by path, unopened, as they are
shot; never put an image in a report; show a changed screen rather than describing it.**
→ `references/dispatch.md` § *Letting a person watch, without paying for it*, read in the turn an
agent is dispatched.

## What a chapter owes besides working code

Working screens are the floor. A chapter also owes, for every screen in it:

- **The states the board draws** - the dialogs, panel forms and empty states are part of the
  screen's structure, not a later polish pass. An empty list shows guidance and a next action;
  which words is the product's.
- **The role boundary, enforced on the server.** A hidden button is not a boundary; the negative
  journey for a scoped role must be refused when the record is reached by its address.
- **The board's wording as the default.** Use the labels and messages the board wrote unless the
  product has a reason not to, and where it has one, sync the board in the same change. A
  paraphrase is never a defect and never fails a gate.

Whatever `frameDeliverables` declares is a standing check every screen must satisfy, each
sentence naming the mechanism that holds it, and the list is where a defect the running product
showed lands when no frame can draw it → `references/frame-artefacts.md`.

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
   | **Where** | the development server this build stands up - `localhost`, `127.0.0.1`, `[::1]`, or the development machine's own address. The handover file names the origins this build uses; anything it does not name is not this build's server |
   | **Out of scope** | a remote host - production, staging, a shared environment - the user's own accounts, and any external service. Each of those is asked for, and none of them is on the way to a chapter closing |
   | **Where a credential comes from** | the project's development configuration, its seed, a `.env`-shaped file, a fixture, or a value the user supplied. **Never invented.** Where none can be found anywhere, that is one of the questions below that waits for a person |
   | **Where there is no account** | a development server exposing a sign-up screen gets a test account made on it, and the run continues |
   | **Where a credential must not go** | a reply, a log line, a capture caption, a run record, a commit, or any file. It reaches the process signing in and stops there |
3. **What data should exist?** The seed makes the story's relations true against the schema:
   every record the chapter's screens need exists, connected as the entity model says, in every
   state the board draws, for every persona the journeys name. **Its values are its own.** The
   counts, names and dates the board draws are illustration, and a screen whose numbers differ
   from the drawing is not a defect; a screen whose own figures disagree with each other is. One
   story, one site, every chapter on top of the last → `references/scenario.md`.

   **And it is produced by the path the product uses.** Typing a value into a fixture so the screen
   shows a wanted figure is never allowed - a capture of a screen fed hand-written values is
   indistinguishable from a real one in every check and to every later reader, so it does not fail
   to prove the product works, it **produces evidence that it works when nothing has been shown
   to**. The fake belongs at the wire - a recorded or edited response from whatever the product
   reads - never past the decoder, because the decoding is most of what the screen displays. Where
   the real path is awkward to reach, make it reachable and report the cost; routing around it is
   the one move that is not available → `references/scenario.md` § *A value a capture shows*.
4. **An unresolved question in a frame.** A frame carrying an open question - `OPEN:`, or whatever
   marker that board writes for one - is built as drawn and does not hold the chapter: the open
   question travels with the frame, not with the build.
   Where `factSources` names a tool that settles it - article text, the version in force on a date,
   **the annex forms whose boxes are the record's fields** - verify it there and correct the board.
   Only a question no source can answer waits for a person, and it is left marked rather than
   asserted.

**Write the handoff as you go, not at the end.** A session cannot reliably tell how much room it
has left - there is no gauge, only the growing weight of what it has already read. So the state
that lets the next session start without asking anything is written the moment it changes; a
handoff composed once the context is nearly spent is the one that does not get written.

**Stop and ask only for these**: a decision that changes what the product is, a term whose
translation is genuinely undecided, a value no source can settle, a development credential no
project file supplies, and **moving a project off another build arrangement onto this one** - plus
anything the repository's own rules reserve for the user. **Committing and pushing are not a fifth**: it is answered once - by the repository's own
rules where they say, and by `commitPolicy` where they do not - and the build follows the answer
without raising it again → *The dependency tree the history leaves behind*. **Everything else has a written answer here**, and a session that
opens the ledger, reads the first open chapter and dispatches has already answered "what next".

### Design the answer; scope is not a reason to take the worse one

**A wider refactor is not a reason to decline the better structure**: say its cost, then build the
right shape, because the smaller worse option comes back three chapters later as a rewrite of
everything built on it. **Design against the code that will implement it, not against the
documents alone**: the board and the design document agree with each other more readily than
either agrees with the branches already in the server. → `references/judging-frames.md`
§ *Design the answer; scope is not a reason to take the worse one*.

## The documents, the board and the code say the same thing

**A change updates the design documents, the board and the code in the same change**, because two
out of three reads as agreement and is not. **Where they cannot agree, the disagreement is written
down** with which side is stale, and **it is never resolved by editing whichever is cheapest**:
cheapness is not authority. **Date both sides before ranking them**, since most disagreements are
one stale side; where dating leaves them level, a source `factSources` names beats the design
document, which beats the board, which beats the code, which beats a capture.
→ `references/judging-frames.md` § *The documents, the board and the code say the same thing*,
read before resolving a disagreement between them.

## Every rule here is held by a machine or marked as needing eyes

→ `references/checks-and-eyes.md`.

## What is learned goes back into the instructions, in the same change

**Never end with only the work corrected**: a defect fixed once and walked past grows back next
session. **The finding lands in the same change, proved to fire, and named out loud** - a rule in
`auditScript`, this skill or the brief for something about coordination, the project's own config
for what is true only there. **`instructionBudget` puts a ceiling on every instruction file**, so
adding a rule means trading one, and **a rule that gets a check gives up its paragraph to the
check's message**. **Write it into the checkout, never into an installed copy**, which the next
install deletes. → `references/checks-and-eyes.md` § *What is learned goes back into the
instructions, in the same change*, read whenever a finding is about to be recorded.

## Closing a chapter

### The product's owner can end a chapter, and the ledger says that is what happened

**Whoever owns the product may decide a chapter is done, and the build has no standing to refuse.**
The screens are good enough, the round has cost more than it is worth, the work has moved on -
none of those are the build's call, and a skill that answers 「the evidence is not finished」 to the
person the evidence is for has mistaken who it works for.

**What the build does owe is that the two kinds of close never look alike afterwards.** A chapter
closed on its verification has captures somebody who did not take them read against the board; a
chapter closed by decision has whatever happened to be true when the decision was made. Written
with the same word, the second is indistinguishable from the first six months later - and every
check that reads a closed chapter's evidence reports its absence as a defect, which teaches the
next reader to turn the check off.

So the ledger writes a different word, `decidedStatus`. The evidence checks skip those chapters,
and the row goes on saying plainly which kind it was.

**Three things go in the row with it**, because a decision nobody can weigh later is worse than an
open chapter:

| | |
| --- | --- |
| who decided | not the build, and not an agent - name the person |
| what was true when they decided | what had been verified and what had not, in the state it was left |
| what is owed if it is reopened | the run that was not finished, so a later round starts from a fact rather than a guess |

**Never close a chapter on the build's own judgment.** The build closes a chapter on evidence or it
leaves it open; the other word is the owner's to spend, and an agent writing it because a round got
long has forged the one signature in the ledger that is not its own.

A chapter closes when every screen in it works, every journey passes, and the findings of one
look are fixed rather than listed. Before saying so:

1. **Run `journeyCommand` and read the run record it wrote.** Every journey the chapter names has
   a row, every row reads pass, and a capture stands for every frame the chapter placed - a frame
   no journey visited is a screen nobody opened, and `everyPlacedFrameIsCaptured` says so. A
   failing journey is fixed in the product and the command is run again; the record is never
   edited by hand.
2. **Look at every capture once, as the persona, then at the chapter's captures together; fix
   what the look finds in one round** → `references/evidence.md` § *One look per screen-state,
   and one round*. A third round is a new chapter's work, or the owner's decision to end this
   one → *The product's owner can end a chapter*.
3. **In a simplix-react project, the journey run is the browser pass for the chapter's screens, and
   the close-out invokes `simplix:frontend-e2e` for its censuses.** The journeys already drove every
   screen the chapter places through a real browser as its personas, so a second walk of the same
   screens repeats that measurement; what the journeys do not take is the e2e skill's mandatory
   censuses and its cross-screen agreement censuses, run over the chapter's screens and fixed in the
   same round as the look.
4. **Sweep each defect type across the chapter's code once**, by search, and fix what it finds;
   report the sweep per type, including 「0 others」. A type a machine can see becomes a rule in
   `auditScript` in the same change, run across the whole tree.
5. **Audit the chapter's code with a read-only agent while nothing else is running**, and act on
   every finding in the same session: the same logic in two places, a file whose parts stopped
   belonging together, one idea under two names, a convention nothing holds. Each finding leaves as
   a refactor done now or a check written now - a check is code in `auditScript` or a helper the
   journey tests call, never a sentence somebody re-reads - and a finding worth neither is closed
   with its reason rather than deferred.
6. **Run every command in `gates`**, all of them, green, each read by its exit status rather than by
   the tail of its log → `references/harness.md`. `bta.mjs check` is one of them, run with
   `--range <the commit the chapter started from>..HEAD` so the gates that read commits read
   every commit the chapter made rather than HEAD alone, and `bta.mjs gates` runs whenever a gate
   was added or changed. **This run happens after the builder has
   returned, never beside it**; a killed run (`143`) is neither red nor green and is run again from
   clean, with the residue cleared and said so.
7. **Sync the board in the same change** where the product was right and the board was stale -
   the structural layer only, and the wording the product deliberately chose →
   `references/judging-frames.md`.
8. **Fold what the chapter learned back into the graph, then regenerate.** A dependency the
   prerequisite list did not name, an entity that turned out to belong elsewhere, a table the
   chapter had to create - each goes into the owning chapter's `entities` or `creates` section, and
   `chapterGenerator` runs before the chapter is called closed.
9. **Declare what this chapter brought into existence.** A key `deferredKeys` promised to this
   chapter is declared now and its promise deleted in the same change.
10. **Write the chapter's row in the state ledger**, and say what closed and what the next chapter
    is. The closed word is the coordinator's to write, here and nowhere earlier: the builder reports
    the chapter ready to close and writes no closed word. **Do not edit the chapter file to mark it
    done** - its state is the system's state.

A chapter closes with its parked lines still open if nobody could settle them. Say which they are;
do not close them by choosing for the user. **A line naming this chapter as the one it blocks is
the exception** - that one is settled, or explicitly released on the line, before the chapter
closes → `references/handover.md` § *One kind of parked line does hold a chapter, and it is not a
park at all*.

## Waste does not announce itself - the check that passed is the one to suspect

**Almost every hour this arrangement wastes is spent on a proxy**: something was checked, the check
passed, and what it was for was never looked at. **Ask of every check what would have to be true
for it to pass while the thing it protects is broken**; an answer that comes easily makes it a
proxy. **Before the ledger row is written, ask what the round did twice**, and land the answer
where the proxy lives - the check's definition, the brief's template, the script that inherited
it - rather than fixing the instance. → `references/checks-and-eyes.md` § *Waste does not announce
itself - the check that passed is the one to suspect*, read before the ledger row that closes a
chapter.

## What the coordinator reports

To the user, in the conversation, never into a file - the ledger and the open items hold what is
left, and git holds what happened. Aggregate the builders' returns into this shape, so two
consecutive sessions are comparable:

```text
CHAPTER: <id and name> - closed / still open
BUILT: <one line per screen: frame id, what now exists>
JOURNEYS: <per persona: journeys run, journeys that failed and what was done>
LOOKED AT: <frame ids the coordinator opened and looked at / frame ids nobody opened>
FIXED: <grouped by defect type, one line per instance, and which round found it>
CROSS-SWEEP: <per defect type, other instances found and fixed, including "0 others">
CHAPTER AUDIT: <what the read-only pass found - then every finding under one of:>
  REFACTORED: <the code was wrong; what changed>
  NOW CHECKED: <the code was right by habit; which check now holds it>
  CLOSED:     <neither, with the reason - never "later">
RULES ADDED: <defect type → where the detection rule now lives, or "none">
BOARD SYNCED: <frames corrected and the chapter regenerated, or "nothing - the code was wrong every time">
GRAPH: <what the chapter taught the prerequisite graph, and that it was regenerated>
STILL TRUE: <standing prose an agent read against what it guards and did not have to
             change - which document, what it stands over, or "none - nothing was re-read">
PARKED, STILL OPEN: <one line each, with what decision it needs and from whom>
VERIFICATION: <each gate and its result>
LEDGER: <the row written, and the next chapter>
RUN RECORD: <path of the run record and its captures>
```

**`LOOKED AT` is two lists of frame ids, and the second one is the point.** 「built, green, and
never opened」 is a different claim from 「done」, and a report that folds them together hands the
reader a chapter's worth of false confidence. A count cannot do it either - the frames nobody
opened are exactly the ones nobody can name afterwards, which is why the field takes ids on both
sides and 「all of them」 is not an answer. An empty second list is a strong claim and is written
out as `none` rather than left off.

**`STILL TRUE` is how standing prose gets an age.** A handover fact, a parked line, a note that
names files - each keeps saying what it said after the thing beneath it moved, and only somebody
who read it against that thing can date it. Such a reading ends with nothing to change and so
leaves no other trace, which is why it gets a field rather than a mention: without one, the agent
who looked and the agent who did not are reported identically.

`PARKED, STILL OPEN` is the part the user acts on, so it is never folded into a sentence about
progress.

**A returned item that nobody but the coordinator holds is written into a file before the next
agent is dispatched.** A builder's return lands in one place - the coordinator's context - and that
is the one place in the arrangement guaranteed not to survive: a summary keeps the shape of a
report and drops its items, and the agent that produced them is gone. So a defect the return names
in another chapter's ground, a surface it says it could not verify, a fix it deferred - each goes
to the ledger or the open items **on reading the report**, not at the end of the round: a summary
keeps the count and drops the items → `references/dispatch.md` § *What a return names survives only
in a file*.

**A count is what survives, and a count reads as a record while being none.** 「seven defects in
other chapters' ground」 tells the chapter that owns them nothing it can act on, which is why the
line to write down is the item and its chapter rather than the tally.

**A builder that returns nothing has not reported.** Going quiet after committing is the common
failure, and it is expensive in a specific way: the coordinator then has to read the repository to
find out what happened, which spends the context the subagent existed to protect. Ask once. If the
answer does not come, **verify the few claims that decisions rest on - by running the thing, not by
reading the diff** - and move on rather than chasing.

**Before asking twice, check how that agent's report was supposed to reach you**, and let the
second ask name the mechanism rather than repeat the request → `references/dispatch.md` § *The unit of
work is a chapter, and one agent takes one chapter*, item 8, where the brief that settles it is
written.

**A reading that contradicts a report is a clock before it is a defect** - take the reading out of a
commit, never off the working tree → `references/harness.md`.

**A brief is written against the file as it stands and against the command, never against a
reading.** Open the file at the moment the brief is written; hand over the command rather than the
reading it produced, because a reading handed over as an expectation disarms the check the agent
would otherwise make; withdraw a stale sentence in a message of its own; and mark a diagnosis that
was inferred rather than run as unverified. **The check belongs to the write, not to the
authorship**: whoever's edit puts prose into a file runs the project's checks over it, whatever
its provenance. → `references/dispatch.md` § *A brief owes the reading the file gives at the moment
it is written*, read before writing a brief, and `references/dispatch.md` § *A sentence in a report
becomes a sentence in a document*, read before copying a report's sentence into a document.

## Generating and regenerating the chapters

The chapter set is derived from three things - the placement (which frame belongs to which
chapter), the board (what each frame draws and which roles reach it), and the persona map.
**Generate it once, regenerate it whenever the board changes**, with the command
`chapterGenerator` names - at a chapter's open, before its first agent goes out, and again at its
close after the graph has learned. Regenerating mid-chapter changes what the builder is building
to; hold a board fix until the chapter closes unless the fix is the reason it cannot close.

What a generated chapter carries, and nothing else:

| Part | What it holds | Derived from |
| --- | --- | --- |
| the header | the previous chapter and the state it leaves, the chapters that must close first and those that may run alongside, the entities it creates, the frames it owns | the placement |
| **one structural line per frame** | the address, the kinds of control the frame carries and how many of each - a list with N row actions, a filter, N tabs, tiles, a detail panel with N verbs, an empty state, a dialog with a primary action - and the roles that reach it with their scope. Labels are named in parentheses as the default wording | the frame's own drawing |
| **the journeys** | one per persona the chapter's screens admit, and one negative journey per persona they refuse: the screen it starts on, the way it presses between screens, the primary action it finishes, and what must then be true, as relations | the roles, the frames' cross-references, each frame's primary action |
| **the seed relations** | what the story must make true for these journeys to run - records connected as the entity model says, in the states the frames draw | the frames' tiles, tabs and entities |
| the verdict lines | for a chapter that places foundation: the machine verification that closes it | the placement |

**No line of it quotes a value, a count, a sample row or an exact message.** A demand that copies
a figure out of a frame makes the seed answer to a sketch, and a test written from it passes for a
product showing nothing of the kind. Every sentence the generator writes is one a journey test
can assert with no number known in advance → `references/demands.md`.

**A frame the role map is silent about falls back to the chapter's own persona, never to silence.**
A shared pattern - a list shape, a confirm dialog - is drawn inside other screens, so the matrix
has no row for it. Its structural line is written under the persona the chapter's header names,
and the journey that opens the screen it lives in covers it.

**A chapter with no frames is outside all of that, and the generator says which.** There is
nothing to derive for a foundation chapter, so it excludes that chapter by name, and the exclusion
is the one place the exception is recorded: a chapter the generator skips is edited by hand, and
every other chapter is regenerated.

Two shapes must survive regeneration because the board's own gates read them: the per-chapter
placement lines that name each frame once, and the tallies that count them. **Keep the generator
with the project** - it reads that project's board layout, so it does not belong in this skill.

## The references beside this file

Each of these is long, and only one of them is needed at a time - which is why they sit
beside this document rather than inside it. Read the one the moment calls for rather than
rediscovering it. Commands in this skill's references are written from the plugin root, which is ${CLAUDE_PLUGIN_ROOT}.

| When | Read |
| --- | --- |
| you are writing a brief, dispatching an agent, planning a wave, deciding what may run alongside, arming a watch, or judging whether one has stalled | `references/dispatch.md` - what a brief names and what it must never demand, the resource slots, the wave, the git index as a shared resource, the stall test, the watches, what a report owes |
| the open chapter has to change something an earlier chapter built, or one change reaches many screens | `references/changing-closed-chapters.md` - the `touchedEarlier` record, a frame appended to a closed chapter, the sample and the census |
| you are about to commit, or writing a trailer | `references/commits.md` - `Chapter:` and `Touches:`, the trailer block git can read, and `commitPolicy` |
| you are parking a decision, honouring a parked line, writing to the handover file, or splitting one | `references/handover.md` - the parking rule and the handover rules, shared with `simplecore:board-parity-walk` |
| you are adding a rule anywhere, recording what a round learned, or asking whether a rule is actually being held | `references/checks-and-eyes.md` - the register of what a gate holds and the table of what needs eyes, who takes each reading and when, proving a rule in both directions, what is learned and where it lands, and waste |
| you are wiring a project, or a key you need is not declared | `references/config.md` - every key, what it buys, and what its absence costs |
| a rule needs a check, or a project needs its own gates wired in | `references/checks.md` - where a gate belongs, the context it reads, and what makes one trustworthy |
| a screen disagrees with its frame and you are deciding which is wrong, or the documents, the board and the code disagree | `references/judging-frames.md` - the lenses, the locale and layout rules, the anchor every finding needs, designing the answer, and which artifact is authority |
| a screen owes something besides working code and you are listing what | `references/frame-artefacts.md` - the standing checks a screen owes (`frameDeliverables`), what a capture owes, and the reasons a screen is photographed |
| you are reading a chapter's run record, deciding what a journey test may assert, or a closed chapter gained a screen | `references/evidence.md` - the run record, the captures it shows, the one look, and what happens when a closed chapter gains a frame |
| you are about to drive the product - browser, simulator, device | `references/driving-the-product.md`, which also says where a low-level command beats the tool |
| two agents must write one file, or a measurement surprises you, or a check has never fired | `references/harness.md` |
| you are deciding what the seed and the captures tell as one story, or where a fixture's values are allowed to come from | `references/scenario.md` - the provenance rule first, then the story |
| you are writing or widening the generator that produces the chapters | `references/demands.md` - the structural line, how journeys are derived from a board, what a journey asserts and never asserts, and the three ways an irreversible verb is walked up to |
| the project has been reconciling its board frame by frame and has no chapter set yet | `references/migrating-from-a-walk.md` - what its config carries over, how the chapters are decided, and the order that leaves the project working at every step |

## Where the other skills stand

| Skill | What it owns |
| --- | --- |
| `simplecore:wireframe-boards` | authoring and syncing the board - the contract itself |
| `simplecore:board-to-app` | building the product from it, in dependency order, with the persona runs |
| the project's own screen-audit skill | driving one feature area in the browser and judging it in one sitting. A stack usually has one; where it does not, this skill's own lenses are the floor |
