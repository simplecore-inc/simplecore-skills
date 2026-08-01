---
name: board-parity-walk
description: >-
  Walk a wireframe board's frames against the running application, section by
  section, over many sessions — the long-running parity audit that follows
  implementation. REQUIRES a project that already has a wireframe board; with no
  board there is nothing to walk against, and the answer is to draw one first
  (wireframe-boards) rather than to improvise a substitute. The APPLICATION, by
  contrast, need not exist yet: a frame no code reaches is built to the board and
  then judged, which makes this the loop a board-first project builds through from
  its first screen. Use when reconciling
  implemented screens with a board, when building screens from a board,
  working through a parity/remaining-screens list, resuming such a walk, or
  setting a project up for one; triggers on 보드 대조 · 화면 대조 · 프레임 대조 ·
  SCREEN-PARITY · 걸을 화면 · 화면을 걷는다 · 남은 화면 대조 · 섹션을 걷는다. It
  carries the discipline the walk needs to survive its own length: SUBAGENT
  ISOLATION so no context is exhausted mid-cluster, the FACTS-vs-NARRATIVE split
  that lets sequential agents hand off without writing a shared diary, PARKING a
  stuck decision instead of stopping, a list that holds ONLY WHAT IS LEFT, and
  how a person watches the walk remotely without the images landing in the
  coordinating context. A project is wired for it once — this skill proposes
  that wiring when it is missing. NOT for authoring or syncing a board (that is
  wireframe-boards), and NOT for auditing one feature area in one sitting (that
  is the project's own e2e skill).
---

# Walking a board against the running app

A board says what each screen holds, in which state, and how the user moves
between them. Code drifts from it — and, before it drifts, it does not exist. This
is the walk that closes both gaps: one section at a time, across many sessions,
until the parity list is empty.

## Precondition: there is a board, or there is no walk

**This skill applies only to a project that already has a wireframe board.** The
walk compares the running application against frames somebody drew; with no
board there is nothing to compare against, and every judgment collapses into
somebody's opinion of the screen in front of them.

So when a project has no board, stop here and say so. Do not substitute a spec,
a screenshot, a list of routes, or a description of what the screens ought to be,
and do not "start the walk and draw frames as we go" — that is authoring a board,
which is `simplecore:wireframe-boards`, and it produces a board shaped by the code
rather than a contract the code is measured against. Offer
`/simplecore:board-init` and let the board come first.

A parity-walk config sitting in a project with no board is the same situation
wearing a hat: report it as wiring that cannot hold rather than walking anyway.

**The application is the opposite case: it does not have to exist yet.** A board
drawn before the code is a board with no drift to find and every screen still to
build, and that is a walk — the frames are the same frames, the list empties the
same way, and the discipline that keeps a 150-frame walk from decaying is exactly
what a 150-frame build needs. Never refuse a walk because the routes are not there
yet, and never wait for somebody to "implement first and reconcile later": that
produces screens shaped by whatever was easiest, which is the drift this whole
document exists to prevent. See "A frame no code reaches yet" below.

It is a different job from the three it sits between:

| Job | Who owns it |
| --- | --- |
| Drawing the board, syncing it after a change | `simplecore:wireframe-boards` |
| Driving one feature area in the browser and judging it | the project's e2e skill — `simplix:frontend-e2e` in a simplix-react repository |
| **Walking every frame of a board to empty, over sessions** | **this skill** |

## The six rules the walk runs on

Everything below is one of these six made concrete. A walk that drops one of
them does not fail loudly; it decays — into a dried-out context, a document
nobody trusts, or a list that no longer says what is left.

| Rule | What it holds | Where it is enforced |
| --- | --- | --- |
| **One cluster, walked to its end** | A cluster is finished or it is not started. No half-walked section. | Cluster is the unit of work; a section closes only when empty |
| **Facts shared, narrative private** | The next walker can tell a confirmed fact from somebody's impression. | Handover file vs one log per agent; **hook** |
| **One walker, isolated** | The coordinating context never fills, and two walkers never fight over the same files. | `simplecore:board-walker` subagent per cluster, one at a time; **hook** |
| **Never stop mid-walk** | A question nobody can answer does not cost the rest of the section. | Park it and move to the next frame |
| **Parked first, next session** | A parked decision is read before anything else, so it stops blocking. | Session opening order; **hook** keeps the section alive |
| **Only what is left** | The list answers "what remains" and nothing else. | A walked frame is deleted, never marked; **hook** |

The four marked **hook** are checked mechanically — three at write time on the
two documents, and one at the moment the session tries to end: frames removed
from the list with no subagent having run blocks the stop once. See the wiring
below.

## What the project must supply

This skill carries the discipline, not the contents. Before walking, find the
project's own four:

1. **The parity list** — which frames still need walking, grouped into sections,
   plus the parked decisions. Frames are named by the board's **permanent id**
   (`A-01`), never by the bracketed position the board shows beside it — the id
   survives every reorder, the position does not, and a list that records positions
   is wrong the next time the board is built. Walking is the only thing that takes
   a frame off it. It still grows from the other side — a route that did not exist when the
   list was written, a frame back-filled while syncing the board — so emptying it
   is the walk's job and filling it is not.
2. **The handover file** — the facts a walker needs to start (see below).
3. **The board** — read its source, never its built HTML.
4. **The verification gates** — the commands a section must pass before it
   closes, among them the audit script that a twice-seen defect type is written
   into. A project without such a script cannot ratchet; say so rather than
   inventing a home for the rule.

Their paths are the project's to name, and one file names them.

### Check the wiring every time this skill loads

**Run this check before anything else, on every invocation** — including a
session that only means to resume. It costs five lookups, one command, and a walk
started on half-wiring is one nobody can pick up later:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json
```

`skills` includes `simplecore:board-parity-walk` only when a board **and** the
config are both present; `missing` names each piece that is absent, in the terms
to say them in.

| Look for | Missing means |
| --- | --- |
| **a wireframe board** | there is nothing to walk against — see the precondition above, and stop |
| `.claude/board-parity-walk.json` at the project root | the write-time checks are off; the rules hold only while somebody remembers them |
| the parity list it names | there is nothing to resume from |
| the handover file it names | the next session re-derives what this one learned |
| a pointer to this skill in `CLAUDE.md` / `AGENTS.md` | a session that starts elsewhere in the repository never loads any of this |

**When anything is missing, say so and offer to fix it in one step, before
walking.** Do not assume the user knows this wiring exists — most of the time
they asked to walk some screens, not to configure a skill. Name what is missing
in plain terms, say what each piece buys them, and offer:

> `/simplecore:parity-walk-init` writes the missing pieces. Shall I run it?

Run it on agreement. The command reports what already exists, writes only what is
missing, and shows each file before creating it. When the user would rather not,
walk anyway if the parity list and handover file exist — but say once that the
checks are off, and do not offer again in that session.

**Nothing to resume from is different: with no parity list and no handover file
the walk cannot start at all.** Do not improvise substitutes, do not keep the
frames in your head, and do not walk "just this section" first. Set the project
up, then walk.

What the wiring is, for the case where it is written by hand:

```json
{
  "parityList": "_plans/SCREEN-PARITY.md",
  "handoverFile": "_plans/WALK-NOTES.md",
  "parkedSection": "Parked decisions",
  "logDir": ".walk-logs",
  "narrativePhrases": [],
  "frameDeliverables": []
}
```

Paths are relative to the project root. `parkedSection` is the heading the parked
decisions live under, written exactly as that project's document writes it — the
check refuses to let the section vanish. `logDir` is where walkers write their own
logs, and belongs in the project's ignore file rather than in the repository —
the walk needs *one* agreed location so somebody can tail it without asking.
`narrativePhrases` extends the point-of-view phrasing the handover check refuses,
for a project whose documents are written in neither Korean nor English.
`frameDeliverables` lists what each frame owes beyond working code, one checkable
sentence each, and is empty for a project that requires nothing.

The two documents start from `assets/parity-list.md` and `assets/handover.md` in
this skill; the parity list is then filled from the board, one line per frame that
has a route, grouped into sections.

## References — read on demand

Paths are relative to this skill's own directory.

| Situation | Read |
| --- | --- |
| A project whose frames owe an artefact beyond code — captures, manual pages, snapshots — or deciding what `frameDeliverables` should hold | `references/frame-artefacts.md` |
| A measurement that surprises you, a check that has never fired, a rule about to be written, or more than one agent in one tree or on one machine | `references/harness.md` |
| Opening the product to look at it — which browser driver, which simulator or emulator, how a capture route is built, and how pictures reach the person judging them | `references/driving-the-product.md` |
| Sample data, the story the screens live in, what shape the manual takes and which parts of that only the user may decide, and the logs and costs a walk leaves behind | `references/scenario-and-manual.md` |

## Opening a session

Read, in this order:

1. **The parked decisions** in the parity list — what the last walk stopped on.
2. **The handover file** — how to start the servers, what traps are known, which
   accounts and data are already standing.
3. **The section you are about to walk** and its frames on the board.

Then, before picking a cluster, ask whether this session can settle any parked
decision. Settling one usually changes what the next frames should look like, so
it comes before walking — but it needs the app running, which is why it comes
after the handover file rather than before it. A decision settled is applied to
the code or the board, and its line is deleted.

### The application is stood up, not waited for

**A walk that has to ask before every restart cannot cover a section.** On the
local machine the dev server and its API are the walk's to operate — started,
restarted, and stopped as the work needs, with the commands taken from the
project and the port read from the server's own output rather than assumed. The
handover file carries both the start and the stop commands precisely so no walker
has to work them out twice.

Three rules keep that authority from costing anything:

1. **A stale build lies.** A missing translation, a vanished column, an unstyled
   control — each is more often a failed build than a defect. When the screen
   disagrees with the source, rebuild or restart and look again *before* writing
   anything down.
2. **Reclaim only a port you own.** A port held by a development server from an
   earlier session of this same project is stopped and replaced. A process that
   cannot be identified as this project's development server is left alone.
3. **Leave it as you found it.** Servers this session started are stopped when the
   work no longer needs them, and a walker says in its report what it left up.

Remote hosts of any kind — production, staging, shared development — are outside
this entirely. There, ask.

## The unit of work is a cluster, and one agent takes one cluster

**Never walk in the coordinating context.** Including the first frame. Setting a
project up — the config, the two documents, the scripts a walk depends on — is the
coordinator's work and belongs here. Taking one frame through end to end to settle
the format is **not** setup; it is a cluster, and it costs the same context every
other cluster costs. The pilot is where this rule is broken, because it feels like
part of the setup it is proving. Screenshots and logs fill it fast;
a walk run there dries out before a section is done and leaves half-built code
behind. That failure is the reason this skill exists.

1. **One cluster, one subagent — `simplecore:board-walker`.** That agent ships with
   this plugin and already carries the walker's half of the discipline: what to read
   and in which order, how to operate the dev server, the judgment lenses, the
   facts-vs-narrative split, parking instead of stopping, and the exact shape of what
   it returns. Dispatch it rather than composing a prompt each time — a walker briefed
   from scratch walks differently from the last one, which is the inconsistency this
   whole document exists to prevent. Hand it four things and nothing more:
   - the cluster: which frames, and what makes them one cluster
   - the path to `.claude/board-parity-walk.json` (it reads the documents itself)
   - the personas this area has beyond the standing three, when the board names any
   - the section it belongs to, so its log line says where the walk is

   A cluster is the set of frames that have to be seen together for a disagreement
   among them to show up. Most often that is one record's whole life — born, moved,
   closed, reversed — plus every screen that shows it; just as often it is a flow with
   no record behind it, like a setup wizard, a sign-up, or a family of public links.
   Never a fixed frame count: splitting by count hides the cross-screen disagreements
   the walk exists to catch, because no single walker sees both sides. Where the frames
   are unbuilt, the same seam rule holds over a smaller cluster — see "A frame no code
   reaches yet".
2. **Finish, then replace.** When the cluster is done the agent ends. The next
   cluster gets a **new** agent. Never stack a second cluster on a running one —
   preventing accumulated context is the whole point.

   **Stop a walker once its report is in and verified.** A finished agent that is left
   alive keeps announcing itself, and a coordinator watching six of those cannot see at
   a glance which one is actually working — which is the fact the one-walker-at-a-time
   rule exists to keep obvious. Stopping them is bookkeeping, not cleanup.
3. **One walker at a time.** A walker fixes code as it goes and drives the dev
   server, so two of them in one working tree collide over the same files and the
   same ports. Run clusters in sequence, or give each walker its own worktree *and*
   its own ports.

   **This is the rule that gets bent for speed, and the cost is not slower work —
   it is work you cannot trust.** Two walkers sharing one device produce captures
   of the wrong screen that look entirely correct; two sharing one tree fold each
   other's uncommitted changes into their commits. Neither announces itself. When
   the resource genuinely cannot be duplicated — one simulator, one phone, one
   browser profile — **the coordinator holds a queue and hands it to one walker at
   a time**, and gives a lone walker a standing reservation rather than a
   handshake per run. `references/harness.md` has both failures in full.
4. **The agent returns conclusions**, in the fixed shape its definition specifies.
   What it fixed, which defect type became a detection rule, what it parked, what it
   left running, whether verification passed. No screen dumps, no running commentary,
   no images.
5. **The coordinator only coordinates.** Picks the next cluster, deletes walked
   frames from the list, records parked decisions, surfaces capture paths without
   opening them. It does not open the board, drive the browser, or do the work.

   **It does read the log, and it relays.** That is the one exception, and it is
   cheap — a few lines, not a transcript. A person watching from outside cannot
   tell a working agent from a dead one, and asking is a poor substitute for
   looking.

   **Arm a watch on the log directory at the moment the walker is dispatched, in
   the same turn.** Not a note to check later: intending to look is exactly what
   fails, because the coordinator is busy between events and an hour passes in
   two turns. Where the environment can stream file changes, point it at
   `logDir` and filter to the step words, so each appended line arrives on its
   own and gets relayed as it happens.

   Relay the shape, never the file — which frame, which step, and anything the
   walker flagged as unexpectedly slow. A cluster that runs for an hour in
   silence is a cluster nobody can supervise, and the silence is the
   coordinator's failure rather than the walker's.

**A walker's session can end for reasons that have nothing to do with the work** — a
usage limit, a dropped connection. What survives is what it committed, so the
one-frame-one-commit rule is also what makes a walker interruptible. When one dies,
read the tree rather than guessing: commits landed, uncommitted files half-written, a
frame deleted from the list whose deliverables never appeared. Finish or discard what
is half-done **before** dispatching the next walker into the same tree; a second walker
inheriting a half-migration will treat it as the existing state and build on it.

A cluster that runs out of context before it ends is not handed to a second
agent to continue — the next agent would inherit conclusions without the screens
behind them. Restart it, split at a seam where the two halves do not need to see
each other.

## A frame no code reaches yet

Every frame is in one of two conditions when a walker arrives, and the walker
decides which by trying to reach it — not by asking, and not by reading the
parity list, which says what is left rather than what exists.

| Condition | What walking it means |
| --- | --- |
| **Built** — the route renders something | Compare against the frame, judge, fix what diverges. |
| **Unbuilt** — no route, or a route that renders nothing the frame describes | Build it to the frame, then compare and judge it exactly as if somebody else had. |

Building is not a different job wearing the walk's clothes. It ends in the same
place — a frame that matches the board and survives the three lenses — and it is
subject to every rule above it: fix under the project's own conventions, park what
you cannot settle, delete the frame from the list, one line in the log.

Three things change, and only three:

1. **The board is the specification, not the reference.** When something a screen
   needs is not on the frame — a field, a state, an error, a way back — that is not
   licence to invent it. Small and obvious, build it and **back-fill the frame in
   the same change** (`simplecore:wireframe-boards`). A real gap in the product's
   behaviour is a parked line, because deciding it is designing, and designing from
   inside a build is how a board stops being a contract.
2. **A cluster gets smaller.** Building a screen costs several times the context of
   comparing one, so the cluster that one walker can carry to its end is smaller —
   often a single screen with all its states, where a reconciliation walker would
   have taken the record's whole life. The seam rule does not change: split where
   the two halves do not need to see each other.
3. **The order inside a cluster is fixed.** Build every frame of the cluster, then
   walk the whole cluster as one. Judging each screen the moment it is written
   means judging it with nothing to be consistent *with*; the cross-screen
   findings — the same thing in two places, two solutions to one problem, a state
   with no exit — only appear once the cluster stands together.

**A section built this way is not "done pending review".** It closes on the same
gates as any other section, and a walker that built but did not judge has walked
nothing.

## What a frame owes besides working code

Some projects require an artefact per frame beyond the code — a capture under
realistic data, a page of the operator's manual, a snapshot test. Where that is so,
the config names it in `frameDeliverables`, one checkable sentence each, and **a
frame that owes one is not walked until it exists** — so it is not deleted from the
list. That is what keeps the artefact from becoming a separate pass that never
happens.

Two rules make it affordable rather than doubling the work: **the same walker
produces it, in the same cluster**, and **what generates it must be deterministic**.

Artefacts have their own failure modes, and every one of them is silent — a capture
that shows part of a screen, sample data that is wrong in every language but one, an
image that quietly stopped matching the code. → `references/frame-artefacts.md`,
which also covers the axes an artefact varies along, staleness detection, and why
some things are cheap to add later and others are not.

## One frame, one commit

A frame that is finished — built, matching the board, owing nothing further, deleted
from the list — is committed **there**, before the next frame is started. Not at the
end of the cluster, and not at the end of the session.

Two things this buys, and both matter more on a long walk than they look:

- **The revert unit becomes a screen.** A cluster committed as one blob cannot give
  back a single screen that turned out wrong.
- **A walker that runs out of context has still delivered.** Everything it finished
  is already in; only the frame in its hands is lost. Batching turns a dried-out
  walker into a session's worth of work nobody can recover.

The message says what changed and nothing else — no self-assessment, no note about
which pass produced it, no tool signature. What happened belongs to the history;
the artefact holds only its current state.

## Review scaffolding is not product copy

A board id is how a reviewer names a screen. It is not something the screen says
about itself, and it must never reach the product — printed as copy it goes to a
user who has no board, and it goes into every capture the manual keeps, where it is
the one thing on the page that means nothing to the person reading.

The same applies to everything else that exists for whoever is building: a route
printed above a title, a "which frame is this" label, a fixture name, development
chrome the framework floats over the screen. Captures show the product, and only the
product — a dev-tools bubble sitting over the bottom-right corner covers exactly
where a list's last row and a screen's primary action are.

This is worth naming because it survives review: it looks deliberate, it is useful
while the screens are being built, and nobody deletes it because nobody is sure it
was not meant to be there. It ships. Sweep for it by defect type the moment one
instance appears — on a board-first project, if one screen carries its frame id,
they all do.

## This document's vocabulary is English metaphor — do not translate it

**Walk. Stand. Feed. Live. Dry out. Owe.** Every load-bearing word in this skill is
a figure of speech, chosen because it is vivid in English. None of them survives a
literal translation, and translating them literally is the single most common way
the documents a walk produces read as machine output.

That matters more here than in most skills, because a walk generates a lot of
prose — a handover file, a parity list, per-frame logs, manual pages, commit
messages — and it generates it continuously, in whatever language the project
writes in. One bad rendering of "walk" propagates through hundreds of lines before
anybody says it out loud.

**So: in a project that does not write in English, choose the natural term in that
language for what the word *means*, not for what it says.** "Walk a frame" means to
take one screen through to done. In Korean that is 처리하다, never 걷다. A screen
does not 서다 because English screens "stand"; it 있다 or 그려진다. A step does not
먹이다 a frame; it supplies its data. Code does not 산다 in a file; it 있다 there.
The same applies to any language: find what a native speaker would say about
software, and use that.

**Fix it at the level of the project's terminology, not sentence by sentence.**
Every project that keeps a glossary with a machine check should carry these as
forbidden renderings with their replacements — the specific literal translations
that this skill's vocabulary invites — so the next document is caught at write
time instead of being read and winced at. A wrong term corrected in conversation
comes back in the next file; a wrong term in the glossary checker does not.

Two things to watch when writing those rules:

- **Aim at the metaphor, not the word.** The ordinary verb is innocent — a person
  really can 걷다, a rule really is 세우다 in settled Korean. Match the pairing that
  only the metaphor produces, and put the borderline ones at warning level so a
  human decides.
- **Record the exceptions you deliberately allow**, next to the rule. Otherwise the
  next person removes the rule instead of the exception.

## Two kinds of leaving-behind, and only one is shared

Sequential agents must not re-derive what the last one learned. But left to
append freely they produce a diary with several authors, and the next agent
cannot tell a confirmed fact from somebody's impression.

| | Shared — facts | Not shared — narrative |
| --- | --- | --- |
| Where | the project's handover file — there is exactly one | one log file per agent |
| What | how to start the servers, known traps, accounts and data standing | what was walked, what diverged |
| How | present state in plain declaratives; **overwrite** when wrong | one line appended per frame |
| Read by | every agent, at the start | its own agent, and whoever is watching |

**The handover file has no room for a point of view.** No "I found that", no
"this time", no "it used to be". A fact that changes is corrected in place, with
no history left behind. That is what lets any number of authors maintain it.

**Do not create a shared narrative file.** Several agents stacking their stories
in one place produces exactly the confusion the split above prevents.

## The list holds only what is left

A walked frame is **deleted from the parity list.** Not ticked, not struck
through, not moved to a "done" section.

The list exists to answer one question — what still has to be walked — and every
completion marker left behind makes that question more expensive to ask.
Counting what is behind is not this document's job; git holds that.

The same applies to a parked decision once it is settled, and to a section once
its last frame is gone. An empty list means the board and the code agree.

## Letting a person watch, without paying for it

**Arm both watches in the same turn the walker is dispatched.** Not afterwards, not
as an intention: the coordinator is busy between events and two turns is an hour, so
"I will check the log" is the failure, every time. Two things are worth watching and
they answer different questions:

| Watch | Answers |
| --- | --- |
| the log directory, filtered to the step words | *is it moving, and where is it* |
| the capture directory, for new image files | *what does the screen actually look like* |

Both cost the coordinator almost nothing, because both deliver a **path** — a line of
text, or a file forwarded to the reader without ever being opened here. That is the
whole trick: a walk can show its work precisely because the coordinator never looks
at it.

Where the environment cannot stream file changes, poll on a slow interval rather than
dropping the watch. A minute of lag is nothing against an hour of silence.

**A watch that stops is re-armed at once.** They die quietly — a timeout expires, a
process is killed, a session is resumed without them — and a dead watch is
indistinguishable from a working one, because both produce nothing. That is the same
trap as a checker that has stopped checking, and it fails in the same direction: it
looks like calm.

So treat silence as suspect rather than as reassurance. When events stop arriving
while a cluster is still running, assume the watch died before assuming the walker
did, check, and put it back. Re-arm after anything that could have taken it down —
a resumed session, a timeout, a killed process — without waiting to be asked.

Saving context and hiding the work are different things. Three ways the walk
stays visible while the coordinating context stays empty:

1. **The agent's own work streams to the client.** What it clicked and captured
   can be expanded in the conversation. The coordinator never receives it, so it
   costs nothing. This is the primary way to follow along, including remotely.
2. **Captures go to files; the coordinator forwards them the moment they
   appear.** Name them for the frame they justify. The coordinator sends the
   path **without opening the file** — the image renders for the reader and never
   enters the context, which is the only reason a walk can show its work at all.

   Forward them **as they are shot**, not at the end of the cluster. A person
   following a walk wants to see the screen while it is still the subject; a
   batch of images arriving after the frames are committed is a record, not a
   review. Where captures are deferred as kept artefacts, the throwaway ones a
   walker takes to judge a frame are exactly the ones to forward — so tell
   walkers to leave them where they land rather than cleaning up.

   Say which frame and which locale in one line. A pseudo-locale capture in
   particular looks broken to anybody who does not know it is the stress test.
3. **Progress goes into the walker's own log, one line per STEP.** Somebody
   watching wants to know where the walk is now, and can tail that file.

   One line per *frame* is the tempting reading and it is not enough: building a
   frame, judging it across locales and devices, capturing it and writing it up
   is half an hour of work, so a line at the end of that is a heartbeat every
   thirty minutes — which from outside is indistinguishable from an agent that
   has stalled or died. Log when a frame is picked up, when it stands, when it
   has been judged, when it has been captured, when it is done.

For the tail to be possible, the log needs an agreed place and an agreed shape.
One file per walker under the config's `logDir`, named for the cluster, and one
line appended **as each frame is finished**:

```
<HH:MM> <frame id> <STATE> <what, in one clause>
```

`STATE` is a step (`START` · `BUILT` · `JUDGED` · `SHOT`) or a verdict (`MATCH` ·
`FIXED` · `PARKED` · `BLOCKED` · `DONE`), so the file can be grepped for what
still needs a human without being read. Nothing else goes in a log line — no
reasoning, no page text, no image paths.

```
14:02 B-03 START   reconciling the record list
14:07 B-03 JUDGED  ko/en + pseudo, phone + tablet — nothing diverged
14:11 B-03 MATCH   list, filters, empty state all as drawn
14:14 B-04 START   detail
14:22 B-04 FIXED   title showed the record id; now the person's name
14:31 B-05 PARKED  board draws a bulk-reverse the API has no endpoint for
```

**Append as each step ends, never in a batch.** A log written up afterwards
answers "where is the walk now" too late to be an answer, and it is the only
question the log exists for.

When a step takes markedly longer than its neighbours, say so on the line.
Nobody is timing the walk from outside, so a step that quietly costs twenty
times what it should will go on costing it — the log is where that becomes
visible.

**Never put an image in a report.** A few of those and the session is dry.

Captures and logs are byproducts — keep them out of the repository (put `logDir`
in the ignore file). What remains is the fixed code, the deleted lines, and the
facts in the handover file.

## Parity is the floor, not the verdict

A frame can match the board exactly and still be a screen nobody can work in. The
board contracts structure, content, states, and flow — it cannot say whether the
operator has the value they need to decide, or whether the words mean anything to
the person reading them. So every frame gets judged as well as compared, in
character, by the three that stand on any board:

| Lens | Asks | Counts as a finding |
| --- | --- | --- |
| **UI/UX reviewer** | Does the eye land where the task starts? Is the same thing in the same place on every screen that shows it? Does every state have an exit? | A buried primary action; two screens solving one problem differently; a state with no way out |
| **The operator** — whose work these screens carry | Can I finish here without asking anyone? Is the value I decide on actually on screen? Could I know what to type in every field? | A decision the screen gives no data for; a lookup that needs another screen; a field whose value the user cannot know |
| **The end user** — the person the service is for | Do I understand these words? Do I know what happens next? Is anything here that should never be shown to me? | Internal vocabulary, codes, or identifiers on a subject-facing screen; an action whose consequence is unstated; an error with no way out |

The board names the rest. A flow with an approver, a kiosk walk-up, or a
first-time visitor gets that persona too — derive them the way the board's `AUTH:`
notes already name who may enter a screen.

**A frame is not judged until it has been seen in the longest language it ships
in.** Text length is not a property of a screen; it is a property of a language,
and the language a product is designed in is almost always one of its most compact.
Korean, Chinese and Japanese run short; English runs roughly half again as long;
German and Finnish longer still. So the source locale is precisely the one that
hides every overflow — a tile that wraps, a segmented control that breaks into two
ragged rows, a label clipped at the edge, a button whose text no longer fits its
box. All of it looks perfect in the language it was written in, and all of it
reaches whoever reads the product in the other one.

Three rules follow, and the last is the one that lasts:

1. **Look at the frame in every locale it ships in**, longest first. A capture in
   one language is not evidence about the others.
2. **Fix it in the component, never in the screen.** A screen that works around a
   long label has fixed one screen; the next screen with a long label breaks
   identically. The component is where "this must survive any string" belongs.
3. **Judge against a generated pseudo-locale, not against the translations you
   happen to have.** Fixing a layout until the current English fits passes one
   language and defers the problem: Russian, German and Finnish would break the same
   component again, and nobody finds out until that language ships. A pseudo-locale
   — the `en-XA` idea, each string mechanically expanded by half and rendered in
   accented forms, bracketed so truncation is visible — is generated from the source
   and therefore covers **every key, forever, at no translation cost and with no file
   anybody maintains.** It also catches an unrelated defect for free: any text that
   comes out unaccented was never a key.

   Adding a real long language instead (Russian is the usual suggestion) buys the
   same coverage for a permanent translation bill and a file that silently falls
   behind the source. Prefer the generated one, and keep it out of the mirroring
   check and out of the documented languages — it is an instrument, not a language
   the product speaks.

**Not overflowing is not the same as being aligned.** A row of repeating units — stat
tiles, cards, list rows — exists so the eye can compare one value against the next,
and that comparison dies the moment a wrapped label pushes one value onto a different
line from its neighbours. Nothing is clipped, nothing is cut off, and the row has
still stopped doing its job. In the source language every label is one line, so the
defect does not exist there at all.

The fix is to decide, per repeating unit, **which element is anchored and which
absorbs the variation** — anchor the value and let the label take whatever height it
needs, so a one-line and a three-line label leave their values on the same baseline.
Reserving a fixed height for the label instead is a guess about the longest string,
and the pseudo-locale breaks it on the first run.

The test to apply is not "does the longest string I have fit". It is **"can any
string break this"** — a component that reflows gracefully at any length is done; one
that happens to fit at twelve characters is not. When a component cannot be made
length-proof by compressing, change its shape rather than its type size: let a row of
four tiles become two rows of two, or move an icon off the label's line so the label
gets the full width. Squeezing is what runs out; rearranging does not.

**Some defects no test can fail on, and those are the reason for looking.** A styling
engine that drops a class it could not see, an asset that falls back to another face, a
value that formats in the wrong language — each produces a screen that is calmly,
plausibly wrong while types, lint, tests and every custom checker stay green. There is
nothing to assert against, because the code says what it should and the toolchain
silently did something else with it.

That is not an argument against checkers; a defect seen twice still becomes a rule, and
some of these become one the moment you understand them. It is an argument about what the
visual pass is **for**: not confirming what the tests already know, but catching the class
of failure that has no witness except the screen. Treat a walk with no captures looked at
as a walk that did not happen, however green it was.

Two habits keep this from recurring once it has bitten:

- **The test runner is not the target.** Where tests run on one engine and the product runs
  on another, every capability the code reads — an API's presence, an option's effect, a
  font's coverage — is a fact about the target that the test environment will answer
  differently and confidently. Measure it **on the target**, once, and write the answer
  where the next person will look before assuming their own runtime's behaviour.
- **A probe that could not observe has told you nothing, and nothing is not an answer.**
  Reading an absent result as a value is how a correction gets applied to the case it was
  never meant for. Where a derived rule cannot be established, the underived default is
  what ships — it was already right, or it would have been reported long ago.

**Where the project has its own screen-audit skill, that skill is the rubric** —
in a simplix-react repository, `simplix:frontend-e2e` carries four lenses and five
censuses, and its judgments are anchored to the frontend handbook's invariants
rather than to taste. Load it and judge with it; the three above are the floor for
a project that has none.

Anchor every finding to a frame number and the action it blocked. A finding with
neither is an opinion — it goes to the parked section as a proposal, never into the
code.

## When a frame diverges

1. **Fix it there.** Then walk the same path again, and the neighbouring screens
   with it.
2. **A type found twice becomes a rule.** The second time a defect type appears,
   it stops being prose and becomes a detection rule in the project's audit
   script — so the next pass catches it without anybody looking. **Prove it fires
   on the defect and is silent on the fix, scope it to the whole tree rather than
   to the files the defect happened to be in, and when a candidate rule turns out
   to fire on healthy code, write down that it was rejected and why** — otherwise
   the next walker rediscovers it and ships it. `references/harness.md` carries
   the detail, and the reasons each half of that sentence is there.

   **Ask the question every time, not only on the second sighting: can a machine
   see this?** Most defects that reach a person are mechanically visible once
   somebody has described them precisely — a value computed in two places, a
   string that should exist once, a control with no destination. Describing it
   well enough to detect is most of understanding it.

   **A new rule is wired into the command the project already runs, and it sweeps
   the whole tree the moment it exists.** A script that has to be remembered is a
   script nobody runs; a rule that reports without anybody fixing what it found
   has moved the defect into a log. Add it to the gate, run it across everything,
   **fix what it finds**, and report the count — zero proves coverage, non-zero is
   the rule earning itself immediately.
3. **Only what needs a human goes to a human**, and it goes to the parked
   section, not into a pause.

Do not write audit findings into documents. A finding was fixed, became a rule,
or is a line on the list.

### Parking is a last resort, and most things do not qualify

**The default is to decide.** An open question is answered by designing the
answer — architecture first, then consistency with what the product already does,
then stability, then performance — and the decision is applied to the code and the
board in the same change. Those four are an order, not a list: a fast screen built
on the wrong shape is a rewrite, and a screen that disagrees with its neighbours
is a defect no benchmark can see. A walk whose parked section keeps growing is not being careful; it is
deferring the design work that the walk exists to do, and every deferred decision
makes the next frame harder to build because it rests on nothing.

**These are never reasons to park:**

| "I can't decide this because…" | What to do instead |
| --- | --- |
| it would add screens or states | Add them. Draw the frames, then build them. Scope is not a reason to leave a product incoherent. |
| it is complex to implement | Complexity is the work. Design it properly and build it. |
| there are two reasonable options | Pick the one that is more consistent with the rest of the product, and say why. Two reasonable options is a decision, not a blocker. |
| the requirement is not written down | Derive it from the spec and the personas the board names. Write down what you derived. |
| an external system's behaviour is unknown | Design so the answer does not matter — declare the capability, handle both, and reject explicitly what is unsupported. A product that changes shape when a vendor's answer arrives was not designed. |

That last row is the one that hides. An unknown about somebody else's API is
almost never a reason to stop drawing a screen: it is a reason to put the unknown
behind a declared capability, so the screen is correct whichever way the answer
falls. Parking it instead freezes a whole section behind a fact nobody is chasing.

**Two things genuinely qualify**, and both share a property — no amount of design
makes the answer derivable:

- **A commercial or legal decision that is somebody's to make.** A price, a
  contractual term, a retention period a regulator sets. Design everything around
  it so the value is the only thing missing.
- **A decision about who the product's documents are for.** Audience, which
  languages get written material, whether a page is a screen or a step, when the
  shipped figures are taken. These are not design questions with a best answer —
  they commit somebody to writing, and getting one wrong is not corrected by
  editing pages. Ask them together and early rather than one at a time as each
  becomes blocking; `references/scenario-and-manual.md` has the list.
- **A blocker in the world.** An environment that cannot reach a service, hardware
  nobody has yet. Build and judge everything that does not depend on it, and park
  only the part that does.

Even then, park the narrowest thing. "The whole M section is blocked" is almost
always "one decision inside M is blocked, and nobody separated it from the rest".

When something does qualify: **do not stop, and do not guess.** Add one line to
the parked section of the parity list and move to the next frame. The line says which frame, what the
choice or the blocker is, and which side looks stale — so whoever reads it next
does not have to re-derive the context:

```markdown
- C-07 — board draws a bulk reverse; the API reverses one record at a time.
  Board looks stale, but the operator does 40 a day. Product decision.
- D-02 — needs a role that does not exist in any environment yet. Blocked, not stale.
```

Which frame · what the choice or blocker is · which side looks stale. A line
missing the third part sends the next session back to re-derive it, which is the
cost parking exists to avoid.

Parked lines are read at the start of every session (see the opening order
above), which is what keeps parking from becoming forgetting.

## Closing a section

A section is done when every one of its frames is gone from the list. Before
saying so:

1. **Cross-sweep by defect type.** Each defect found is a *type*; search the
   whole codebase for other instances and fix those too. Report the sweep per
   type, including "0 others". A type that already became a detection rule is
   swept by the script — run it and report that; the manual search is for the
   types seen only once, which no rule covers yet.
2. **Audit the section's code, and act on it.** Not optional, and not the same
   thing as the cross-sweep above: that hunts instances of defects somebody
   already found, this looks for what nobody found because no single walker could
   see it.

   A section is built by several walkers in sequence, each replaced by the next,
   none seeing the others' code. They solve the same problem in different files
   without knowing the other exists — and every one of those duplicates compiles,
   passes, and reviews cleanly on its own. It is only visible from above, once,
   at the moment the section is finished and before the next section copies from
   whichever variant it happens to open.

   Do it with a **read-only agent while nothing else is running**, so the audit
   cannot fight a walker for the tree. Ask it for: the same logic in two places,
   a file whose parts stopped belonging together, one idea under two names, a
   rule the section obeys by habit that no checker holds, and dead ends. Rank by
   cost, not by ease.

   Then **act on the findings in the same session**, and every finding leaves as
   one of exactly two things:

   | The finding is | It becomes |
   | --- | --- |
   | Something wrong in the code — a duplicate, a seam, a name | **A refactor.** Done now. |
   | Something the code happens to get right, with nothing holding it | **A checker.** Written now. |

   There is no third column. "Worth doing later" is where findings go to die: the
   report is filed, the duplicate is copied by the next section before anybody
   returns to it, and the audit spent its context for nothing. If a finding is
   genuinely not worth either — say so and why, and it is closed rather than
   deferred.

   The second row is the one that pays for the whole exercise, and it is the
   easiest to miss because nothing is broken. Eight screens doing the right thing
   because their authors happened to is not a rule; it is eight coincidences, and
   the ninth screen is written by somebody who never saw the other eight. Ask of
   every convention the section follows: **what stops the next screen breaking
   this?** If the answer is "somebody would notice in review", write the checker.

   A checker that cannot be written cheaply is still worth stating — but state it
   where it will be read before the next screen is built, not in the audit report.

3. **Run the project's verification gates.** All of them, green.
4. **Sync the board in the same change** where the code was right and the board
   was stale — but only the layer a board contracts (screens, content, states,
   flow, fixed wording). Restyling and i18n catalogue text never touch it.

A section closes with its parked lines still open if nobody could settle them.
Say which they are; do not close them by choosing for the user.

### What the coordinator reports

To the user, in the conversation, never into a file — the documents hold what is
left, and git holds what happened. Aggregate the walkers' returns into this shape,
so two consecutive sessions are comparable:

```
SECTION: <letter and name> — closed / still open
CLUSTERS WALKED: <one line each: what it was, frames cleared>
BUILT: <frames that had no code and now do, or "none — every frame was already built">
FIXED: <grouped by defect type, one line per instance>
CROSS-SWEEP: <per defect type, other instances found and fixed, including "0 others">
SECTION AUDIT: <what the read-only pass found — then every finding under one of:>
  REFACTORED: <the code was wrong; what changed>
  NOW CHECKED: <the code was right by habit; which checker now holds it>
  CLOSED:     <neither, with the reason — never "later">
RULES ADDED: <defect type → where the detection rule now lives, or "none" — including any
              rule the section had been obeying only by habit>
BOARD SYNCED: <frames back-filled or corrected, or "nothing — the code was wrong every time">
PARKED, STILL OPEN: <one line each, with what decision it needs and from whom>
VERIFICATION: <each gate and its result>
LEFT ON THE LIST: <how many frames, in which sections>
DELIVERABLES: <what each frame owed beyond code and where it landed, or "none declared">
CAPTURES: <paths only>
```

**A walker that returns nothing has not reported.** Going quiet after committing is the
common failure, and it is expensive in a specific way: the coordinator then has to read
the repository to find out what happened, which spends the context the subagent existed
to protect. Ask once. If the answer does not come, **verify the few claims that decisions
rest on — by running the thing, not by reading the diff** — and move on rather than
chasing. Which claims those are is usually obvious: the ones a later plan assumes.

`PARKED, STILL OPEN` is the part the user acts on, so it is never folded into a
sentence about progress. `LEFT ON THE LIST` is read off the list itself, not
counted from what was walked.
