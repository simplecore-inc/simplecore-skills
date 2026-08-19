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

**This skill carries the discipline, not the contents.** Every path, command,
directory and heading it needs is a project's own choice, and the project declares
all of them in `.claude/board-to-app.json` at its root. Copy
`assets/board-to-app.json` and fill it in.

**Read that file first, on every invocation** — including a session that only means
to resume. It costs one read, and a build started on half-wiring is one nobody can
pick up later.

**A required key that is absent is an error the skill reports — never a path it
guesses.** Name the key, say what it names and what it buys, and offer to fill it
in; do not proceed with a substitute. A declared path that does not exist is the
same error: report the key and the path it points at, and stop. Most of the time the
user asked for screens to be built, not to configure a skill, so name what is
missing in plain terms.

**An optional key the project does not have is left out of the file**, and an empty
array declares none — the table's last column says what each absence costs, and the
build carries on knowing it. A placeholder left in the file is not an absence: it is
a path that does not exist, and it stops the build like any other.

**An optional key absent because its subject does not exist yet is a promise, not a
decision.** A project whose application has not been built has no migration directory to
name, no address that renders one frame, no generated locale. Such a key **is declared in
the chapter that creates its subject**, and that chapter does not close with the promise
unkept. Until then it is written down as owed — `deferredKeys` names the chapter and the
path whose appearance makes the key due.

**Writing it down is the whole point, because the moment it falls due announces
nothing.** An undeclared key reads identically whether the project decided against it or
is waiting for it, and the day the subject appears the cost in that key's row starts being
paid in silence: with `migrationDir` still absent, nothing in the wave says where a migration
goes or how two agents writing one avoid each other, so backends that were meant to run in
parallel run one at a time and nothing says why. A promise turns that into a fact on disk that
`bta.mjs check` reads.

Where an example path appears anywhere in this skill or its references it is written
as `<boardRoot>/manifest.mjs` — a shape, never a default. Keys the skill does not
know are ignored, so a project may keep a `"//"` note of its own in the file.

In the Required column: **●** the build cannot start without it · **○** optional, and
the last column says what its absence costs · **◐** required once another key is set ·
**◑** everything runs and no chapter can close. That fourth grade is its own because the
first three cannot express it: a project missing one of these reads a page of green while
being unable to finish anything, which is what `bta.mjs doctor` prints it apart for.

