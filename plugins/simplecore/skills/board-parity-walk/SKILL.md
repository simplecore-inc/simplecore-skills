---
name: board-parity-walk
description: >-
  Walk a wireframe board's frames against the running application, section by
  section, over many sessions — the long-running parity audit that follows
  implementation. REQUIRES a project that already has a wireframe board; with no
  board there is nothing to walk against, and the answer is to draw one first
  (wireframe-boards) rather than to improvise a substitute. Use when reconciling
  implemented screens with a board,
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
between them. Code drifts from it. This is the walk that finds the drift — one
section at a time, across many sessions, until the parity list is empty.

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
  "narrativePhrases": []
}
```

Paths are relative to the project root. `parkedSection` is the heading the parked
decisions live under, written exactly as that project's document writes it — the
check refuses to let the section vanish. `logDir` is where walkers write their own
logs, and belongs in the project's ignore file rather than in the repository —
the walk needs *one* agreed location so somebody can tail it without asking.
`narrativePhrases` extends the point-of-view phrasing the handover check refuses,
for a project whose documents are written in neither Korean nor English.

The two documents start from `assets/parity-list.md` and `assets/handover.md` in
this skill; the parity list is then filled from the board, one line per frame that
has a route, grouped into sections.

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

**Never walk in the coordinating context.** Screenshots and logs fill it fast;
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
   the walk exists to catch, because no single walker sees both sides.
2. **Finish, then replace.** When the cluster is done the agent ends. The next
   cluster gets a **new** agent. Never stack a second cluster on a running one —
   preventing accumulated context is the whole point.
3. **One walker at a time.** A walker fixes code as it goes and drives the dev
   server, so two of them in one working tree collide over the same files and the
   same ports. Run clusters in sequence, or give each walker its own worktree *and*
   its own ports.
4. **The agent returns conclusions**, in the fixed shape its definition specifies.
   What it fixed, which defect type became a detection rule, what it parked, what it
   left running, whether verification passed. No screen dumps, no running commentary,
   no images.
5. **The coordinator only coordinates.** Picks the next cluster, deletes walked
   frames from the list, records parked decisions, surfaces capture paths without
   opening them. It does not open the board, drive the browser, or read a log.

A cluster that runs out of context before it ends is not handed to a second
agent to continue — the next agent would inherit conclusions without the screens
behind them. Restart it, split at a seam where the two halves do not need to see
each other.

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

Saving context and hiding the work are different things. Three ways the walk
stays visible while the coordinating context stays empty:

1. **The agent's own work streams to the client.** What it clicked and captured
   can be expanded in the conversation. The coordinator never receives it, so it
   costs nothing. This is the primary way to follow along, including remotely.
2. **Captures worth keeping go to files; the report carries paths.** Name them
   for the frame they justify. The coordinator surfaces the path **without
   opening the file** — the image renders for the reader and never enters the
   context.
3. **Progress goes into the walker's own log, one line per frame — not one
   summary per cluster.** Somebody watching wants to know where the walk is now,
   and can tail that file; a summary written after the cluster finishes answers
   the question too late.

For the tail to be possible, the log needs an agreed place and an agreed shape.
One file per walker under the config's `logDir`, named for the cluster, and one
line appended **as each frame is finished**:

```
<HH:MM> <frame id> <VERDICT> <what, in one clause>
```

`VERDICT` is one of `MATCH` · `FIXED` · `PARKED` · `BLOCKED`, so the file can be
grepped for what still needs a human without being read. Nothing else goes in a
log line — no reasoning, no page text, no image paths.

```
14:02 B-03 MATCH   list, filters, empty state all as drawn
14:09 B-04 FIXED   detail title showed the record id; now the person's name
14:15 B-05 PARKED  board draws a bulk-reverse the API has no endpoint for
```

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
   script — so the next pass catches it without anybody looking.
3. **Only what needs a human goes to a human**, and it goes to the parked
   section, not into a pause.

Do not write audit findings into documents. A finding was fixed, became a rule,
or is a line on the list.

### What you cannot settle does not stop the walk

Some divergences turn on a product decision — the board draws something the code
cannot honour, or the code does something the board never described, and which
of the two is stale is not yours to settle. Others are blocked by the world: an
external service the environment cannot reach, data nobody can stand up, a
screen that needs a role that does not exist yet.

**Do not stop, and do not guess.** Add one line to the parked section of the
parity list and move to the next frame. The line says which frame, what the
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
2. **Run the project's verification gates.** All of them, green.
3. **Sync the board in the same change** where the code was right and the board
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
FIXED: <grouped by defect type, one line per instance>
CROSS-SWEEP: <per defect type, other instances found and fixed, including "0 others">
RULES ADDED: <defect type → where the detection rule now lives, or "none">
BOARD SYNCED: <frames back-filled or corrected, or "nothing — the code was wrong every time">
PARKED, STILL OPEN: <one line each, with what decision it needs and from whom>
VERIFICATION: <each gate and its result>
LEFT ON THE LIST: <how many frames, in which sections>
CAPTURES: <paths only>
```

`PARKED, STILL OPEN` is the part the user acts on, so it is never folded into a
sentence about progress. `LEFT ON THE LIST` is read off the list itself, not
counted from what was walked.
