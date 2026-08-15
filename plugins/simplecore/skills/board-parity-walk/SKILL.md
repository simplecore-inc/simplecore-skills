---
name: board-parity-walk
description: >-
  Use when reconciling implemented screens against a project's wireframe board
  frame by frame, when building screens from a board no code reaches yet, when
  working through or resuming a parity / remaining-screens list, or when setting
  a project up for such a walk — 보드 대조 · 화면 대조 · 프레임 대조 ·
  SCREEN-PARITY · 처리할 화면 · 남은 화면 대조 · 한 구역을 처리한다. Requires a project
  that already has a wireframe board; the application itself need not exist yet.
  NOT for authoring or syncing a board (simplecore:wireframe-boards), and NOT for
  auditing one feature area in one sitting (the project's own e2e skill).
---

# Walking a board against the running app

A board says what each screen holds, in which state, and how the user moves
between them. Code drifts from it — and, before it drifts, it does not exist. This
is the walk that closes both gaps: one section at a time, across many sessions,
until the parity list is empty.

**This document is the coordinator's.** What the agent holding one cluster does
inside it — standing the app up, building an unbuilt frame, committing, logging,
writing prose in the project's language — is `references/walking-a-cluster.md`,
which is equally authoritative and is read by the walker rather than here.

## Precondition: there is a board, or there is no walk

**This skill applies only to a project that already has a wireframe board.** With
no board there is nothing to compare against, and every judgment collapses into
somebody's opinion of the screen in front of them. So when a project has none,
stop and say so. Do not substitute a spec, a screenshot, a list of routes, or a
description of what the screens ought to be, and do not "start the walk and draw
frames as we go" — that is authoring a board (`simplecore:wireframe-boards`), and
it produces a board shaped by the code rather than a contract the code is measured
against. Offer `/simplecore:board-init` and let the board come first. A
parity-walk config sitting in a project with no board is the same situation
wearing a hat: report it as wiring that cannot hold rather than walking anyway.

**The application is the opposite case: it does not have to exist yet.** A board
drawn before the code has no drift to find and every screen still to build, and
that is a walk — the frames are the same frames, the list empties the same way,
and the discipline that keeps a 150-frame walk from decaying is exactly what a
150-frame build needs. Never refuse a walk because the routes are not there yet,
and never wait for somebody to implement first and reconcile later: that produces
screens shaped by whatever was easiest, which is the drift this document exists to
prevent.

It is a different job from the three it sits between:

| Job | Who owns it |
| --- | --- |
| Drawing the board, syncing it after a change | `simplecore:wireframe-boards` |
| Driving one feature area in the browser and judging it | the project's e2e skill — `simplix:frontend-e2e` in a simplix-react repository |
| **Walking every frame of a board to empty, over sessions** | **this skill** |

**Moving a project off this walk and onto chapters belongs to `simplecore:board-to-app`, not
here.** That skill builds a board in dependency order — a chapter at a time, each closing on its
persona tests — and owns the move: `references/migrating-from-a-walk.md` there is the procedure,
covering what the config carries over, how the chapters are decided, and the order that leaves this
project working at every step. Nothing here has to be finished first, and a walk keeps running
until the move is made.

## The rules the walk runs on

Everything below is one of these made concrete. A walk that drops one does not
fail loudly; it decays — into a dried-out context, a document nobody trusts, or a
list that no longer says what is left.

| Rule | What it holds | Where it is enforced |
| --- | --- | --- |
| **One cluster, walked to its end** | A cluster is finished or it is not started. No half-walked section. | Cluster is the unit of work; a section closes only when empty |
| **One walker, isolated** | The coordinating context never fills, and two walkers never fight over the same files. | `simplecore:board-walker` per cluster, one at a time; **hook** |
| **The coordinator does no work** | Not only frames — the backend, the document, the migration go to agents too. One exception dries the session out. | Dispatch every scope; the coordinator keeps the wiring, the two documents, and the cluster decision |
| **Facts shared, narrative private** | The next walker can tell a confirmed fact from somebody's impression. | Handover file vs one log per agent; **hook** |
| **Never stop mid-walk** | A question nobody can answer does not cost the rest of the section, and a parked decision is read first next session. | Park it and move on; session opening order; **hook** keeps the section alive |
| **Only what is left** | The list answers "what remains" and nothing else. | A walked frame is deleted, never marked; **hook** |
| **A correction becomes an instruction** | The next agent does not repeat what this one was told wrong. | A coordination failure is fixed in this skill, the handover file, or the agent's brief — and the file is named |

The four marked **hook** are checked mechanically — three at write time on the two
documents, and one at the moment the session tries to end: frames removed from the
list with no subagent having run blocks the stop once.

## What the project must supply

This skill carries the discipline, not the contents. Before walking, find the
project's own four:

1. **The parity list** — which frames still need walking, grouped into sections,
   plus the parked decisions. Frames are named by the board's **permanent id**
   (`A-01`), never by the bracketed position the board shows beside it: the id
   survives every reorder, the position does not. Walking is the only thing that
   takes a frame off the list; it still grows from the other side — a route that
   did not exist when the list was written, a frame back-filled while syncing the
   board — so emptying it is the walk's job and filling it is not.
2. **The handover file** — the facts a walker needs to start.
3. **The board** — read its source, never its built HTML.
4. **The verification gates** — the commands a section must pass before it closes,
   among them the audit script a twice-seen defect type is written into. A project
   without such a script cannot ratchet; say so rather than inventing a home for
   the rule.

Their paths are the project's to name, and `.claude/board-parity-walk.json` names
them — copy `assets/board-parity-walk.json`, whose fields are:

| Field | What it holds |
| --- | --- |
| `parityList`, `handoverFile` | the two documents, relative to the project root; they start from `assets/parity-list.md` and `assets/handover.md`, and the list is then filled from the board, one line per frame that has a route |
| `parkedSection` | the heading parked decisions live under, written exactly as that project's document writes it — the check refuses to let the section vanish |
| `logDir`, `capturesDir` | one agreed, ignored location each, so a walker never invents a place and a reader never hunts for one. What the capture names look like is fixed and not the project's to choose → `simplecore:board-to-app`'s `references/driving-the-product.md`. A project may add a `captures` note beside them for what *is* local — which module builds a name, which command reads names back, which languages it ships |
| `narrativePhrases` | extends the point-of-view phrasing the handover check refuses, for a project writing in neither Korean nor English |
| `frameDeliverables` | what each frame owes beyond working code, one sentence each that a walker can check against what the walk produced; empty for a project that requires nothing |

### Check the wiring every time this skill loads

**Run this before anything else, on every invocation** — including a session that
only means to resume. It costs one command, and a walk started on half-wiring is
one nobody can pick up later:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json
```

`skills` includes `simplecore:board-parity-walk` only when a board **and** the
config are both present; `missing` names each absent piece in the terms to say it
in.

| Look for | Missing means |
| --- | --- |
| **a wireframe board** | there is nothing to walk against — see the precondition above, and stop |
| `.claude/board-parity-walk.json` at the project root | the write-time checks are off; the rules hold only while somebody remembers them |
| the parity list it names | there is nothing to resume from |
| the handover file it names | the next session re-derives what this one learned |
| a pointer to this skill in `CLAUDE.md` / `AGENTS.md` | a session that starts elsewhere in the repository never loads any of this |

**When anything is missing, say so and offer to fix it in one step, before
walking.** Do not assume the user knows this wiring exists — most of the time they
asked to walk some screens, not to configure a skill. Name what is missing in
plain terms, say what each piece buys them, and offer:

> `/simplecore:parity-walk-init` writes the missing pieces. Shall I run it?

Run it on agreement. When the user would rather not, walk anyway if the parity
list and handover file exist — but say once that the checks are off, and do not
offer again in that session.

**Nothing to resume from is different: with no parity list and no handover file the
walk cannot start at all.** Do not improvise substitutes, do not keep the frames in
your head, and do not walk "just this section" first. Set the project up, then walk.

## References — read on demand

Paths are relative to this skill's own directory.

| Situation | Read |
| --- | --- |
| Inside one cluster — standing the app up, building a frame no code reaches, when to cut a commit, the log line, writing the walk's prose in the project's language | `references/walking-a-cluster.md` |
| Judging a frame — the three lenses, locale and layout rules, the failures no gate can catch | `simplecore:board-to-app`'s `references/judging-frames.md` |
| A measurement that surprises you, a check that has never fired, a rule about to be written, or more than one agent in one tree or on one machine | `simplecore:board-to-app`'s `references/harness.md` |
| Opening the product to look at it — which browser driver, which simulator or emulator, how a capture route is built, and how pictures reach the person judging them | `simplecore:board-to-app`'s `references/driving-the-product.md` |
| A project whose frames owe an artefact beyond code — captures, snapshots — or deciding what `frameDeliverables` should hold | `simplecore:board-to-app`'s `references/frame-artefacts.md` |
| Sample data, the story the screens live in, and what a cluster cost | `simplecore:board-to-app`'s `references/scenario.md` |

## Opening a session

Read, in this order:

1. **The parked decisions** in the parity list — what the last walk stopped on.
2. **The handover file** — how to start the servers, what traps are known, which
   accounts and data are already standing.
3. **The section you are about to walk** and its frames on the board.

Then, before picking a cluster, ask whether this session can settle any parked
decision. Settling one usually changes what the next frames should look like, so it
comes before walking — but it needs the app running, which is why it comes after
the handover file. A decision settled is applied to the code or the board, and its
line is deleted.

## The unit of work is a cluster, and one agent takes one cluster

**Never walk in the coordinating context.** Including the first frame. Setting a
project up — the config, the two documents, the scripts a walk depends on — is the
coordinator's work and belongs here. Taking one frame through end to end to settle
the format is **not** setup; it is a cluster, and it costs the same context every
other cluster costs. The pilot is where this rule gets broken, because it feels like
part of the setup it is proving. Screenshots and logs fill a context fast; a walk
run there dries out before a section is done and leaves half-built code behind.
That failure is the reason this skill exists.

1. **One cluster, one subagent — `simplecore:board-walker`.** That agent ships with
   this plugin and carries the walker's half of the discipline. Dispatch it rather
   than composing a prompt each time — a walker briefed from scratch walks
   differently from the last one, which is the inconsistency this document exists to
   prevent. Hand it four things and nothing more:
   - the cluster: which frames, and what makes them one cluster
   - the path to `.claude/board-parity-walk.json` (it reads the documents itself)
   - the personas this area has beyond the standing three, when the board names any
   - the section it belongs to, so its log line says where the walk is

   A cluster is the set of frames that have to be seen together for a disagreement
   among them to show up. Most often that is one record's whole life — born, moved,
   closed, reversed — plus every screen that shows it; just as often it is a flow
   with no record behind it, like a setup wizard, a sign-up, or a family of public
   links. **Never a fixed frame count:** splitting by count hides the cross-screen
   disagreements the walk exists to catch, because no single walker sees both sides.
   A cluster of frames that have to be *built* is smaller than one that only has to
   be compared → `references/walking-a-cluster.md`.
2. **Finish, then replace.** When the cluster is done the agent ends, and the next
   cluster gets a **new** agent. Never stack a second cluster on a running one —
   preventing accumulated context is the whole point. **Stop a walker once its
   report is in and verified**: a finished agent left alive keeps announcing itself,
   and a coordinator watching six of those cannot see at a glance which one is
   actually working.
3. **One walker at a time, and the test is not about files.** A walker fixes code as
   it goes and drives the dev server, so two of them collide over the same files and
   the same ports. Clusters run **in sequence**. There is no arrangement of two.

   **Ask of any two pieces of work: could these ever reach the same thing?** Anything
   but a flat no means they are one agent's work, done one after the other. Files are
   the smallest part of what they share — one tree, one index, one dev server, one
   port, one device, one database, one handover file, one gate command.

   **Two disjoint path lists are not a flat no.** What an agent touches is settled
   while it works, not when it is briefed — a screen agent decides where a string
   belongs by building the screen — so a path split is a claim about the future rather
   than a fact anybody can check. The files that break it are the ones no brief could
   have named, because every agent eventually arrives at them: a registry, a locale
   catalogue, a config, a barrel, the handover file. Three agents on paths that
   genuinely did not overlap, and one commit carried off a translation key another had
   just added; both reported success independently. Six split the same way produced, in
   one session, seven commits that swept somebody else's uncommitted work, two agents
   each hunting through source for a failure that was the other one's test writing to
   the same hardware, and a checker whose forty-minute run reported a defect that had
   been fixed while it ran.

   **Two things earn it, and both are facts rather than forecasts:**

   - **The second one never writes** — it reads and plans, or its subject lies outside
     the repository.
   - **Every shared thing is genuinely separate**: tree, index, database, port, device.
     Not just one. **Do not reach for a worktree** — a second checkout duplicates the
     tree, leaves everything else shared, and then lies about the tree too: standing on
     an older commit it shows work already in the history as though it were somebody's
     uncommitted changes, so the next agent either preserves what does not need
     preserving or sweeps what it cannot see the origin of. Walk on the branch the
     project actually builds.

   **A file two agents both have to write is not a licence to run them together.** It is
   a shared document — exactly one owner at a time — and where it cannot be, the blob
   written straight into the index (`simplecore:board-to-app`'s `references/harness.md`) keeps one from swallowing
   the other's line. That is a way to survive the collision, not a way to earn it.

   This is the rule that gets bent for speed, and the cost is not slower work — it
   is work you cannot trust. Two walkers sharing one device produce captures of the
   wrong screen that look entirely correct; two sharing one tree fold each other's
   uncommitted changes into their commits. Neither announces itself.
4. **The agent returns conclusions**, in the fixed shape its definition specifies:
   what it fixed, which defect type became a detection rule, what it parked, which
   standing sentences it re-read and found still true, what it left running, whether
   verification passed. No screen dumps, no running commentary, no images.

   **The deliverable lands in a file; the report summarises it.** An agent that fixes
   code leaves its work in the tree, so a report that never arrives costs a look at
   the diff and nothing more. An agent whose output is a *judgment* — a contract, an
   audit, a comparison, a decision between two designs — leaves nothing if it ends
   before reporting, and agents end for reasons that have nothing to do with the
   work. Dispatch those with a file to write and tell them to **write as they go**, a
   section at a time, with a line at the top saying how far they got.

   **So a read-only agent still needs `Write`.** Reaching for a review or auditor
   subagent is the right instinct — it cannot edit the tree it is judging — but the
   ones that ship with a tool list usually drop `Write` along with `Edit`, and then
   the agent has nowhere to put its judgment except a final message that may never
   arrive. Read-only means *it does not touch the subject*, not *it produces
   nothing*. Check the tool list before dispatching, and give it a scratch file
   outside the tree it is reading.
5. **A rule nobody tried to break is a rule that says the tree is green.** When a
   check goes in, plant the defect it exists for and watch it fail, then take the
   defect out and watch it go quiet. Both halves: a rule that fires on everything is
   as useless as one that fires on nothing, and neither announces itself. This
   applies to the check's *premise* as much as its logic — where a check asserts
   something about real data, run the real producer over the real data rather than
   comparing the data to itself.
6. **The coordinator only coordinates.** Picks the next cluster, deletes walked
   frames from the list, records parked decisions, surfaces capture paths without
   opening them. It does not open the board, drive the browser, or do the work.

   **This holds for every other kind of work in the session, not only for frames.** A
   walk almost never happens alone — there is a backend to build, a document to
   write, a migration to run — and the coordinating context dries out on a pipeline
   stage exactly as fast as on a screen. The rule is not "screens go to subagents"; it
   is **the coordinating context does no work**. That is the exception everyone makes,
   because the other work feels different: it is not a frame, no cluster covers it,
   and it looks small from here. Then a session that was supervising six walkers is
   halfway through a service layer, and every judgment it still owes is made on a
   context with no room left.

   What the coordinator may touch directly is the coordination itself: the wiring,
   the two documents, and the decision about what a cluster is. **It does read the
   log, and it relays** — that is the one exception, and it is a few lines rather than
   a transcript. When it commits anything of its own while agents are running, it
   stages by path like every one of them.

   **A screen that changed is shown, not described.** "The tab strip is in place and
   the activity pane fills the rest" is equally true of a screen that works and one
   that draws its rows in the wrong order, off the edge, or in the wrong language, so
   a report that only says it looked asks the user to take the walk's word for the one
   judgment they were meant to make themselves. Send the picture → *Three reasons to
   photograph a screen*, below.

**Anything only one user can hold at a time arbitrates itself, in the tool that uses
it.** A simulator, a phone, a browser profile, a development database, a port, a
capture run — each takes its own lock atomically on start, refuses loudly with who
holds it, and clears a lock whose holder is gone. **Never make the coordinator the
queue**: a permission that travels as a message can cross or drop, and the resulting
stall is invisible from both ends. A shared *document* is the same rule in prose —
exactly one owner at a time.

Sequential work still needs each brief to say what it owns. **Name in every brief which
paths belong to this agent and that everything else is somebody's**, and read each new
brief against the last for what it is asked to **produce** rather than only what it may
touch — two briefs with disjoint paths can still both build the same checker.

**The brief carries the staging rule itself — never a pointer to it.** Say in every brief:
stage the paths you touched by name, never `git add -A` or `-A`'s cousins, and read
`simplecore:board-to-app`'s `references/harness.md` § Stage your own paths **before it is needed**. An agent that meets
a shared file without having read that section reaches for the obvious move, and every
obvious move there costs somebody their work. A rule that lives only in a reference is read
after the damage, and the tell is an agent that says *nothing of mine was swallowed* — a
report about who happened to be alone, not about what the discipline held.

**A walker's session can end for reasons that have nothing to do with the work** — a
usage limit, a dropped connection. What survives is what it committed, which is why
committing at every point that stands on its own (`references/walking-a-cluster.md`) is
also what makes a walker interruptible. Three rules cover every such ending:

- **Read the tree rather than guessing**, and finish or discard what is half-done
  **before** dispatching the next walker into it.
- **Check whether the work is still moving before replacing anybody.** A pause looks
  exactly like a death, and a replacement dispatched over a live agent puts two on
  one job.
- **The moment a cluster is handed to somebody else, stop the agent it was taken
  from.** Not "note that it died" — stop it, with the tool that kills it, not with a
  message asking it to stand down; a message is a request that arrives after its next
  write. A suspended agent is a scheduled write against a tree that no longer exists.
- **Only the agent's own "I am finished" ends its hold on the tree.** A commit, a
  clean status, an idle notification and a report that reads like a conclusion are all
  things an agent produces *mid-assignment* — it committed a step that stands on its own,
  exactly as instructed, and went quiet while thinking about the next one. Dispatching
  into that gap is the coordinator putting two agents on one tree, and it will keep
  happening as long as a good interim report is read as an ending. **Stop the previous
  agent before dispatching the next one, every time**, whether or not you believe it is
  done. Stopping an agent that was genuinely finished costs nothing.

A cluster that runs out of context before it ends is not handed to a second agent to
continue; the next agent would inherit conclusions without the screens behind them.
Restart it, split at a seam where the two halves do not need to see each other.

**Everything in this section that fails silently is catalogued** — how to prove a lock
actually refuses, the stale index, the duplicate deliverable two briefs both asked for,
why `git show --stat` is not attribution → `simplecore:board-to-app`'s `references/harness.md`.

## What a frame owes besides working code

Some projects require something per frame beyond the code — a capture under realistic
data, a snapshot test, a look taken with somebody's own eyes. Where that is so, the config
names it in `frameDeliverables`, one checkable sentence each, and **a frame that owes
one is not walked until it exists** — so it is not deleted from the list. That is what
keeps it from becoming a separate pass that never happens.

Two rules make it affordable rather than doubling the work: **the same walker produces
it, in the same cluster**, and **what generates it must be deterministic**. Artefacts
have their own failure modes and every one of them is silent →
`simplecore:board-to-app`'s `references/frame-artefacts.md`.

### Three reasons to photograph a screen, and none of them substitutes for another

Every walk takes pictures for three different purposes. They are confused constantly,
because all three are files ending in `.png`, and each confusion drops a different rule
on the floor.

| Picture | Why it is taken | What happens to it |
| --- | --- | --- |
| **Looking** — the visual pass | the only gate that catches what no test can fail on: a class the styling engine dropped, a font with no glyph, a label cut at an edge | every frame, in every locale and on every device that frame owes; thrown away when the walk is over, never during it |
| **Showing** — what a change did | prose about a screen is unfalsifiable to the person reading it | the coordinator forwards the path the moment it appears, unopened, in the language a person reads |
| **Keeping** — figures a document holds onto | kept figures have to be true of **one** version of the product, not of eight months of it | its own naming scheme, outside `capturesDir`, in one run at the end from a finished product |

- **Looking is unconditional.** Not a project's to opt out of, not deferrable, not
  satisfied by a green gate → `simplecore:board-to-app`'s `references/judging-frames.md`.
- **Showing is owed whenever a walk moves what a screen draws** — or moves the frame it
  is drawn against. It costs the coordinator a path, which is exactly why walkers return
  paths and never images.
- **Keeping is nothing the walk asks for.** No frame owes a picture that outlives it. A
  project that keeps figures for a document of its own runs that as its own scheme, on its
  own schedule, and a walk neither waits for it nor counts a frame unwalked without it →
  `simplecore:board-to-app`'s `references/frame-artefacts.md`.

## Parity is the floor, not the verdict

A frame can match the board exactly and still be a screen nobody can work in. So every
frame is **judged as well as compared**, in character, by the three that stand on any
board — a UI/UX reviewer, the operator whose work the screens carry, and the end user
the service is for — plus any persona the board itself names.

**A frame is not judged until it has been seen in the longest language it ships in, and
looking means pressing.** Both halves have failure modes that read as a clean screen: an
overflow that only exists in the language nobody photographed, a second tab that was
never opened, a checker that has stopped checking.

The lenses in full, the locale and alignment rules, the rubric a project's own
screen-audit skill supplies instead, and the anchor every finding needs →
`simplecore:board-to-app`'s `references/judging-frames.md`.

## When a frame diverges

1. **Fix it there.** Then walk the same path again, and the neighbouring screens with it.
2. **A defect a machine could see becomes a rule the moment you understand it.** Not on
   the second sighting — that is the floor, not the bar. If a regex or a walk over the
   syntax tree can find it, it becomes a detection rule in the project's audit script
   now, in this change, so the next pass catches it without anybody looking.

   Ask the question every time: **can a machine see this?** Most defects that reach a
   person are mechanically visible once somebody has described them precisely — a value
   computed in two places, a string that should exist once, a control with no destination.
   Describing it well enough to detect is most of understanding it.

   **A new rule is wired into the command the project already runs, and it sweeps the
   whole tree the moment it exists.** A script that has to be remembered is a script
   nobody runs; a rule that reports without anybody fixing what it found has moved the
   defect into a log. Add it to the gate, run it across everything, **fix what it finds**,
   and report the count — zero proves coverage, non-zero is the rule earning itself
   immediately.
3. **A failure of coordination is a defect of the same kind, and its rule is a written
   one.** A walker that built the wrong thing, an agent that returned nothing, a handover
   the next session could not use, a coordinator that did the work itself — none of those
   is the agent's failure. It is a failure of what the agent was told, and correcting that
   one agent leaves the next one to make the same mistake at the same place. Fix the
   instructions instead: this skill, the project's handover file, or the brief every agent
   of that kind receives. Then **say which file you changed** — the instructions live
   outside the repository being walked, so nobody sees the change unless you name it.
4. **Only what needs a human goes to a human**, and it goes to the parked section, not
   into a pause.

Do not write audit findings into documents. A finding was fixed, became a rule, or is a
line on the list.

### Parking is a last resort, and most things do not qualify

**The default is to decide.** An open question is answered by designing the answer —
architecture first, then consistency with what the product already does, then stability,
then performance — and the decision is applied to the code and the board in the same
change. Those four are an order, not a list: a fast screen built on the wrong shape is a
rewrite, and a screen that disagrees with its neighbours is a defect no benchmark can
see. A walk whose parked section keeps growing is not being careful; it is deferring the
design work the walk exists to do, and every deferred decision makes the next frame
harder to build because it rests on nothing.

**These are never reasons to park:**

| "I can't decide this because…" | What to do instead |
| --- | --- |
| it would add screens or states | Add them. Draw the frames, then build them. Scope is not a reason to leave a product incoherent. |
| it is complex to implement | Complexity is the work. Design it properly and build it. |
| there are two reasonable options | Pick the one more consistent with the rest of the product, and say why. Two reasonable options is a decision, not a blocker. |
| the requirement is not written down | Derive it from the spec and the personas the board names. Write down what you derived. |
| an external system's behaviour is unknown | Design so the answer does not matter — declare the capability, handle both, reject explicitly what is unsupported. A product that changes shape when a vendor's answer arrives was not designed. |

That last row is the one that hides. An unknown about somebody else's API is almost never
a reason to stop drawing a screen; parking it freezes a whole section behind a fact nobody
is chasing.

**Two things genuinely qualify**, and both share a property — no amount of design makes
the answer derivable:

- **A commercial or legal decision that is somebody's to make.** A price, a contractual
  term, a retention period a regulator sets. Design everything around it so the value is
  the only thing missing.
- **A blocker in the world.** An environment that cannot reach a service, hardware nobody
  has yet. Build and judge everything that does not depend on it, and park only the part
  that does.

Even then, park the narrowest thing. "The whole M section is blocked" is almost always
"one decision inside M is blocked, and nobody separated it from the rest".

When something does qualify: **do not stop, and do not guess.** Add one line to the parked
section and move to the next frame — which frame · what the choice or blocker is · which
side looks stale. A line missing the third part sends the next session back to re-derive
it, which is the cost parking exists to avoid.

```markdown
- C-07 — board draws a bulk reverse; the API reverses one record at a time.
  Board looks stale, but the operator does 40 a day. Product decision.
- D-02 — needs a role that does not exist in any environment yet. Blocked, not stale.
```

**Write the line before saying it is parked.** A decision announced in a message and never
written down is one the next session cannot find, and the coordinator is the likeliest
author of that gap: an agent reports something undecided, the reply acknowledges it, and
both sides then believe it is on the list. Nothing is. So when an agent surfaces a parked
decision, put it on the list yourself in the same turn, or tell the agent to — then say
which one happened. "Recorded" is a claim about a file, and the file is the only place it
is true.

Parked lines are read at the start of every session, which is what keeps parking from
becoming forgetting.

## Two kinds of leaving-behind, and only one is shared

Sequential agents must not re-derive what the last one learned. But left to append freely
they produce a diary with several authors, and the next agent cannot tell a confirmed fact
from somebody's impression.

| | Shared — facts | Not shared — narrative |
| --- | --- | --- |
| Where | the project's handover file — there is exactly one | one log file per agent |
| What | how to start the servers, known traps, accounts and data standing | what was walked, what diverged |
| How | present state in plain declaratives; **overwrite** when wrong | one line appended per step |
| Read by | every agent, at the start | its own agent, and whoever is watching |

**The handover file has no room for a point of view.** No "I found that", no "this time",
no "it used to be". A fact that changes is corrected in place, with no history left
behind. That is what lets any number of authors maintain it. **Do not create a shared
narrative file** — several agents stacking their stories in one place produces exactly the
confusion this split prevents.

**A log written afterwards is not a log.** Its whole value is answering "where is this
now" while the answer is still changing; written at the end it answers a question nobody
still has, and every hour before that was spent looking silent. Silence reads as a stall,
and a stall gets a running agent killed — so the cost of skipping the line is not tidiness,
it is somebody stopping work that was fine. That failure lands hardest on an agent that
**dispatches** sub-work rather than walking frames itself: its own file stays empty because
it is not the one touching screens, and it is the only file anybody watching can read. An
agent that hands out work still writes one line per step it takes — briefed, judged,
committed — under its own name.

The line's shape and vocabulary → `references/walking-a-cluster.md`.

## The list holds only what is left

A walked frame is **deleted from the parity list.** Not ticked, not struck through, not
moved to a "done" section. The list exists to answer one question — what still has to be
walked — and every completion marker left behind makes that question more expensive to
ask. Counting what is behind is not this document's job; git holds that.

The same applies to a parked decision once it is settled, and to a section once its last
frame is gone. An empty list means the board and the code agree.

## Letting a person watch, without paying for it

**Arm both watches in the same turn the walker is dispatched.** Not afterwards, not as an
intention: the coordinator is busy between events and two turns is an hour, so "I will
check the log" is the failure, every time.

| Watch | Answers |
| --- | --- |
| the log directory, filtered to the step words | *is it moving, and where is it* |
| the capture directory, for new image files | *what does the screen actually look like* |

Both cost the coordinator almost nothing, because both deliver a **path** — a line of
text, or a file forwarded to the reader without ever being opened here. That is the whole
trick: a walk can show its work precisely because the coordinator never looks at it. Where
the environment cannot stream file changes, poll on a slow interval rather than dropping
the watch; a minute of lag is nothing against an hour of silence.

**A watch that stops is re-armed at once.** They die quietly — a timeout expires, a process
is killed, a session is resumed without them — and a dead watch is indistinguishable from a
working one, because both produce nothing. So treat silence as suspect rather than as
reassurance: when events stop arriving while a cluster is still running, assume the watch
died before assuming the walker did, check, and put it back.

**A watch that was never alive is the harder one**, because "events stopped arriving" never
happens — there was no first event to stop. Its silence is read as *the work has not reached
that stage yet*, and that reading is available for as long as the walk lasts. So prove every
watch the moment you arm it, in the same turn: make it fire once, then watch it go quiet →
`simplecore:board-to-app`'s `references/harness.md` § A watch is a check.

Saving context and hiding the work are different things. Three ways the walk stays visible
while the coordinating context stays empty:

1. **The agent's own work streams to the client.** What it clicked and captured can be
   expanded in the conversation. The coordinator never receives it, so it costs nothing.
   This is the primary way to follow along, including remotely.
2. **Captures go to files; the coordinator forwards them the moment they appear**, by path
   and **without opening the file**. Forward them as they are shot, not at the end of the
   cluster — a person following a walk wants to see the screen while it is still the
   subject. Say which frame and which locale in one line, and send the language a person
   reads rather than the pseudo-locale, which is an instrument →
   `simplecore:board-to-app`'s `references/driving-the-product.md`.
3. **Progress goes into the walker's own log, one line per step** — a line per *frame* is a
   heartbeat every thirty minutes, which from outside is indistinguishable from an agent
   that has stalled.

**Never put an image in a report.** A few of those and the session is dry. Captures and
logs are byproducts — keep them out of the repository. What remains is the fixed code, the
deleted lines, and the facts in the handover file.

## Closing a section

A section is done when every one of its frames is gone from the list. Before saying so:

1. **Cross-sweep by defect type.** Each defect found is a *type*; search the whole codebase
   for other instances and fix those too. Report the sweep per type, including "0 others". A
   type that already became a detection rule is swept by the script — run it and report
   that; the manual search is for the types seen only once.
2. **Audit the section's code, and act on it.** Not optional, and not the same thing as the
   cross-sweep: that hunts instances of defects somebody already found, this looks for what
   nobody found because no single walker could see it. A section is built by several walkers
   in sequence, none seeing the others' code; they solve the same problem in different files
   without knowing the other exists, and every one of those duplicates compiles, passes and
   reviews cleanly on its own. It is only visible from above, once, at the moment the section
   is finished and before the next section copies from whichever variant it happens to open.

   Do it with a **read-only agent while nothing else is running**, so the audit cannot fight
   a walker for the tree. Ask it for: the same logic in two places, a file whose parts
   stopped belonging together, one idea under two names, a rule the section obeys by habit
   that no checker holds, and dead ends. Rank by cost, not by ease.

   Then **act on the findings in the same session**, and every finding leaves as one of
   exactly two things:

   | The finding is | It becomes |
   | --- | --- |
   | Something wrong in the code — a duplicate, a seam, a name | **A refactor.** Done now. |
   | Something the code happens to get right, with nothing holding it | **A checker.** Written now. |

   There is no third column. "Worth doing later" is where findings go to die: the report is
   filed, the duplicate is copied by the next section before anybody returns to it, and the
   audit spent its context for nothing. If a finding is genuinely not worth either — say so
   and why, and it is closed rather than deferred.

   The second row pays for the whole exercise and is the easiest to miss because nothing is
   broken. Eight screens doing the right thing because their authors happened to is not a
   rule; it is eight coincidences, and the ninth screen is written by somebody who never saw
   the other eight. Ask of every convention the section follows: **what stops the next screen
   breaking this?** If the answer is "somebody would notice in review", write the checker.
3. **Run the project's verification gates.** All of them, green.
4. **Sync the board in the same change** where the code was right and the board was stale —
   but only the layer a board contracts (screens, content, states, flow, fixed wording).
   Restyling and i18n catalogue text never touch it.

**A board contracts structure, not the values in its illustration.** Which fields appear, in
which state, with which wording keys, and how one screen reaches another — those the code owes.
The counts, names and dates drawn beside them are there to make the picture legible, and asking
whether they are contractual is a malformed question: it is a wireframe, so of course they are
illustration. Two failures follow from confusing the two, and both cost a session here:

- **Bending the product to reach a drawn number.** A plan frame said nine works; the fixture,
  once its own defect was fixed, honestly produced twenty-eight. Chasing the nine would have
  meant rewriting the population to fit a drawing. The walker who measured it found the drawing
  had never been derived from the product at all — it was drawn by hand, and one of its rows
  named a person the app holds no photograph for.
- **Making the drawing track the fixture.** The mirror error, and the one to guard against while
  fixing the first: derive the illustration from live data and every fixture change ripples into
  the board. A wireframe does not owe that coupling.

**What a board's values do owe is agreement with themselves.** A person drawn as *photograph
replaced* in one frame and *no photograph* in another is the board contradicting itself, and that
is a defect whatever the product holds. Judge illustration against the rest of the illustration,
never against the fixture.

A section closes with its parked lines still open if nobody could settle them. Say which
they are; do not close them by choosing for the user.

### What the coordinator reports

To the user, in the conversation, never into a file — the documents hold what is left, and
git holds what happened. Aggregate the walkers' returns into this shape, so two consecutive
sessions are comparable:

```text
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
STILL TRUE: <standing prose a walker read against what it guards and did not have to
             change — which document, what it stands over, or "none — nothing was re-read">
PARKED, STILL OPEN: <one line each, with what decision it needs and from whom>
VERIFICATION: <each gate and its result>
LEFT ON THE LIST: <how many frames, in which sections>
DELIVERABLES: <what each frame owed beyond code and where it landed, or "none declared">
CAPTURES: <paths only>
```

**`STILL TRUE` is how standing prose gets an age.** A handover fact, a parked line, a
note that names files — each keeps saying what it said after the thing beneath it moved,
and only somebody who read it against that thing can date it. Such a reading ends with
nothing to change and so leaves no other trace, which is why it gets a field rather than
a mention: without one, the walker who looked and the walker who did not are reported
identically. Read `none — nothing was re-read` as what it is — every standing sentence in
this project is now exactly as old as it was when the section opened.

**A walker that returns nothing has not reported.** Going quiet after committing is the
common failure, and it is expensive in a specific way: the coordinator then has to read the
repository to find out what happened, which spends the context the subagent existed to
protect. Ask once. If the answer does not come, **verify the few claims that decisions rest
on — by running the thing, not by reading the diff** — and move on rather than chasing.

**Before asking twice, check how that agent's report was supposed to reach you.** An agent
launched as a *named teammate* does not return its final message; it has to send one, and an
agent that wrote a full report as ordinary text believes it has reported while nothing has
arrived. Two of these in one session cost three rounds of asking each. So the second ask
names the mechanism rather than repeating the request — *send it, do not write it* — and
every brief for a named agent says which of the two it is. The instruction belongs in the
agent's own definition as well as here: an agent reads its definition and never reads this
file, so a rule that lives only here reaches nobody who could act on it.

**A reading that contradicts a report is a clock before it is a defect.** Measuring rather than
taking a walker's word earns its keep — but a file read one commit behind the walker who just
fixed it yields line numbers for a defect already gone, with both sides right. So before
returning anything a report contradicts, **look for the hashes it named** (walkers put one on
every claim of a change): absent is work that has not landed, present is a reading taken in
front of it. Then argue what the file says, never where it says it — a fix that adds a line
moves every number under it.

**Take the reading out of a commit, never off the working tree.**

```bash
git show HEAD:<path> | grep <what you are checking for>   # or the hash the report named
```

While a walker is in the tree, the tree is not any moment at all. Proving a new rule means
planting the defect back into the file and taking it out again — in the working tree and
never in a commit, which is what this skill requires of walkers — so a `grep` that lands in
that window reads a file mid-repair and reports finished work as missing. One session paid
for exactly that twice, both times as "it did not go in, I measured it", and both times the
walker answered with a `git show` of a hash its report had already named. A commit holds
still; disk does not.

`PARKED, STILL OPEN` is the part the user acts on, so it is never folded into a sentence
about progress. `LEFT ON THE LIST` is read off the list itself, not counted from what was
walked.