| Key | What the project names with it | Required | Absent means |
| --- | --- | --- | --- |
| `boardRoot` | the directory the board's frame sources live in — read the source, never the built HTML | ● | the build cannot start |
| `boardManifest` | the board's table of contents: every frame with its permanent id (`<boardRoot>/manifest.mjs`) | ● | the build cannot start |
| `boardRoles` | the role map — which persona reaches which frame | ○ | personas come from each frame's own access notes; a chapter whose personas cannot be derived that way stops and reports |
| `chapterDir` | the directory holding one file per chapter, whose file order is the build order | ● | the build cannot start |
| `chapterOverview` | the chapter table — order, what must close first, what may run alongside | ● | the build cannot start |
| `chapterGenerator` | the command that regenerates the chapter set from the board | ○ | a chapter cannot be regenerated after a board fix; report that rather than hand-editing the chapter file |
| `chapterHeadings` | the exact headings the chapter files use, per role (below) | ○ | a section is named by its role rather than by a heading, and an agent that cannot find one stops and reports |
| `chapterLines` | the lines a chapter writes that a check has to recognise, per role — **as written, markup and all**, with `{text}` captured and `{n}` not. A role this project writes no line for is declared `null` with the reason in `//<role>` beside it | ◑ | every check that reads a chapter's own demands matches nothing, and reports the same zero as a chapter with nothing wrong |
| `evidenceLabels` | the three labels one section of a result document carries — `did`, `demanded`, `saw` — **the word alone, with no markup**, because the checks write the emphasis themselves | ◑ | every check over a result document reads past every section, so a chapter cannot be shown to have closed on anything |
| `closedStatus` | the word the state ledger writes in a chapter's row when that chapter is closed | ◑ | nothing is closed, and every check over a closed chapter stays silent |
| `verdictRole` | the word an evidence heading uses where a persona name would stand, for a line a machine proves | ◑ | a foundation chapter's sections cannot be matched to the lines they prove |
| `deferredLine` | the line an evidence section carries when a check ran and **this installation** could not decide it — same grammar as `chapterLines`, and its `{text}` is the chapter that repays the debt | ○ | a project that has met that case writes the marker in prose instead, and the chapter it names closes with the debt outstanding and nothing reading it |
| `evidenceDir` | where a chapter's verification result is written, one document per chapter, with the captures it cites in a folder of the same name beside it → `references/evidence.md` | ◑ | screens get built and no chapter can be shown to have closed on anything — the grounds die with the session |
| `stateLedger` | the one file saying which chapter is open, in progress, awaiting its tests or closed — and which development account each persona signs in with | ● | the build cannot start |
| `handoverFile` | the facts a builder needs to start: how to stand the system up, known traps, what data is already standing | ● | the build cannot start |
| `openItemsFile` | where a parked decision is written | ○ | parked lines go in the state ledger |
| `openItemsHeading` | the heading those lines live under — the heading's **text only**, with no `#` markers on it | ◐ with `openItemsFile` | the config is incomplete — report it rather than choosing a heading |
| `gates` | the commands a chapter must pass before it closes, each read by its exit status — `bta.mjs check` among them | ◑ | nothing mechanical holds a chapter closed; say so once per session and close on the persona runs alone |
| `commitPolicy` | whether the build may commit and push without asking — `ask`, `commit`, or `commitAndPush` | ○ | `ask`: the build stops before every commit, so it cannot run unattended and the two gates that read commits see nothing until somebody is present → *Whether the build may commit at all* |
| `auditScript` | where a mechanically visible defect becomes a detection rule — one script, or the directory a family of them lives in | ○ | a new rule has nowhere to land, so the project cannot ratchet — report the rule that should have been written rather than inventing a home for it |
| `migrationDir` | where migrations live, and with it how two agents adding one at the same time avoid colliding — one directory, or several where the database has more than one lineage | ○ | nothing says where a migration goes or how two of them collide, so backend chapters run one at a time |
| `frameDeliverables` | what each screen owes beyond working code, one checkable sentence each | ○ | a screen owes nothing beyond working code |
| `factSources` | the tools a drawn value must be verified through before it is built — a statute server, a price list, a published table | ○ | a value the board draws is built as drawn and left marked, never asserted |
| `storyDocument` | the one document the sample data derives from and a final capture run follows | ○ | sample data has no single source, and the screens disagree with each other silently → `references/scenario.md` |
| `locales` | every language the interface ships in — each screen is judged in all of them | ○ | the languages come from the project's own copy catalogue; where that cannot be read, report it rather than judging in one language |
| `pseudoLocale` | the generated long-string locale that proves a layout survives any string | ○ | overflow is judged in the longest real language only, which covers less → `references/judging-frames.md` |
| `captureRoute` | the address that renders one frame, in one state, from named sample data | ○ | captures are driven by navigation, which cannot reach the states that matter; report it as owed rather than hand-driving the board |
| `browserDrivers` | what drives a browser here, **in order** — the run takes the first that can express the task | ○ | whoever opens a screen picks whatever the environment offers, so two runs of one frame can be shot through different instruments; the run must then name its driver in the return and write it into the handover file, because nothing else records the choice → `references/driving-the-product.md` |
| `deviceDrivers` | what drives a simulator or a real device here, in the same order | ○ | as above, for a product that ships on a device — and where the project ships on one and declares none, a sweep reaches for the platform's own commands with nothing saying that was a choice |
| `captureTakerModel` | the model a `capture-taker` runs on — driving addresses and reading values out is procedure, so it is usually the cheaper one | ○ | both halves run on whatever the harness defaults to. **The split is unaffected** — it is about who judges, not about cost — and what is lost is the saving it also buys |
| `captureJudgeModel` | the model a `capture-judge` runs on — deciding whether a value is a defect is not procedure | ◐ with `captureTakerModel` | half a split named is not a split named; the config is incomplete and is reported rather than half-applied |
| `eyesDocuments` | the documents that hand a check to human eyes | ○ | the project's own eyes rules go unread — **declare these two together or neither**, because documents with no vocabulary read every one of them and match nothing |
| `eyesPhrases` | the words those documents hand it in — `assigns`, `reader`, `moment` | ◐ with `eyesDocuments` | as above: 「nothing to find」 and 「no idea what to look for」 come out as the same zero |
| `logDir` | one agreed, ignored directory for the builders' run logs | ○ | there is nothing to watch — say so once, and each agent reports its steps in its return |
| `capturesDir` | one agreed, ignored directory for judging captures | ○ | captures go to the session's scratch space and are forwarded by path; nothing is kept |
| `costLog` | a machine-readable file the wall-clock span and consumption are appended to, per chapter | ○ | what a chapter cost cannot be recovered afterwards; only what git holds survives |
| `narrativePhrases` | extra point-of-view phrasings the handover file must refuse, for a project writing in neither Korean nor English | ○ | the built-in list stands alone |
| `projectGates` | a module exporting this project's own gates and their cases | ○ | only the generic gates run; anything true of this project alone is held by nobody |
| `disabledGates` | `{ id, reason }` per generic gate this project turns off | ○ | every generic gate runs — which is the default, and a gate is never turned off silently |
| `deferredKeys` | per optional key whose subject does not exist yet, `{ chapter, whenExists }` — the chapter that creates it, and the path whose appearance makes it due | ○ | an absence waiting on a chapter reads exactly like one the project decided against, and the cost in that key's row is paid silently from the day the subject appears |

`chapterHeadings` maps a role to the heading that project's chapter files actually
write, so nothing in this skill has to know one project's wording:

| Role | The section it names |
| --- | --- |
| `prerequisites` | the chapters that must close before this one starts |
| `parallelWith` | the chapters that may be built alongside it |
| `creates` | what this chapter brings into existence |
| `entities` | the tables and records it owns |
| `usedLater` | later chapters whose frames point at this chapter's screens |
| `promises` | screens this chapter's frames point at that do not exist yet |
| `touchedEarlier` | the hand-authored section where a change to a closed chapter is written |

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

## The unit of work is a chapter, and one agent takes one chapter

**Never build in the coordinating context.** Not the first chapter, not one screen
of it to settle the format. Setting the project up — the chapter set, the state
ledger, the seed, the scripts — is the coordinator's work and belongs here.
Building one screen end to end is **not** setup; it costs the same context every
other screen costs, and a coordinator that spends it dries out before the chapter
is done and leaves half-built code behind.

**This holds for every kind of work in the session, not only for screens.** A build
almost never happens alone — a design document to rewrite, a migration to run, a
script to author, a catalogue to fix, an edit to this skill — and the coordinating
context dries out on a document or a script exactly as fast as on a screen. Each of
those is delegated too. That is the exception everyone makes, because the other work
feels different: no chapter covers it, it is prose rather than code, and it looks
small from here. Then a session that was supervising six builders is halfway through
a service layer, and every judgment it still owes is made on a context with no room
left.

