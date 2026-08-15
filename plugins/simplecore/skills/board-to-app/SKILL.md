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

**No chapter set, generate one before starting** (below). Building from the board
directly, chapter by chapter in somebody's head, is the thing this skill exists to
replace: the order stops being written down, and the second session cannot tell what
the first one closed.

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

Where an example path appears anywhere in this skill or its references it is written
as `<boardRoot>/manifest.mjs` — a shape, never a default. Keys the skill does not
know are ignored, so a project may keep a `"//"` note of its own in the file.

In the Required column: **●** the build cannot start without it · **○** optional, and
the last column says what its absence costs · **◐** required once another key is set.

| Key | What the project names with it | Required | Absent means |
| --- | --- | --- | --- |
| `boardRoot` | the directory the board's frame sources live in — read the source, never the built HTML | ● | the build cannot start |
| `boardManifest` | the board's table of contents: every frame with its permanent id (`<boardRoot>/manifest.mjs`) | ● | the build cannot start |
| `boardRoles` | the role map — which persona reaches which frame | ○ | personas come from each frame's own access notes; a chapter whose personas cannot be derived that way stops and reports |
| `chapterDir` | the directory holding one file per chapter, whose file order is the build order | ● | the build cannot start |
| `chapterOverview` | the chapter table — order, what must close first, what may run alongside | ● | the build cannot start |
| `chapterGenerator` | the command that regenerates the chapter set from the board | ○ | a chapter cannot be regenerated after a board fix; report that rather than hand-editing the chapter file |
| `chapterHeadings` | the exact headings the chapter files use, per role (below) | ○ | a section is named by its role rather than by a heading, and an agent that cannot find one stops and reports |
| `stateLedger` | the one file saying which chapter is open, in progress, awaiting its tests or closed — and which development account each persona signs in with | ● | the build cannot start |
| `handoverFile` | the facts a builder needs to start: how to stand the system up, known traps, what data is already standing | ● | the build cannot start |
| `openItemsFile` | where a parked decision is written | ○ | parked lines go in the state ledger |
| `openItemsHeading` | the heading those lines live under, written exactly as that project writes it | ◐ with `openItemsFile` | the config is incomplete — report it rather than choosing a heading |
| `gates` | the commands a chapter must pass before it closes, each read by its exit status | ○ | nothing mechanical holds a chapter closed; say so once per session and close on the persona runs alone |
| `auditScript` | the script a mechanically visible defect becomes a detection rule in | ○ | the project cannot ratchet — report the rule that should have been written rather than inventing a home for it |
| `migrationDir` | where numbered migrations live, so number ranges can be handed out per agent | ○ | ranges cannot be handed out, so backend chapters run one at a time |
| `frameDeliverables` | what each screen owes beyond working code, one checkable sentence each | ○ | a screen owes nothing beyond working code |
| `factSources` | the tools a drawn value must be verified through before it is built — a statute server, a price list, a published table | ○ | a value the board draws is built as drawn and left marked, never asserted |
| `storyDocument` | the one document the sample data derives from and a final capture run follows | ○ | sample data has no single source, and the screens disagree with each other silently → `references/scenario.md` |
| `locales` | every language the interface ships in — each screen is judged in all of them | ○ | the languages come from the project's own copy catalogue; where that cannot be read, report it rather than judging in one language |
| `pseudoLocale` | the generated long-string locale that proves a layout survives any string | ○ | overflow is judged in the longest real language only, which covers less → `references/judging-frames.md` |
| `captureRoute` | the address that renders one frame, in one state, from named sample data | ○ | captures are driven by navigation, which cannot reach the states that matter; report it as owed rather than hand-driving the board |
| `logDir` | one agreed, ignored directory for the builders' run logs | ○ | there is nothing to watch — say so once, and each agent reports its steps in its return |
| `capturesDir` | one agreed, ignored directory for judging captures | ○ | captures go to the session's scratch space and are forwarded by path; nothing is kept |
| `costLog` | a machine-readable file the wall-clock span and consumption are appended to, per chapter | ○ | what a chapter cost cannot be recovered afterwards; only what git holds survives |
| `narrativePhrases` | extra point-of-view phrasings the handover file must refuse, for a project writing in neither Korean nor English | ○ | the built-in list stands alone |

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
2. **A chapter closes on its tests, not on its code.** Working screens with no
   persona run is an open chapter.
