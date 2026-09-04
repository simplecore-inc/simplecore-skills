<!-- Split out of SKILL.md so a session loads it only when its subject comes up. The skill's
     own section of this name is a routing stub pointing here. -->

# The unit of work is a chapter, and one agent takes one chapter

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

   **Ask an agent to prove a set complete, not to name its exceptions.** The two questions
   look interchangeable and produce different answers. 「Which ones were also generated?」
   returns the ones that differed — a short, true, useless list, because a file that was
   edited and happens to match what the generator writes is not an exception to anything and
   nobody thinks to mention it. 「Was that the whole set, and how do you know?」 returns the
   census, and the census is where the finding is: fifty files hand-edited rather than two,
   and forty-eight more inside the same glob that were spared only because they happened to
   hold nothing the sweep was looking for. **The second half is never volunteered**, because
   it is a list of things that did not happen — and it is the half that says whether the
   protection was the design or the corpus.

   > This holds for a report as much as for a brief. **A number an agent reports is the
   > number its question asked for**, so 「how many did you fix」 and 「how many did you look
   > at」 come back as the same figure unless both are asked. Ask for the denominator by name.

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

   **Give the artifact time to move before reading it as stalled.** A build, a rebuild of a
   workspace package, a long typecheck — each leaves the tree untouched for many minutes
   while the agent is working hard, so a reading taken a minute after the last step reports
   every busy agent as stopped. **Twenty minutes without the artifact moving is the point
   worth checking**, and checking means asking rather than reassigning.

   **A clean tree is not the stall test, and reading it as one produces two writers on
   one file.** An agent spends its first many minutes reading, invoking its skills and
   planning, and writes nothing in all of that — so the tree looks exactly as it looks
   when the agent never started. Neither does an idle signal settle it: a peer can be
   reported available and be working, because that signal races the work. **Before
   reassigning a task, stop the agent holding it or get it to say it has not started**;
   an artifact that has not moved is evidence only for an agent that was sending steps
   and stopped. This has happened — a task reassigned on a clean tree and an idle
   notification put two agents on the same file, and the duplicate had to be killed
   mid-flight.