What the coordinator may touch directly is the coordination itself: the config, the
ledger, the handover file, the wave decision, and the barrier work the wave gives it.
**It does read the log, and it relays** — a few lines rather than a transcript.

1. **One chapter, one subagent — `simplecore:chapter-builder`.** Dispatch that agent
   rather than composing a prompt each time; a builder briefed from scratch builds
   differently from the last one. Hand it five things and nothing more:
   - the chapter file's path
   - the path to `.claude/board-to-app.json` (it reads the rest itself)
   - the state ledger's path, so it can read which chapters closed before it
   - its resource slot when another agent is running — checkout, database, port
   - **the design document that decides what this chapter builds, by chapter and section**

   **Naming the folder is not naming the chapter.** 「the design is in the design folder」 hands an
   agent nothing it can act on — nobody holding one chapter opens twenty design chapters hunting
   for the one that governs it — so the brief names the chapter and the sections that settle what
   this work builds. **A hand-written chapter file cites them too**: the generator excludes it, so
   nothing regenerates it from a source that knows about the design, and each of its numbered
   sections names the design chapter it implements.

   **This bites hardest where the design says replicate rather than build.** A foundation chapter
   whose design chapter copies the monorepo, the auth skeleton, the file storage and the audit log
   from a repository where they already exist reads, in its own file, exactly like one that builds
   them: 「what this stage creates」 is what every chapter says, and only the design chapter
   separates the two readings. The agent that never opens it rebuilds a working foundation, and
   nothing in its own file contradicts it.

   **A value the replication source owns is copied, never decided.** Ports, framework and library
   versions, module names — the design chapter states them so a reader has them in one place, and
   the source repository is what settles them. So the design chapter declares **where each value
   comes from** — the repository, the catalogue file, the key — rather than only the value. A bare
   copy goes stale the day the source moves and nothing announces it, both documents keep reading
   as authoritative, and the builder has to guess which one the code should follow.
   **Hand the TEXT of what the agent must act on; hand a PATH only for what it must search.**
   The distinction is worth real money. A chapter file runs to tens of thousands of characters and
   a result document to well over a hundred thousand, so an agent dispatched for one section that
   is given the document's path reads the whole thing to find one part of it — and pays that again
   on the next dispatch. The coordinator already has the section in hand; passing it costs one
   copy and saves the search. Paths stay right for what the agent genuinely has to range over: the
   config, the ledger, the board it must look screens up in.

   **This is what makes a per-screen agent affordable at all.** An agent that must load the
   instruction files, the board manifest, the chapter and the result document has spent most of a
   context before it opens a browser, and the work it was dispatched for is a few thousand
   characters of that. Brief it with those few thousand.

   **An agent ends when its unit ends, and the useful ones are the hard part.** The rule reads as
   housekeeping and is not: a coordinator keeps an agent alive because it has the context and the
   next thing looks small, and then the next, and an agent briefed for one chapter has walked
   eleven sections, built four checks, fixed a layout and written up four findings in one context.
   **Every one of those decisions was locally right**, which is why the rule has to be mechanical
   rather than judged — end it, and brief a fresh one.

   **A subagent ends; a peer session does not.** A subagent finishes when its task returns and is
   gone. A session running beside you is not yours to close — telling it to stop stops the work and
   leaves the session sitting there announcing itself, and only the person who opened it can shut
   it. So with a peer the rule becomes **stop dispatching into it**, say so once, and then treat its
   availability pings as nothing: answering them is how a finished agent goes on costing turns.
   Where the choice is yours, prefer a subagent for a unit of work precisely because it can end.

   **Name it for the unit, and end it before the name stops being true.** A name is how every
   message it ever sent is read afterwards, so an agent still called after its first task while
   doing its fifth misleads the whole log — and the drift in the name is the same drift as the
   context. When you notice the name has gone wrong, that is the signal the agent should have ended
   some time ago.