3. **Parallel chapters join before they are tested.** Two chapters that reference
   none of each other's frames may be built at once by separate agents — but the
   persona tests wait until both are standing, because the test walks between
   screens that live on both sides.
4. **The board is the contract.** A screen that disagrees with its frame is wrong
   even when it looks better. Where the board is wrong, fix the board in the same
   change (`simplecore:wireframe-boards`) and regenerate the chapter.
5. **Chapters are generated, never hand-edited.** The expectations quote what the
   board draws; editing them by hand makes the file agree with the code instead of
   with the contract. Fix the board, regenerate, rebuild.
6. **The persona is the tester, not a label.** Each screen names the personas that
   reach it and what each one must and must not be able to do. A run that only
   exercises the full-access role has tested a quarter of the screen.
7. **A correction becomes an instruction.** A builder that built the wrong thing, an
   agent that returned nothing, a handover the next session could not use — none of
   those is the agent's failure, and correcting that one agent leaves the next to
   make the same mistake in the same place. Fix what the agent was told: this skill,
   the handover file, or the brief every agent of that kind receives — and **say which
   file changed**, because the instructions live outside the repository being built.

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

**This holds for every other kind of work in the session, not only for screens.** A
build almost never happens alone — there is a document to write, a migration to run,
a catalogue to fix — and the coordinating context dries out on a pipeline stage
exactly as fast as on a screen. That is the exception everyone makes, because the
other work feels different: no chapter covers it, and it looks small from here. Then
a session that was supervising six builders is halfway through a service layer, and
every judgment it still owes is made on a context with no room left.

What the coordinator may touch directly is the coordination itself: the config, the
ledger, the handover file, and the decision about what a wave is. **It does read the
log, and it relays** — a few lines rather than a transcript.

1. **One chapter, one subagent — `simplecore:chapter-builder`.** Dispatch that agent
   rather than composing a prompt each time; a builder briefed from scratch builds
   differently from the last one. Hand it four things and nothing more:
   - the chapter file's path
   - the path to `.claude/board-to-app.json` (it reads the rest itself)
   - the state ledger's path, so it can read which chapters closed before it
   - its resource slot when another agent is running — checkout, database, port
2. **Every brief says what this agent owns, in two columns — mine and not mine, each
   named.** A brief that states only what an agent owns reads, to the agent, as
   permission for anything adjacent, and two agents on one surface is the
   coordinator's mistake rather than theirs. Read each new brief against every
   running one for what it is asked to **produce**, not only what it may touch: two
   briefs with disjoint paths can still both build the same checker.
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
7. **The agent returns conclusions.** What it built, what it fixed in the board and
   why, which persona lines failed and what it did about them, what it parked, and
   whether the chapter closed. No screen dumps, no commentary, no images — its work
   is in the tree and in the state ledger, and the report says where to look.

### Judge the overlap before every parallel dispatch — then parallelise

The chapter's `parallelWith` section says the two need nothing from each other's
screens. That clears the *order*; what clears *simultaneity* is a resource judgment,
and it is made per dispatch rather than once for the project.

Walk this list for the two chapters and answer each with a fact, not a forecast:

| Shared thing | Parallel only if |
| --- | --- |
| working tree · git index | separate checkouts, or one agent writes and the other only reads |
| database · seed data | separate databases; a shared one fails silently when one agent's test rewrites the row the other asserts on |
| dev server · port | **each agent runs its own instance on its own port** |
| background workers · queues | separate, or owned by one agent |
| file storage · uploads | separate directory per agent |
| the state ledger, the board, shared catalogues | one writer at a time — the second agent reports what it would have written |