8. **At the end the agent returns conclusions.** What it built, what it fixed in the
   board and why, which persona lines failed and what it did about them, what it
   parked, and whether the chapter closed. No screen dumps, no commentary, no images —
   its work is in the tree and in the state ledger, and the report says where to look.

   **Whether that return arrives at all is decided by how the agent was launched, and the brief
   says which.** A subagent's final message comes back to whoever dispatched it; a **named**
   agent's does not — it has to send one, and nothing about writing a full report as ordinary
   output tells it that nothing arrived. So a brief for a named agent carries the mechanism in the
   words that agent will need it in — *send it, do not write it*, and who to send it to. Written at
   dispatch it costs one line; discovered afterwards it costs the coordinator a reading of the
   repository to find out what happened, which is the context the subagent existed to protect.

   > **Read it this way and it is wrong**: 「it wrote the report, so it has reported」. Three agents
   > in one build wrote full reports as ordinary output and then announced idle, each believing it
   > had reported and none of them having sent anything — and from the coordinator's side all three
   > read as agents that went quiet after committing.
   >
   > **The fourth was the brief that asked for this rule to be written down**, which set out the
   > subject at length and named the mechanism nowhere. That is where it is easiest to lose: the
   > coordinator's attention is on the content it is handing over, and beside that the mechanism
   > reads as housekeeping. It goes into the brief on the same pass as the subject, never as a
   > check afterwards.
   >
   > **A brief ending in 「Return: …」 is where it hides after the rule is known.** That line names
   > everything the report must contain and nothing about how it travels, and it reads as the
   > return having been specified — so the one paragraph that would have carried the mechanism is
   > the paragraph that feels already written. Five briefs in one build ended that way, each
   > carefully listing what to report, and every agent that read one wrote the list into nothing.
   > **The test is not whether the brief says what to return; it is whether it names the verb.**

   **The inverse costs the same and is easier to write by accident: an UNNAMED subagent has no
   channel at all.** A brief that tells one to 「report at every step you close」 is asking for
   messages it cannot send — everything it writes as ordinary output waits until it returns, so
   the coordinator arms itself to read step reports that physically cannot arrive, and the agent
   believes it is reporting. **So whatever the brief asks the agent to report, it says through
   what.** For an unnamed subagent that is the run log, and the brief says it in those words —
   *this log is your step report and it is the only channel you have* — which is also what makes
   the stall test decidable, since the log is the artifact the coordinator was going to watch
   anyway. A brief carrying the step-report shape and no channel is one whose arrangement works
   only if it happens to have asked for a log as well.

   **A third shape costs more than either, because it comes back looking like success: an unnamed
   subagent that sends its report to somebody else.** Its return reaches whoever dispatched it —
   but nothing stops it also calling the message tool, and a brief that says 「return this to me」
   without naming *me* leaves it to resolve 「me」 on its own. What it reaches for is a name it can
   see: the chapter's name, the repository's name, the main conversation. The dispatcher then
   receives a two-paragraph summary of a report that went somewhere else, and the summary reads
   like a completed hand-off — the work was done, the files are on disk, the headline findings are
   there. What is gone is the body, and the body is the part nothing else can reconstruct.

   **So a brief names the channel by name, or forbids the tool.** For an unnamed subagent the
   sentence is *return this as your final message; do not send it to anybody* — one clause, and it
   removes the choice rather than relying on the agent to resolve a pronoun. Where the dispatcher
   does have a name worth using, it writes that name out.

   > **Read it this way and it is wrong**: 「it is a subagent, so its report comes back to me」.
   > Twice in one chapter a capture agent's full transcription — a numbered reading of thirty
   > demands against a screen, the only record of what that screen showed — was addressed to the
   > chapter's own agent name, and both times the dispatcher was left holding a summary and a
   > folder of pictures nobody had described. Neither agent could be resumed afterwards, so one
   > screen had to be shot again from nothing.

   **A screen nobody watched render is reported as such, and its completion is
   provisional.** 「built, typechecked, and never opened」 is a different claim from
   「done」, and a return that does not separate them hands the coordinator a chapter's
   worth of false confidence. So the conclusions name the frames that were seen rendering
   and the frames that were not, **by id**. A count is not an answer — the frames nobody
   opened are exactly the ones nobody can name afterwards — and the provisional half is
   what tells the coordinator which screens it still has to open itself.

### A gate that contradicts the board is a claim; the board is evidence

**The board is the screen contract, so a rule that disagrees with it is wrong until somebody proves
otherwise — and the proof is a person reading the frames, not the gate passing its own cases.** A
gate proved in both directions is proved against what its author believed; it says nothing about
whether that belief matches the contract.

It is not hypothetical. A placement rule was written from a misread sentence, and **371 frames drew
the opposite order**. The gate then reported 38 pages, agents moved every one of them, and the
artifact that had been right from the beginning was the one treated as needing to be brought into
line. Nobody asked why every frame disagreed, because a gate reads as the settled thing and a frame
reads as a drawing.

- **Before a gate that reorders or removes anything, count the frames that already do it the other
  way.** A handful is a defect the rule exists to catch; every frame in the board is the rule being
  wrong.
- **A rule derived from a sentence somebody said is a reading of that sentence.** Where the board
  can confirm it, confirming costs one grep and settles it; where the board contradicts it, the
  reading is what changes.
- **The frames are evidence even when they are old.** They were drawn by whoever decided the
  behaviour, from the design documents, before anybody was converting anything.

**The tell that this has happened is a sweep where every page in the tree needs the same change.**
A convention nobody follows anywhere is usually not a convention the product broke; it is one the
product never had.

### An assignment is a hypothesis; the agent about to write is the one who knows