2. **Every brief says what this agent owns, in two columns — mine and not mine, each
   named.** A brief that states only what an agent owns reads, to the agent, as
   permission for anything adjacent, and two agents on one surface is the
   coordinator's mistake rather than theirs. Read each new brief against every
   running one for what it is asked to **produce**, not only what it may touch: two
   briefs with disjoint paths can still both build the same checker.

   **An agent that changes a published shape is scoped by surface, never by a list of
   paths.** A published shape — an API schema, a shared type, a copy key, an enum a
   catalogue has a word for, a frame — has readers, and **which files read it is not
   knowable when the brief is written.** They surface while the work happens, because what
   is changing is a shape rather than a file. So the brief names the shape and gives a
   surface — `apps/console/**`, the copy catalogues, the board — and never the files
   somebody happens to know about. Where the surface cannot be handed to one agent, the
   change is one agent's whole rather than two agents' halves: split across two briefs it
   lands in two commits with a tree between them nobody can make green.

   **A split rename is the one collision no gate catches.** Both sides compile: the reader
   declares its own copy of the shape, so the type check is green on a field that no longer
   arrives, and the screen draws `undefined` where the value was.

   > **Read it this way and it is wrong**: 「their paths are disjoint, so they cannot
   > collide」. Give an agent `apps/server/**` and one field renamed there reaches four
   > readers under `apps/console/` and a frame on the board — none of which any path list
   > mentioned.
   >
   > **This is the reading somebody makes after that correction, and it fails the same
   > way**: 「then I widen the scope to the places that read it」. A widened scope becomes a
   > file list, because the places anybody can name are the ones that already collided —
   > and the next reader is a copy catalogue under a different feature directory that
   > nothing had pointed at yet. A brief naming four files stops on the fifth exactly as
   > the directory-scoped brief stopped on the first four. **A longer list is the same
   > mistake at a larger radius**; only a surface covers what has not surfaced yet.

   **A brief must not demand a verification its own columns forbid.** The 「not mine」
   column is what forecloses — it takes the server, the device, the profile or the
   account — and the demand for a check that needs one of those sits in the same brief
   contradicting it. An agent handed that pair does not stop and ask: it substitutes the
   nearest thing it can reach and reports in good faith, **and every substitute is a real
   check that passes.** So read each brief against itself before sending it. For every
   check it demands, name the thing that makes the check possible — the address, the
   account, the driver, the port — and hand that over in the same brief, or withdraw the
   demand and say what stands in its place.

   **What every substitute is blind to is the same thing.** Probing each endpoint, checking each
   drawn figure against the running server, typecheck, lint and the audits to zero are all real
   checks, and not one of them sees whether the application composes in a real client. A route
   answers 200 on every request, logs no console error, and paints the shell with nothing inside
   it — several routes returning one identical byte length are that shell, measured. Nothing
   except opening it sees this, which is why withdrawing the browser withdraws the only check that
   would.

   > **Read it this way and it is wrong**: 「the port is somebody else's, so the browser is
   > too」. The restart rule forbids stopping and starting an instance another agent is
   > using; a browser starts nothing, and driving a running server is a read exactly as an
   > endpoint probe is. Collapsed into one rule it withdraws the only check that sees
   > whether the application composes in a real client, and the agent then verifies every
   > layer except the one that is broken — which it reports as done, because each layer it
   > could reach was genuinely sound. A permission hook answering correctly and a side nav
   > filtering correctly are what a guarded shell with nothing inside it looks like from
   > below: the layer that works is the reason nobody suspects the layer that does not.
3. **The brief carries the staging rule itself, never a pointer to it.** Say in every
   brief: stage the paths you touched by name, never `git add -A` or its cousins, and
   read `references/harness.md` § Stage your own paths **before it is needed**. An
   agent that meets a shared file without having read that section reaches for the
   obvious move, and every obvious move there costs somebody their work.
4. **Finish, then replace.** When the chapter closes the agent ends and the next
   chapter gets a **new** one. Never stack a second chapter on a running agent, and
   stop a finished one once its report is in — a coordinator watching six finished
   agents cannot see which one is working.
5. **A chapter that runs out of context is not handed to a second agent to
   continue.** The successor would inherit conclusions without the screens behind
   them. Restart it, split at a seam where the two halves do not need to see each
   other.
6. **An agent whose output is a judgment writes to a file as it goes.** An agent that
   builds leaves its work in the tree, so a report that never arrives costs a look at
   the diff. An agent that produces a *judgment* — an audit, a comparison, a decision
   between two designs — leaves nothing if it ends before reporting, and agents end
   for reasons that have nothing to do with the work. Dispatch those with a file to
   write, a section at a time, with a line at the top saying how far they got. **So a
   read-only agent still needs `Write`**: read-only means it does not touch the
   subject, not that it produces nothing. Check the tool list before dispatching, and
   give it a scratch file outside the tree it is reading.
7. **The agent reports at every step it closes, not only at the end.** A step is
   anything that stands on its own — a screen finished, a gate passing, a commit cut,
   a decision settled, a blocker hit — and each one is one short message in a fixed
   shape:

   > **finished** what it was, named concretely · **path** the file it is in ·
   > **next** what is starting now

   **A report with no path is a signal, and signals are worthless.** "working on it",
   "continuing" and a percentage are all indistinguishable from an agent that has
   stopped; a path is something the reader can open. An agent that reports without one
   has reported nothing, and the coordinator treats it exactly as it treats silence.

   **The coordinator still judges by the artifact, never by the report.** The report
   says where to look — it is not itself evidence, and a claim it makes is confirmed by
   opening the file or running the thing. What the step reports buy is that nobody has
   to poll the file system to know anything, which is what let a stalled agent go
   unnoticed for half an hour.

   **They also make the stall test decidable**: an agent that stops sending steps *and*
   whose artifact has not moved is stalled; one that is quiet while its artifact grows
   is inside something long and is left alone → *An agent that ends, and an agent that
   only paused*.
8. **At the end the agent returns conclusions.** What it built, what it fixed in the
   board and why, which persona lines failed and what it did about them, what it
   parked, and whether the chapter closed. No screen dumps, no commentary, no images —
   its work is in the tree and in the state ledger, and the report says where to look.

   **A screen nobody watched render is reported as such, and its completion is
   provisional.** 「built, typechecked, and never opened」 is a different claim from
   「done」, and a return that does not separate them hands the coordinator a chapter's
   worth of false confidence. So the conclusions name the frames that were seen rendering
   and the frames that were not, **by id**. A count is not an answer — the frames nobody
   opened are exactly the ones nobody can name afterwards — and the provisional half is
   what tells the coordinator which screens it still has to open itself.

### The dispatch is planned, written down, and then made

Parallel work is not decided one agent at a time. **Before dispatching anybody, write
the plan for the whole wave**: who its members are, what each one owns, and what
nobody may touch. Three lines per agent is enough, and it goes in the ledger or the
handover file rather than only in the coordinator's head — a plan nobody can read is
one the next session cannot resume and the replacement of a stalled agent cannot
inherit.

