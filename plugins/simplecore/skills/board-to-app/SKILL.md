---
name: board-to-app
description: >-
  Use when building an application from a wireframe board in dependency order —
  chapter by chapter, foundation first — and when running the persona tests that
  close each chapter. Also for resuming a build across sessions, deciding which
  chapters may run in parallel, and generating or regenerating the chapter set
  from the board — 시나리오 개발 · 챕터 개발 · 단계별 개발 · 개발 순서 · 페르소나 시험 ·
  병렬 개발 · 어느 챕터부터 · 다음 챕터. Requires a wireframe board. Supersedes
  simplecore:board-parity-walk on a project that has a scenario set: the walk
  reconciles frames cluster by cluster with no notion of what must exist first,
  and this builds them in the order the dependencies allow. NOT for authoring or
  syncing the board itself (simplecore:wireframe-boards).
---

# Building from the board, chapter by chapter

A board says what every screen holds. It does not say what has to exist before a
screen can work, and a walk that takes the board section by section will build a
list screen whose records nothing can create. **This skill builds in dependency
order**: the foundation first, then each chapter on top of the one before it,
each closing with the persona tests that prove it works.

**The chapter is the unit.** One chapter is one file, the file order is the build
order, and a chapter does not start before the chapter before it has closed.

## Precondition: a board, and a scenario set derived from it

**No board, no build.** With nothing to build against, every judgment collapses
into somebody's opinion of the screen in front of them. Offer
`/simplecore:board-init` and let the board come first — do not draw frames while
building, which produces a board shaped by the code rather than a contract the
code is measured against.

**No scenario set, generate one before starting** (below). Building from the
board directly, chapter by chapter in somebody's head, is the thing this skill
exists to replace: the order stops being written down, and the second session
cannot tell what the first one closed.

## What the project supplies

| What | Where it usually sits |
| --- | --- |
| The board | `_plans/wireframes/` — frames, `manifest.mjs`, `roles.mjs` |
| The chapters | `_plans/scenarios/` — `00-overview.md` + one file per chapter |
| The personas | the board's role map, and the screen-design document behind it |

The overview names, per chapter: what must close first, what may run alongside,
and how many base screens the chapter carries. **A chapter file carries its own
placement** — the frames it owns, as the board's permanent ids.

## The rules the build runs on

1. **Dependency order, not board order.** A chapter starts only when every chapter
   in its 「먼저 끝나야 하는」 list has closed. The board's section letters are a
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

## Opening a session

1. Read the overview's chapter table. **The open chapter is the first one whose
   tests have not all passed** — not the first with missing code.
2. Read that chapter file whole before touching anything. It states the state the
   previous chapter left behind; if the running system is not in that state, the
   previous chapter did not close and that is the work.
3. Say which chapter is being built and which are running alongside it.

## The unit of work is a chapter, and one agent takes one chapter

**Never build in the coordinating context.** Not the first chapter, not one screen
of it to settle the format. Setting the project up — the chapter set, the state
ledger, the seed, the scripts — is the coordinator's work and belongs here.
Building one screen end to end is **not** setup; it costs the same context every
other screen costs, and a coordinator that spends it dries out before the chapter
is done and leaves half-built code behind.

**This document is the coordinator's.** What the agent holding one chapter does
inside it is the agent's definition, which is equally binding and read there
rather than here.

1. **One chapter, one subagent — `simplecore:chapter-builder`.** Dispatch that agent
   rather than composing a prompt each time; a builder briefed from scratch builds
   differently from the last one. Hand it four things and nothing more:
   - the chapter file's path
   - the path to the project's build config
   - the state ledger's path, so it can read which chapters closed before it
   - nothing about how to build a screen — the chapter and the board say that
2. **Finish, then replace.** When the chapter closes the agent ends and the next
   chapter gets a **new** one. Never stack a second chapter on a running agent, and
   stop a finished one once its report is in — a coordinator watching six finished
   agents cannot see which one is working.
3. **Judge the overlap before every parallel dispatch — then parallelise.**
   「함께 돌릴 수 있는 챕터」 says the two need nothing from each other's screens.
   That clears the *order*; what clears *simultaneity* is a resource judgment, and
   it is made per dispatch rather than once for the project.

   Walk this list for the two chapters and answer each with a fact, not a forecast:

   | Shared thing | Parallel only if |
   | --- | --- |
   | working tree · git index | separate checkouts, or one agent writes and the other only reads |
   | database · seed data | separate databases; a shared one fails silently when one agent's test rewrites the row the other asserts on |
   | dev server · port | **each agent runs its own instance on its own port** |
   | background workers · queues | separate, or owned by one agent |
   | file storage · uploads | separate directory per agent |
   | the state ledger, the board, shared catalogues | one writer at a time — the second agent reports what it would have written |

   **Restarting a backend is the collision that bites hardest.** It looks local and
   is not: an agent that restarts the server another agent is mid-test on produces a
   failure in the other's run that belongs to nobody, and both agents then hunt it in
   their own code. So the rule is flat — **an agent restarts only the instance it
   started, on the port it was given.** An agent that finds no port assigned does not
   guess and does not borrow: it treats its chapter as sequential work and says so.

   **Any row that cannot be answered with a fact makes the two chapters sequential.**
   Two disjoint file lists are not an answer — what an agent touches is settled while
   it works, and the files that collide are the ones no brief could name: a registry,
   a locale catalogue, a config, a barrel, the ledger.

   **Where two chapters really did run apart, they join before either is tested** —
   the persona run walks between screens that live on both sides, so a chapter tested
   alone has tested half of itself.