**With several agents in one tree, the coordinator's picture of who holds what is always minutes
old, and the agent about to write is the only one holding current information.** 「That module is
free」 is a claim about a moment that has passed by the time it is read. Four times in one session
it was wrong — a chapter's ground handed out while its builder still held it, a module named free
while a peer was mid-edit in it, a file said to need freeing that its owner had already left, a page
assigned to one agent that another was inside.

**Every one was caught by the agent and none by the coordinator**, and the cost of catching it was
one `git status`.

- **Say who else is near, not just what is yours.** An assignment that names the neighbours lets
  the agent recognise a collision instead of discovering one.
- **Re-run the check that produced the list, before opening the first file.** This is the cheap
  one and it is not `git status`: an assignment is a hypothesis about the past by the time it is
  read, so the question is not 「is this file dirty」 but 「is this still a finding」. It caught an
  assignment of five pages that a peer had fixed in the minutes between the sending and the
  reading — two commands instead of five pages of reasoning about why correct code looked done.
- **The agent checks before it writes and again before it stages**, and stages by explicit path
  after reading `git diff -- <file>`. That is what turns a collision into a message.
- **A file that carries changes which are not yours is left, and the owner is told.** Not staged
  around, not committed with, not tidied.
- **When the tree contradicts the assignment, the tree is right.** Report it; do not reconcile it
  by acting.

**The coordinator's part is to make that cheap rather than to be right.** Naming the wave's members
and what each holds costs three lines and turns a check from a suspicion into a lookup. **Name the
command that produced the list too** — an assignment a reader can re-derive is one they can date.

**A stale finding, an in-flight fix and a fresh assignment look identical from outside.** An agent
opened a page named in a live report, found it exactly as described, and two commands later found
it already corrected and dirty in the tree. What kept them out of a half-finished file was going
after an unrelated question first, which put four minutes between reading and wanting to write —
**luck in the shape of curiosity rather than a check anybody ran on purpose.** That is the argument
for re-running the check rather than trusting a reading, however recent.

### A rule written for your own commands has a hole on the side facing briefs

**Every shared-resource rule here is phrased as something the coordinator must not do** — do not
`pkill` a pattern, do not use the driver's close-everything, do not restart a server another agent
is using. Each is right, and each leaves the same gap: **an agent acts on the words it was given,
and a brief is a command issued through somebody else.** 「Kill the hung process」 handed to an agent
is an instruction to kill whatever it finds.

It is not hypothetical and it is not rare. One brief said 「kill whatever background `audit-rendered`
process is still holding」; the process holding was another agent's run against the same dev server,
inside their verification pass. Had the agent obeyed, that run would have died and they would have
hunted the failure in their own code, where nothing could have explained it. Earlier in the same
chapter a brief pointing at a folder rebuilt a foundation that already existed. **Both rules
existed. Both were written about the coordinator's own hands.**

**So a brief names the instance, never the kind.** The session, the port, the path, the branch —
whatever makes the thing addressable — and it says what to do when the name matches nothing, because
「it is already gone」 and 「I am looking at the wrong thing」 are the same silence:

> Kill only what `--session w10-i09c` names. If that matches nothing, the run has already exited —
> do not widen the match.

**The test before sending a brief**: if the agent reads this sentence with no memory of the wave and
no way to see the other agents, what is the widest thing it could do and still be obeying? That is
what it will do on the run where the narrow reading does not fit.

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

**Stamp the chapter's start into `costLog` in the turn its first agent goes out.** The file
records a wall-clock span, and a span is measurable only where somebody wrote down when the clock
started — which nothing but the dispatch itself can do, because a dispatch changes no file and
lands no commit. By the close that moment is gone: what is left is a builder's log where one
exists and a guess where it does not — and a guessed span is worse than an empty one, because
nothing on the line says which of the two it is.