**Restarting a backend is the collision that bites hardest.** It looks local and is
not: an agent that restarts the server another agent is mid-test on produces a
failure in the other's run that belongs to nobody, and both agents then hunt it in
their own code. So the rule is flat — **an agent restarts only the instance it
started, on the port it was given.** An agent that finds no port assigned does not
guess and does not borrow: it treats its chapter as sequential work and says so.

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
what it must not do is touch an instance it did not start. The one restart lives at
②, where exactly one actor runs it. By ③ the contract is fixed, so the screens no
longer move under each other.

**The coordinator has three jobs and no others**: dispatch ①, run ② itself, dispatch
③. Everything else is the agents'.

**What still collides inside ①, and what to do about it:**

| Collision | The arrangement |
| --- | --- |
| migration numbering — two agents add the next number | each agent is given its number range in the brief, read off `migrationDir` |
| generated API clients — each regeneration overwrites the last | nobody regenerates in ①; the coordinator regenerates once at ② |
| registries, barrels, locale catalogues | one owner per file, named in the brief; the others report the line they would have added |
| the git index — commits sweeping each other | separate checkouts, or agents stage nothing and the coordinator commits at ② |
| entity order — one chapter's table references another's | the wave is ordered by entity, not only by chapter: an agent whose table references one being created in the same wave waits for that agent's migration and says so |
| the state ledger — several agents close at once | **in a wave the coordinator writes every row at ②**; the agents report and do not touch it |

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

## Development, then the persona run

Each screen in a chapter carries two kinds of line: what to build, and what each
persona must find. Build the whole chapter first — a persona test that walks
between two screens cannot run while one of them is missing.

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
   on the second sighting — that is the floor, not the bar. If a regex or a walk over
   the syntax tree can find it, it becomes a detection rule in `auditScript` now, in
   this change, so the next chapter catches it without anybody looking.

   Ask the question every time: **can a machine see this?** Most defects that reach a
   person are mechanically visible once somebody has described them precisely — a
   value computed in two places, a string that should exist once, a control with no
   destination. Describing it well enough to detect is most of understanding it.

   **A new rule is wired into `gates` and sweeps the whole tree the moment it
   exists.** A script that has to be remembered is a script nobody runs; a rule that
   reports without anybody fixing what it found has moved the defect into a log. Add
   it, run it across everything, **fix what it finds**, and report the count — zero
   proves coverage, non-zero is the rule earning itself immediately.
3. **A rule nobody tried to break is a rule that says the tree is green.** When a
   check goes in, plant the defect it exists for and watch it fail, then take the
   defect out and watch it go quiet. Both halves; neither announces itself →
   `references/harness.md`.
4. **Only what needs a person goes to a person**, and it goes to the open items, not
   into a pause.

Do not write audit findings into documents. A finding was fixed, became a rule, or is
a line in the open items.

## Parking is a last resort, and most things do not qualify

**The default is to decide.** An open question is answered by designing the answer —
architecture first, then consistency with what the product already does, then
stability, then performance — and the decision is applied to the code and the board in
the same change. Those four are an order, not a list: a fast screen built on the wrong
shape is a rewrite, and a screen that disagrees with its neighbours is a defect no
benchmark can see. A build whose open items keep growing is not being careful; it is
deferring the design work, and every deferred decision makes the next chapter harder
because it rests on nothing.

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

**The threshold is two.** When the artifact has not changed since the previous check
*and* the agent has announced idle twice, treat it as stalled. Then, in one turn:

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
2. **Who do I sign in as?** The ledger names one development account per persona. Signing into a
   local development server with those accounts is expected — do not ask for credentials, and do
   not test one role by filtering another role's screen.
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