| The plan names | Because |
| --- | --- |
| the wave's members | the set is derivable from the prerequisites; writing it down is what makes it reviewable |
| what each agent owns — paths, tables, which migrations, shared files, and every published shape it may change, each written as a surface rather than as the files somebody can already name | ownership is a fact only the coordinator can see; two briefs with disjoint paths can still both build the same checker or split one rename between them, and a scope written as a file list omits the reader nobody has met yet |
| what nobody touches this wave | an agent told only what it owns reads the silence as permission for anything adjacent — and the registry, the catalogue, the ledger and the generated client are exactly what no brief thinks to name |
| the resource slot per agent — checkout, database, port | an agent with no slot works alone, and says so |

**The 「what nobody touches」 row does not stop at the repository's edge.** Every agent in the wave
executes the same installed skills, the same global settings and the same shared scripts, and a
brief framed as 「inside this repository, yours is this」 has no column for any of them. Such a
checkout is worse than a registry in two ways: the hooks it installs sit on **every** agent's write
path, so what breaks there does not slow one agent down but stops all of them — and the agent it
stops has nothing else it can do until it is fixed. **So the plan names it and says who owns it**,
and 「nobody touches it」 is not one of the answers available.

Where an agent is blocked by it and fixing it is the precondition for its own work, it fixes it and
**says in its report that it did, and why**. In a checkout outside the tree anybody is reading, a
change nobody claims and a change nobody made look the same.

> **Read it this way and it is wrong**: 「the two agents are in different repositories, so they
> cannot collide」. Two of them edited the plugin checkout `~/.claude/skills/` points at — one
> because it was sent to, one because a hook from that checkout refused its writes until it did —
> and no brief on either side named the checkout. One of the two changes then stood with nobody
> able to say who had written it.

**The git index is a shared resource like any other.** Two agents committing in one
checkout sweep each other's staged work into commits neither of them meant to make,
and nothing announces it. Either every agent gets its own checkout, or **the agents
stage nothing and the coordinator commits at the barrier** — those are the two
arrangements; there is no third that survives.

**Naming the hazard is not enough — two commands cause it.** Both are out for as long
as the build runs, since whether another agent is mid-commit is not observable:

| Rule | Because |
| --- | --- |
| **`git reset` and `git commit --amend` are forbidden** | a commit landing between your commands means `HEAD~1` is not the commit you wrote — a reset throws away whatever landed on top, and an amend folds the other agent's work into yours under your message |
| **stage by explicit path — `git commit --only <paths>`, never `git add -A`** | `-A` sweeps whatever the other agent has left in the tree into your commit, and says nothing |
| **read `git rev-parse HEAD` before and after each commit** | expect it to have moved — that is the normal state during a wave, and it is the state in which a rewrite destroys work |

**A destroyed commit is in the reflog.** Read it back with `git reflog`, re-commit it
on its own, and confirm both the diff and the message are byte-identical to the
original before calling it restored. The hash does not come back; everything else
does, and only while the reflog still reaches it.

**Every parallel agent is tracked by its artifact.** The plan says which file each
agent writes and what its progress line looks like, and progress is read from that
file. An agent's own announcement is not progress → *An agent that ends, and an agent
that only paused*, below.

### Judge the overlap before every parallel dispatch — then parallelise

The chapter's `parallelWith` section says the two need nothing from each other's
screens. That clears the *order*; what clears *simultaneity* is a resource judgment,
and it is made per dispatch rather than once for the project.

Walk this list for the two chapters and answer each with a fact, not a forecast:

| Shared thing | Parallel only if |
| --- | --- |
| working tree · git index | separate checkouts, or one agent writes and the other only reads |
| database · seed data | separate databases; a shared one fails silently when one agent's test rewrites the row the other asserts on |
| dev server · port | **each agent runs its own instance on its own port** — or one agent runs it and the rest only drive it, never restarting it |
| the browser profile · the signed-in session | one profile per agent; two agents in one session overwrite each other's account |
| background workers · queues | separate, or owned by one agent |
| file storage · uploads | separate directory per agent |
| the state ledger, the board, shared catalogues | one writer at a time — the second agent reports what it would have written |

**Restarting a backend is the collision that bites hardest.** It looks local and is
not: an agent that restarts the server another agent is mid-test on produces a
failure in the other's run that belongs to nobody, and both agents then hunt it in
their own code. So the rule is flat — **an agent restarts only the instance on the slot it
holds.** An agent that finds no port assigned does not guess and does not borrow: it treats
its chapter as sequential work and says so.

**The slot decides that, not who typed the command.** A server outlives the agent that started
it, so a chapter regularly inherits a process nobody present began — and 「restart only what you
started」 read literally leaves an instance the slot-holder may not touch and whose author is no
longer alive to touch it. Whoever holds the row stops and starts it whatever its parentage;
whoever does not holds off even for a server they started themselves and have since handed on.

**The first boot of a seed belongs in front of whoever wrote it.** A compile and a green suite
cannot see whether it runs, and a seed that throws during somebody else's first screen is read
as a defect in their own work.

**That rule is about restarting, not about looking.** Signing in, walking a screen and
taking a capture are reads over HTTP exactly as an endpoint probe is — they change
nothing the other agent depends on — so an agent with no port of its own still drives
the instance somebody else is running, and what it never does is stop, start or restart
it. **Withholding a port is not a reason to finish without opening a screen**; it is a
reason to open somebody else's. What such an agent does take for itself is the browser
profile, which is the resource a second driver actually collides with.