4. **The agent returns conclusions.** What it built, what it fixed in the board and
   why, which persona lines failed and what it did about them, what it parked, and
   whether the chapter closed. No screen dumps, no commentary, no images — its work
   is in the tree and in the state ledger, and the report says where to look.

## The wave: parallel backends, one restart, then the screens

Judging six rows per dispatch is right and it is also a lot of coordination. **One
arrangement makes most of that judgment unnecessary**, because it separates the work
that collides from the work that does not.

```
웨이브 n
  ① 백엔드 병렬      여러 에이전트, 각자 자기 데이터베이스, 서버는 아무도 띄우지 않는다
  ② 장벽             전부 보고 → 조율자가 한 번 재기동하고 통합 검사를 돌린다
  ③ 프론트           화면은 도는 서버가 필요하다 — 슬롯이 있으면 병렬, 없으면 차례로
```

**Why it holds.** Backend work is code, migrations and its own tests; nothing in it
needs a **shared** running server, so the restart collision cannot happen in ①. An
agent may run its own process on its own port to test against its own database —
what it must not do is touch an instance it did not start. The one
restart lives at ②, where exactly one actor runs it. By ③ the contract is fixed, so
the screens no longer move under each other.

**The coordinator has three jobs and no others**: dispatch ①, run ② itself, dispatch
③. Everything else is the agents'.

**What still collides inside ①, and what to do about it:**

| Collision | The arrangement |
| --- | --- |
| migration numbering — two agents add the next number | each agent is given its number range in the brief |
| generated API clients — each regeneration overwrites the last | nobody regenerates in ①; the coordinator regenerates once at ② |
| registries, barrels, locale catalogues | one owner per file, named in the brief; the others report the line they would have added |
| the git index — commits sweeping each other | separate checkouts, or agents stage nothing and the coordinator commits at ② |
| entity order — one chapter's table references another's | the wave is ordered by entity, not only by chapter: an agent whose table references one being created in the same wave waits for that agent's migration and says so |
| the state ledger — several agents close at once | **in a wave the coordinator writes every row at ②**; the agents report and do not touch it |

**A wave is one chapter's backend, or several chapters' backends together** — the
chapters in a wave are the ones whose 「먼저 끝나야 하는 챕터」 are all already closed.
That set is readable from the state ledger, which is what makes the wave decidable
rather than a judgment call.

**The prerequisite list is derived and therefore incomplete.** It is computed from the
frames' cross-references, which capture what the screens say about each other — not
every entity one chapter's tables need from another's. **An agent that finds a
dependency the list does not name stops, reports it, and does not invent the table.**
The coordinator adds it to that chapter's 「이 단계가 만드는 것」 and regenerates, so the
next wave is assembled from a graph that has learned.

**When a wave cannot be assembled cleanly, run the chapter whole and alone.** The
arrangement is worth it for a wave of three or more; for two it costs more
coordination than it saves.

## What the chapter already knows about the future

Two of a chapter's header rows are computed from the board and are worth opening before
a line of code is written:

- **뒤에서 이 챕터를 쓰는 곳** — later chapters whose frames point at this chapter's
  screens, with the frame ids. Those screens already say what they expect of yours.
  **Open them now.** A column they will need costs nothing today and costs a migration
  and a re-run of a closed chapter's persona lines later.
- **이 챕터가 약속하는 뒤 화면** — screens this chapter's frames point at that do not
  exist yet. Leave the destination unbuilt, but leave the promise visible rather than
  quietly dropping the link.

This is the cheap half of looking ahead, and it is available before the build starts.
The expensive half — an entity dependency nobody wrote down — surfaces while building,
and the rule for it is the same: stop, report, let the graph learn.

## Touching a chapter that already closed

Work sometimes has to change something an earlier chapter built — an entity gains a
column, a screen gains a state, a rule turns out to be wrong. **Do not reopen that
chapter and do not edit its file.** A closed chapter is a record of what was true
when it closed; editing it destroys the history this build exists to leave behind.

Instead, in the chapter you are in now:

1. **Write it under 「지난 챕터를 건드린 것」** — that section is hand-authored and the
   generator preserves it. Name what changed, in which chapter it was built, and why.
2. **Find who else uses it, in both directions.** Backwards: which closed chapters
   read this entity or screen — their persona tests must still pass, so re-run the
   ones that touch it. Forwards: **which chapters not yet built already depend on it**
   — the scenario files say so, and a change made without reading them is a change the
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

## Where the detail goes, and how the coordinator watches without paying for it