**Stop and ask only for these**: a decision that changes what the product is, a value no source can
settle, and anything the repository's own rules reserve for the user — committing and pushing among
them, unless the user has said otherwise for this build.

## Closing a chapter

A chapter closes when every screen in it works, every persona line has been run,
and the failures are fixed rather than listed. Before saying so:

1. **Cross-sweep by defect type.** Each defect found is a *type*; search the whole
   codebase for other instances and fix those too. Report the sweep per type,
   including "0 others". A type that already became a detection rule is swept by
   `auditScript` — run it and report that; the manual search is for the types seen
   only once.
2. **Audit the chapter's code, and act on it.** Not optional, and not the same thing as
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
3. **Run every command in `gates`**, all of them, green, each read by its exit status
   rather than by the tail of its log → `references/harness.md`.
4. **Sync the board in the same change** where the code was right and the board was
   stale — but only the layer a board contracts, which is structure rather than the
   values in its illustration → `references/judging-frames.md`.
5. **Fold what the chapter learned back into the graph, then regenerate.** A dependency
   the prerequisite list did not name, an entity that turned out to belong elsewhere, a
   table the chapter had to create — each goes into the owning chapter's `entities` or
   `creates` section, and `chapterGenerator` runs before the chapter is called closed.
   **A graph that is not regenerated at the close is a graph that stops learning**, and
   the next wave is assembled from what was true two chapters ago.
6. **Write the chapter's row in the state ledger**, and say what closed and what the next
   chapter is. **Do not edit the chapter file to mark it done** — its state is the
   system's state, and a file that says "done" while the system disagrees is worse than
   no file.

A chapter closes with its parked lines still open if nobody could settle them. Say which they
are; do not close them by choosing for the user.

## What the coordinator reports

To the user, in the conversation, never into a file — the ledger and the open items hold what is
left, and git holds what happened. Aggregate the builders' returns into this shape, so two
consecutive sessions are comparable:

```text
CHAPTER: <id and name> — closed / still open
BUILT: <one line per screen: frame id, what now exists>
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

## Generating and regenerating the chapters

The chapter set is derived from three things — the placement (which frame belongs to
which chapter), the board (what each frame draws and which roles reach it), and the
persona map. **Generate it once, regenerate it whenever the board changes**, with the
command `chapterGenerator` names.

What a generated chapter carries: the previous chapter and the state it leaves, the
chapters that must close first and those that may run alongside, the frames it owns as
board ids, and per screen a build line plus one test line per persona quoting the
frame's own tabs, counts, messages and primary action.

Two shapes must survive regeneration because the board's own gates read them: the
per-chapter placement lines that name each frame once, and the tallies that count them.
**Keep the generator with the project** — it reads that project's board layout, so it
does not belong in this skill.

## The five references beside this file

Each of these is long, and only one of them is needed at a time — which is why they sit
beside this document rather than inside it. Read the one the moment calls for rather than
rediscovering it:

| When | Read |
| --- | --- |
| a screen disagrees with its frame and you are deciding which is wrong | `references/judging-frames.md` — the three lenses, the locale and layout rules, the anchor every finding needs |
| a screen owes something besides working code and you are listing what | `references/frame-artefacts.md` — the three reasons to photograph a screen, capture axes, fingerprints, what a stale artefact costs |
| you are about to drive the product — browser, simulator, device | `references/driving-the-product.md`, which also says where a low-level command beats the tool |
| two agents must write one file, or a measurement surprises you, or a check has never fired | `references/harness.md` |
| you are deciding what the seed and the captures tell as one story | `references/scenario.md` |

## Where the other skills stand

| Skill | What it owns |
| --- | --- |
| `simplecore:wireframe-boards` | authoring and syncing the board — the contract itself |
| `simplecore:board-to-app` | building the product from it, in dependency order, with the persona runs |
| the project's own screen-audit skill | driving one feature area in the browser and judging it in one sitting — `simplix:frontend-e2e` in a simplix-react repository |