**Any row that cannot be answered with a fact makes the two chapters sequential.**
Two disjoint file lists are not an answer — what an agent touches is settled while it
works, and the files that collide are the ones no brief could name: a registry, a
locale catalogue, a config, a barrel, the ledger.

**Do not reach for a worktree to buy the first row.** A second checkout duplicates
the tree, leaves everything else shared, and then lies about the tree too: standing
on an older commit it shows work already in the history as though it were somebody's
uncommitted changes, so the next agent either preserves what does not need
preserving or sweeps what it cannot see the origin of. Build on the branch the
project actually builds.

**Anything only one user can hold at a time arbitrates itself, in the tool that uses
it.** A simulator, a phone, a browser profile, a development database, a port, a
capture run — each takes its own lock atomically on start, refuses loudly with who
holds it, and clears a lock whose holder is gone. **Never make the coordinator the
queue**: a permission that travels as a message can cross or drop, and the resulting
stall is invisible from both ends → `references/harness.md`.

**Where two chapters really did run apart, they join before either is tested** — the
persona run walks between screens that live on both sides, so a chapter tested alone
has tested half of itself.

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

So the project states it once, in `commitPolicy`, and the build never raises it again:

| `commitPolicy` | The build |
| --- | --- |
| `ask` — **and this is what an undeclared key means** | stops before each commit and asks. Safe, and it costs the build its ability to run unattended: a chapter cannot close without somebody present, and the two gates that read commits see nothing until they land |
| `commit` | commits as the work lands, without asking. Pushing still waits for the user |
| `commitAndPush` | commits as the work lands and pushes, without asking |

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
   is proved → *Every rule here is held by a machine or marked as needing eyes*, below.
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
4. **An unresolved question in a frame.** A frame carrying `OPEN:` or 「확인 필요」 is built as drawn
   and does not hold the chapter — the open question travels with the frame, not with the build.
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
the user. **Committing and pushing are not a fifth**: the project answers that once, in
`commitPolicy`, and the build then follows the answer without raising it again → *The dependency
tree the history leaves behind*. **Everything else has a written answer here**, and a session that
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

## Every rule here is held by a machine or marked as needing eyes

**There is no third category.** A rule that is neither checked nor marked reads as though
something is holding it, which is the state in which it decays — everybody assumes the gate
catches it, nobody looks, and it is broken for a month before a person notices.