An agent returns conclusions, which leaves a question the walk answered years ago: where
does everything else go, and how does a person see progress without reading it?

**Into files whose paths are the report.** The agent writes its run log and its captures
to the directories the project's config names, and hands back paths. The coordinator —
and the user — can open one, and neither pays for it by default.

**Arm the watch in the same turn the agent is dispatched**, not afterwards. A coordinator
is busy between events; 「I will check the log」 is the failure, every time.

## What a chapter owes besides working code

Working screens are the floor. A chapter also owes, for every screen in it:

- **The states the board draws** — the dialogs, panel forms and empty states are
  part of the screen, not a later polish pass.
- **The role boundary, enforced on the server.** A hidden button is not a
  boundary; the persona test for a scoped role must fail if the record can be
  reached by its address.
- **The Korean the board wrote.** Screen copy comes from the frame, not from the
  developer's paraphrase.

Where the project declares more (sample data, captures, a story document), that
declaration is part of the chapter's close.

## Running without stopping to ask

The build is meant to continue on its own while the dependencies hold and the tests pass. Four
things otherwise turn into a question, and none of them has to.

1. **Where am I?** The project keeps one state ledger — a table of chapters and whether each is
   open, in progress, waiting on its tests, or closed. Read it first, write to it when a chapter's
   state changes, and never infer progress from the code.
2. **Who do I sign in as?** The ledger names one development account per persona. Signing into a
   local development server with those accounts is expected — do not ask for credentials, and do
   not test one role by filtering another role's screen.
3. **What data should exist?** The numbers the board draws are the fixture specification: a screen
   that draws 「유효한 평가 119건」 says the seed makes 119. One story, one site, every chapter on top
   of the last.
4. **An unresolved question in a frame.** A frame carrying `OPEN:` or 「확인 필요」 is built as drawn
   and does not hold the chapter — the open question travels with the frame, not with the build.
   Where it is a legal value, verify it through the project's statute tool — article text, the
   version in force on a date, and **the annex forms, whose boxes are the record's fields** — then
   correct the board. Only a question that tool cannot answer waits for a person, and it is left
   marked rather than asserted.

**Write the handoff as you go, not at the end.** A session cannot reliably tell how much room it
has left — there is no gauge, only the growing weight of what it has already read. So the state
that lets the next session start without asking anything — which chapter closed, what is running,
what the single next action is — is written the moment it changes. A handoff composed once the
context is nearly spent is the one that does not get written.

**Stop and ask only for these**: a decision that changes what the product is, a value no source can
settle, and anything the repository's own rules reserve for the user — committing and pushing among
them, unless the user has said otherwise for this build.

## Closing a chapter

A chapter closes when every screen in it works, every persona line has been run,
and the failures are fixed rather than listed. Then:

- Say what closed and what the next chapter is.
- Where a board defect was found, say which frame changed and that the chapter
  was regenerated.
- **Do not edit the chapter file to mark it done.** Its state is the system's
  state; a file that says 「done」 and a system that disagrees is worse than no
  file.

## Generating and regenerating the chapters

The chapter set is derived from three things — the stage placement (which frame
belongs to which stage), the board (what each frame draws and which roles reach
it), and the persona map. **Generate it once, regenerate it whenever the board
changes.**

What a generated chapter carries: the previous chapter and the state it leaves,
the chapters that must close first and those that may run alongside, the frames
it owns as board ids, and per screen a build line plus one test line per persona
quoting the frame's own tabs, counts, messages and primary action.

Two shapes must survive regeneration because the board's own gates read them: the
per-stage placement lines that name each frame once, and the tallies that count
them. Keep the generator with the project — it reads that project's board layout,
so it does not belong in this skill.

## What the parity walk still holds, and when to read it

`simplecore:board-parity-walk` carries judgments this skill does not repeat because they
did not change when the unit became a chapter. Read the one you need rather than
rediscovering it:

| When | Read |
| --- | --- |
| a screen disagrees with its frame and you are deciding which is wrong | its `references/judging-frames.md` — the lenses, the locale rules, the anchor every finding needs |
| a screen owes something besides working code and you are listing what | its `references/frame-artefacts.md` |
| you are about to drive the product — browser, simulator, device | its `references/driving-the-product.md`, which also says where a low-level command beats the tool |
| two agents must write one file and you cannot avoid it | its `references/harness.md` |
| you are deciding what the seed and the captures tell as one story | its `references/scenario.md` |

## Where the other skills stand

| Skill | What it owns |
| --- | --- |
| `simplecore:wireframe-boards` | authoring and syncing the board — the contract itself |
| `simplecore:board-to-app` | building the product from it, in dependency order, with the persona runs |
| `simplecore:board-parity-walk` | reconciling frames with an app on a project that has **no** scenario set |

**On a project with scenarios, use this skill instead of the walk.** The walk's
unit is a cluster and its order is the board's, which is why it cannot say what
must exist first. Its judgments about a single frame — what counts as divergence,
what a frame owes, how to drive the product — still hold and are worth reading
where a chapter turns up a frame that disagrees with its code.