**Consumption is the half that may be unmeasurable, and a null there is honest.** A coordinating
context often cannot count what its subagents spent, because nothing reports it back — and a
project that leaves that field empty still records the span, which is the half nothing else in
the arrangement remembers. What is never honest is skipping the line: a chapter with no entry
reads as a chapter that cost nothing.

> **Read it this way and it is wrong**: 「it is written down in the file, so the next session will
> read it」. A chapter's own entry carried a note asking the next session to stamp the start at
> dispatch, and nobody read it — `costLog` is data, and nothing in *Opening a session* sends
> anybody to it. **An instruction living in a file nothing tells anybody to open is the third
> category wearing a data file's clothes**: it reads as recorded, and the reading it asks for is
> taken by nobody.

**A project that wants a mechanical floor under this writes it in `projectGates`** — that every
chapter its ledger calls closed has an entry in the cost log — because the record's shape is that
project's and no generic gate can read it. The reading is still owed on top of such a gate: a
start invented at the close satisfies it exactly as a start that was observed does.

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
| **`git add` a file you created before committing the path it sits under** | `--only <directory>` carries what git tracks and drops what it does not, silently — so a commit naming the directory lands without the new file in it. One change put twenty files outside the five commits that imported them |
| **read `git rev-parse HEAD` before and after each commit** | expect it to have moved — that is the normal state during a wave, and it is the state in which a rewrite destroys work |

**A destroyed commit is in the reflog.** Read it back with `git reflog`, re-commit it
on its own, and confirm both the diff and the message are byte-identical to the
original before calling it restored. The hash does not come back; everything else
does, and only while the reflog still reaches it.

**Every parallel agent is tracked by its artifact.** The plan says which file each
agent writes and what its progress line looks like, and progress is read from that
file. An agent's own announcement is not progress → *An agent that ends, and an agent
that only paused*, below.

### Two coordinating positions on one checkout, and how the plan is what shows it

Everything above guards a coordinator against the agents it sent. **The case it does not
address is two coordinating positions over one repository**, neither dispatched by the other,
each writing a ledger the other is reading. It is not exotic — a user opens a second session
because the first went quiet, or hands the same repository to a colleague's session — and from
inside either one it looks exactly like working alone.

**The plan section is what makes it legible, which is a second thing it buys.** Above, the plan
is written down so the next session can resume and a stalled agent's replacement can inherit its
place. It also carries the names of agents somebody dispatched — so a coordinator reading the
ledger and finding agents it did not send has the collision in front of it. `git log` does not
give that: commits from another position read as 「somebody committed」, which is ordinary. **So
the plan is written even by a session certain it is alone**, because certainty is the state this
is discovered from.

**Whoever notices stops rather than pressing on**, and that is not the obvious move — its own
work is sound and its own agents are finishing normally. Then one position holds it, and the
other stops dispatching. Four things settle the handover, and none of them is answered by the
repository:

| The holder asks | Because |
| --- | --- |
| are your agents finished | a finished agent and a working one leave the same tree; the other position can run its own stop and read *no task found*, and nobody else can |
| what processes do you hold | a server outlives the agent that started it, so a port is regularly held by a process nobody present began → *Judge the overlap*, the restart row |
| **anything you hold that is not on disk, send it now, in one message** | a coordinator's context is the one place in the arrangement guaranteed not to survive, and a second coordinator's context is that place twice. One such message carried five defects that existed nowhere else, including a quotation that no longer matched the resource it quoted |
| nothing — and it is said rather than asked | **the holder cannot close the other session.** Only the person who opened it can, and saying so to them beats leaving a second position quietly alive |

**A stopped peer still announces itself as available, and answering that is how a finished
position goes on costing turns** → *An agent that ends, and an agent that only paused*.

### Judge the overlap before every parallel dispatch — then parallelise

The chapter's `parallelWith` section says the two need nothing from each other's
screens. That clears the *order*; what clears *simultaneity* is a resource judgment,
and it is made per dispatch rather than once for the project.

Walk this list for the two chapters and answer each with a fact, not a forecast:

| Shared thing | Parallel only if |
| --- | --- |
| working tree · git index | separate checkouts, or one agent writes and the other only reads |
| database · seed data | separate databases; a shared one fails silently when one agent's test rewrites the row the other asserts on. **The coordinator is a party to this row**, not just the agents it dispatched — its closing gate run is a full suite against the same database → *Closing a chapter* |
| dev server · port | **each agent runs its own instance on its own port** — or one agent runs it and the rest only drive it, never restarting it |
| the browser profile · the signed-in session | one profile per agent; two agents in one session overwrite each other's account |
| background workers · queues | separate, or owned by one agent |
| file storage · uploads | separate directory per agent |
| the state ledger, the board, shared catalogues | one writer at a time — the second agent reports what it would have written |
| a pile of files one agent deletes and another reads — captures, logs, generated output | **never at once.** The deletion and the read are sequenced, and the coordinator sequences them, because it is the only party holding both instructions |

**Restarting a backend is the collision that bites hardest.** It looks local and is
not: an agent that restarts the server another agent is mid-test on produces a
failure in the other's run that belongs to nobody, and both agents then hunt it in
their own code. So the rule is flat — **an agent restarts only the instance on the slot it
holds.** An agent that finds no port assigned does not guess and does not borrow: it treats
its chapter as sequential work and says so.

**An agent that asks permission to restart has usually already restarted, and the answer arrives
one command too late.** Asking is the right instinct and it is also slow: a message reaches an agent
after its next act, so between 「may I restart?」 and 「no, wait」 the restart has happened. This is not
the agent being careless — it is the same latency that makes stopping the only thing that preempts.

**So the coordinator's answer is never only 「no」.** It says what to do with what already happened:
whether the port is up or down right now, who else was mid-flight, and — the part that decides
whether anything was lost — **that a reading taken across the gap is discarded rather than filed.**
A probe that met a connection refused, or met a server carrying somebody else's half-applied change,
is a measurement whose subject no longer exists; left in a report it reads as a boundary result.

**And the agent that restarted says so at once rather than repairing it quietly.** Restoring the
port is the smaller half; the larger half is that a second agent may have already read the gap. One
run here restarted 8082, was told to hold, killed the server, and reported it in the same message —
which is what let the other agent be told 「the refusal you just saw is not your code」 before it had
finished writing the finding down.

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

**The last row is a different shape from every other one, which is why it is answered 「never」.**
The rest of the table guards two writers; this is an instruction to delete meeting a reader
already inside the files, and it is the coordinator's to cause, because it is the only party
holding both instructions. So the two are **sequenced, never overlapped** — the reader finishes
and says so before the deletion goes out, or the deletion lands and the reader is dispatched
afterwards against what survived.

Two properties make it worse than an ordinary collision, and both are about what is left
afterwards:

- **An ignored directory has no reflog.** Captures, logs and generated output are kept out of
  version control on purpose, so what a deletion takes from one of them is gone in a way a tracked
  file never is — there is nothing to read it back out of.
- **The reader's citations die silently while its findings still read as sound.** An agent whose
  files vanish mid-read does not stop. It reports on what it managed to open and fills the rest
  from whatever it can still reach, and what comes back is fluent, specific and anchored to files
  that no longer exist, with nothing in it saying which half is which.

**And a suspension that races an instruction is not a suspension.** A message sent once the
deletion has been ordered arrives after the deletion has happened; the only thing that reaches an
agent before its next act is stopping it → *An agent that ends, and an agent that only paused*.

> **Read it this way and it is wrong**: 「one of them writes and the other only reads, so they can
> run at once」 — the table's first row, read across. A builder was told to clear superseded
> generations of captures while a judging agent was mid-read on paths inside that pile. The judge
> came back having read five of its eighteen target files as pixels and having filled the rest from
> a later shoot it had to mark as a different generation; the suspension sent afterwards arrived
> after the deletion; and the capture directory being ignored, none of it was recoverable.

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