So this skill ships the checks for its own mechanical rules, and marks the rest:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/scripts/bta.mjs" check
```

**Held by a gate** — nobody has to remember these:

| Rule | The gate |
| --- | --- |
| the config is complete, well typed, and every declared path is there | `configGate` |
| a key promised to a chapter is declared once that chapter has created its subject | `deferredKeyGate` |
| the commit policy is one of the three words the build knows how to follow | `commitPolicyGate` — a fourth word reads as a decision and is followed by nobody |
| the handover file states facts, never a point of view | `handoverGate` |
| a parked line sits under the declared heading — matched exactly, never by fragment — and carries its three parts, the first of them one unbroken token | `openItemsGate` |
| every chapter is named in the state ledger | `ledgerGate` |
| a capture is named the one way, one folder per language | `capturesGate` |
| every commit says which chapter it belongs to, and one that belongs to none says `setup` | `trailerGate` — it takes any word, so which word is fixed here rather than per project |
| a commit adding an import of a file the repository does not have | `importsTravelWithTheirCommit` — `--only` holds back a file nobody named, not somebody else's edit inside a file that was named |
| a parked line that says it blocks a chapter does not survive that chapter closing | the project's own gate — the marker is that project's word and so is its ledger's word for a closed chapter, so nothing generic can read either |
| the frames, counts and copy a chapter builds to | the board's own gates (`simplecore:wireframe-boards`) |
| whatever `frameDeliverables` declares | the project's own gate, one checkable sentence each |
| the code's own defect types | the project's `auditScript` — every new detection rule goes there, whether that key names one script or the directory a family of them lives in |

**Held by eyes** — no machine can judge these, and saying so is the point. **Each row names
whose eyes and at which moment**, for the reason the next paragraph gives:

| Rule | Whose eyes, and when | Why no gate holds it |
| --- | --- | --- |
| the agents this skill's procedure names were dispatched, rather than the coordinator building in its own context | **the coordinator**, at the session's first unit of work and again at every chapter | a session's own tool use leaves no trace in the repository — a chapter built by six agents and one built by the coordinator alone produce the same tree, the same commits and the same ledger row, so the difference is visible only to the party making the choice |
| which driver took a capture, and that one instrument took every capture being compared | **whoever takes the capture**, naming it in the return, and **the coordinator** whenever it holds two runs against each other | a picture carries no record of what shot it, and two drivers differ in device pixel ratio, fonts and scrollbar width — so an instrument change and a screen change read identically → `references/driving-the-product.md` |
| a credential reached nothing but the process that signed in | **whoever writes a report, the handover file or a result document**, before it leaves their hands | a password has no shape that separates it from an account name or an identifier, so a pattern wide enough to catch one fires on every persona row in the ledger |
| a screen matches the frame it was built from, and the capture shows that screen rather than an empty shell of it | **the coordinator**, opening each of the chapter's captures before writing the ledger row that closes it — never the agent that took them | a picture is the only witness, and the party that shot it is the party that cannot see past what it expected → `references/judging-frames.md` |
| what a verification record says was on the screen is what was on the screen, and it was written out of the run rather than before it | **the coordinator**, at the same moment, reading each sentence against the picture it cites | a sentence written from the DOM, the responses and the builder's memory of its own code is true of the data, false of the screen, and indistinguishable in the file from one written by looking |
| a screen holds up for the person whose work it carries | **the builder**, in character, during the persona run | that is what the persona run is |
| a prerequisite the derived graph did not name | **the agent that meets it**, at the moment it blocks | it surfaces while building; the agent that meets it stops and reports |
| two chapters may run at once | **the coordinator**, before each dispatch | a resource judgment, made per dispatch against facts that change |
| what a wave shares outside the repository being built | **the agent it blocks**, in the turn it blocks them | no diff in this repository shows a plugin checkout, a global setting or a shared script — and the agent one of them blocks is the only agent that can unblock it |
| whether a brief carried what its own checks need, and the design chapter that governs the work | **the coordinator**, reading the brief back against itself before sending it | a prompt leaves no artifact, so the only reading of a brief is the one the coordinator takes before sending it — a gate can hold that a chapter file cites a design chapter, never that a brief did |
| a rule that became a checker was reached in this run | **whoever added the checker**, in the same change | four ways it is not, all four reading as a passing run — a checker cannot report on the comparison it never made |
| how much a red gate command left unmeasured | **whoever ran it**, off its log, before reporting the result | the exit status is honest and says only that the run stopped; how far a chained command got is read off its log by somebody |
| which of two commands a step's proof is read off | **whoever writes the step down** | a report and a gate both exit zero on a healthy project, so only somebody who knows which one can fail can say whether a proof was taken → `references/checks.md` |
| a contract designed from the documents matches the code that will implement it | **whoever designs it**, before the contract is written | two documents agree with each other more easily than either agrees with the branches already in the code, and only reading those branches settles it |
| the story document covers the frames its steps feed, and its steps still add up | **the coordinator**, whenever a chapter is added or the story moves | this skill ships no checker for either — the first is one a project can write as a gate of its own, the second nobody can → `references/scenario.md` |
| an agent renaming a published shape is scoped by surface rather than by a file list | **the renaming agent**, after the rename and before it stands down | the readers surface while the work happens, so no list written beforehand is complete — and both sides type-check green while one of them draws `undefined` |
| how many agents may extend the migrations at once | **the coordinator**, when the wave is planned | it follows from the project's scheme — a range divides, a parent chain does not — and the scheme is read off `migrationDir` per wave |
| a sentence standing beside a chip filter is one the chip choice changes, or a page note in the wrong place | **the coordinator**, reading the frame before dispatching the chapter that builds it — never the agent that drew it | 「Does this sentence change when the chip changes?」 is answered by reading the sentence; the board's gate sees a block between the chip row and the list and cannot see which side of that question it falls on → `simplecore:wireframe-boards` |
| the documents, the board and the code agree in meaning | **whoever moves one of the three**, in the same change | a checker holds that a frame is referenced, never that two sentences say the same thing |
| an agent is stalled rather than inside something long | **the coordinator**, at each check on a quiet agent | the three readings, and they need somebody to take them |
| a parked decision genuinely qualifies | **whoever is about to honour the line**, against today's sources | the default is to decide, and only a person can say the design ran out |
| a path carried over from a retired arrangement still names it | **whoever opens the document** | only somebody who knows the project moved can tell a live document from a leftover → `references/migrating-from-a-walk.md` |
| a document about to be deleted is opened by a program | **whoever deletes it**, before deleting | this skill reads no path that is being retired; what holds it is the project's own gate, run after the deletion rather than before → `references/migrating-from-a-walk.md` |

**A rule added to this skill lands in one of those two tables in the same change.** Where it is
mechanical, the gate is written now — and proved in both directions before it counts, because a
gate that has never fired is indistinguishable from one that cannot. Where it needs eyes, the
second table says so, and nobody spends a session hunting for the check that was never there.

### A rule marked as needing eyes names whose eyes, and when

**「A person has to judge this」 with nobody named is the third category wearing the second
category's label.** It reads as covered, it survives every audit of the two tables, and the
reading it describes is taken by nobody — because a duty addressed to everyone is a duty
nobody's turn ever arrives for. So the middle column above is not decoration: a row without it
is not finished.

Two properties make the column worth the space, and both are load-bearing:

1. **A reader who is not the party being checked.** The agent that took a capture is the worst
   available judge of it — it knows what the screen was supposed to hold, so it reads the
   picture for confirmation and finds it. Where the rule checks an artifact, the eyes belong to
   somebody who did not produce that artifact; where no such party exists, that is the finding,
   and the answer is to arrange one rather than to write the row anyway.
2. **A moment that something else is waiting on.** 「Before the ledger row is written」 and
   「before the brief is sent」 are moments a run actually arrives at and cannot pass without.
   「Regularly」, 「as part of the review」 and 「when closing」 are not moments; nothing stops at
   them, and a reading with no moment is a reading that happens the first week and then never.

> **The case this now catches**: a chapter's captures declared correct by the agent that shot
> them, with the rule 「whether the capture shows the frame it is named after stays with eyes」
> sitting in the project's own documents, naming no reader and no moment. Two screens closed a
> chapter that way — one drawing a list total of fourteen over no rows at all, one painting two
> tables into the same rectangle — and every gate the repository had was green over both.

**A rule whose finding is a prompt rather than a defect is still held by a gate** — it declares
`grade: 'warning'`, prints under `⚠`, and leaves the exit status alone. That is for a rule that is
right to fire and wrong to fail on: a parked decision naming the article nobody could settle names a
source that may already answer it, and only a person re-reading the article can say. It is never a
way to keep a rule that fires wrongly, and the grade sits on the gate rather than on the finding —
both → `references/checks.md`.

**Generic checks live here; project-specific checks live in the project.** A heuristic true only
of one repository's layout — its document format, its stack's conventions, its own data shapes —
never enters this skill; it goes in the module the project declares as `projectGates`, and its
cases go beside it. Where a gate belongs, how to write one, and how a project wires and proves
its own → `references/checks.md`.

### The third category comes back as a checker that did not run

**A rule is held when the check reached it in this run, not when the check exists.** That is the
axis the two tables actually turn on, and 「is there a checker?」 is a proxy for it that agrees most
of the time and fails in one direction only. Four ways a checker exists and does not reach the
thing — and **all four come out of a run looking like a pass**:

| The shape | What it is |
| --- | --- |
| **no command runs it** | the checker is in the repository and in no entry of `gates`. Somebody greps, finds it, and reads the rule as covered |
| **an earlier failure in the same command hid it** | one `gates` entry is a chain, and the checkers after the one that failed did not run at all → *Closing a chapter* |
| **its own precondition did not hold** | it compares three things and skips, silently, whatever is missing one of them |
| **its pattern matches anything** | it runs, compares, and every comparison passes because the pattern it compiled accepts any string |

**The first three are indistinguishable from green; the fourth produces green.** And the first does
the most damage for a reason that has nothing to do with machines: a checker that exists is read as
a rule that is held, so nobody has a reason to look. A rule with no checker at all is the honest
version of the same coverage.

Two things narrow it, and the second is here because the first is not enough:

1. **A checker says how many comparisons it made, not only how many failed.** 「0 findings」 and
   「paired 186 of 193」 are one line to an exit status and two different sentences to a reader —
   only the second shows the seven it never reached.
2. **A pattern with a placeholder in it is tested for what it matches.** The count stays honest
   while the comparison behind it stops meaning anything: a vocabulary pattern whose slots compiled
   to 「any non-empty string」 and 「any two words」 read 556 buttons, reported 556, and passed seven
   that were wrong. One pattern that matches everything voids a whole checker and leaves its
   statistics untouched — which is why counting is a necessary condition and not a sufficient one.
3. **A board figure and a code figure are two different measurements until something says they are
   not.** Averaging what the board draws and averaging what the code declares produces two numbers
   that subtract cleanly and mean nothing: a board's header cells include the action column it
   draws with no name, and the code emits that column from an `actions` prop rather than as a
   column, so the board's 3.7 and the code's 1.9 are not 「half」 — they are 3.0 against 1.9 once the
   unit matches. **Write down what each side counts before putting the two in one sentence**, and
   prefer a code-to-code comparison against the replication source, where both sides are the same
   expression by construction. The gap that survives the unit check is the finding; the rest was
   arithmetic on two different things.

**The census is a gate, not a count somebody remembers to take.** How many checkers the repository
has and how many an entry of `gates` actually reaches is a number rather than a judgment — which
makes 「count it once, when the project is wired」 the third category in person form. A count taken
once is true on the day it is taken and decays from the next commit, and the shape it was meant to
catch is precisely a checker somebody adds later and wires to nothing.

**A project writes it, because only a project knows what one of its checkers looks like** — the
naming rule is local (`audit-*.mjs`, `check_*.py`, a `checks/` directory) and belongs in that
project's config or gate rather than here. **What is not local is how it judges**, and these three
are the whole of it:

1. **Start from the commands, never from the files.** The set that counts is what `gates` runs.
   Reading the repository for checker-shaped files and calling them covered inverts the question.
2. **Follow the import closure of each command.** A checker is reached when the entry point it
   sits behind reaches it — directly, or through a module that command imports. Matching on the
   command's own text finds the entry points and misses everything they pull in, which reports a
   wired checker as orphaned and teaches everybody to ignore the gate.
3. **Report the orphans by name.** 「7 of 9 reached」 gives nobody anything to do; the two names do.

> **Read it this way and it is wrong**: 「the checker exists, so the rule is held」. A manual
> checker sat in the repository and in no entry of the `check` chain; measured for the first time
> it had 232 findings, and not one of them had ever been seen.

## What is learned goes back into the instructions, in the same change

A defect fixed once and walked past grows back next session, so the finding is worth more than
the fix. **Never end with only the work corrected.**

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

**"I will be careful next time" is not a fix.** Memory ends with the session, and the same
misreading grows back. If no sentence and no gate changed, the finding was not recorded.

## Closing a chapter

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

**A builder that returns nothing has not reported.** Going quiet after committing is the common
failure, and it is expensive in a specific way: the coordinator then has to read the repository to
find out what happened, which spends the context the subagent existed to protect. Ask once. If the
answer does not come, **verify the few claims that decisions rest on — by running the thing, not by
reading the diff** — and move on rather than chasing.

**Before asking twice, check how that agent's report was supposed to reach you.** An agent launched
as a *named teammate* does not return its final message; it has to send one, and an agent that
wrote a full report as ordinary text believes it has reported while nothing has arrived. So the
second ask names the mechanism rather than repeating the request — *send it, do not write it* — and
every brief for a named agent says which of the two it is.

**A reading that contradicts a report is a clock before it is a defect** — take the reading out of a
commit, never off the working tree → `references/harness.md`.

**A brief owes the same reading, and owes it harder.** Whoever holds a file has been working since
it was last opened, so an instruction written off an hours-old copy directs work against reasoning
the file already answers — and it arrives with the authority of an instruction rather than as a
claim the reader knows to check. Open the file at the moment the brief is written, not at the
moment you last had a reason to.

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
