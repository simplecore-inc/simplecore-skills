# Instruments that lie, and trees that are shared

Two ways a walk loses a day to something other than the product: an instrument that
answered plausibly, and a tree that more than one agent was holding.

## The harness lies, and it lies in the shape of an answer

A walk runs on instruments: a screenshot pipeline, a dev server, a checker, a
gate. Each one turns the running product into something a person can judge. When
one of them is wrong it does not go quiet — **it returns a plausible answer**, and
plausible answers get acted on.

Everything below is the same failure wearing different clothes: *something
measured the harness and reported it as a fact about the product.*

### A measurement of the product is a measurement of the instrument too

Before sending anybody to fix what a number says, ask what else that number could
be measuring.

A gate reported one screen as several times longer than it is, and gave a different
answer on each run of unchanged code. Read as a screen that would not stay fixed, it
produced a reprimand to the walker who had already fixed it. It was the capture
pipeline: a reloaded bundle redrew part of the screen a second time, so the picture
grew while the screen did not. Four of five findings from that gate were the
instrument rather than the product.

**A length read off a picture is the harness's number, not the screen's** — the
viewport decides it, the bundle can inflate it, and the device changes it. Judge a
screen by looking at it, and leave measurement to what can actually be measured.

The tells, none of which require knowing the cause:

- **The same input gives different outputs.** Run it twice. If two runs of
  unchanged code disagree, nothing downstream of that number is knowable yet.
- **A number moves back on its own.** Improvement that reverses without a change
  is not improvement reversing; it is noise you were reading as signal.
- **The magnitude is implausible.** Surprise is a reason to check the instrument
  before reporting the finding.

**Fix the instrument first, then re-measure, then act.** A gate whose readings
cannot be reproduced must not send anybody anywhere — a checker that sends someone
to fix a non-problem is worse than no checker, because they will do it.

When a fix makes the instrument deterministic, **put it in the tool, not in a
walker's habits.** A discipline that lives in what somebody happened to do is one
the next agent will not know about.

### A guard that never fires is not proof of anything

A capture guard was written to catch pictures whose screen moved mid-shot. It
never threw. That was read as the captures being clean; it was the guard
measuring the wrong thing — it re-navigated to the screen before comparing, so its
comparison passed no matter what had happened.

**Silence from a check means one of two things and you cannot tell which by
looking at it.** Prove it in both directions before trusting it:

1. **It fires on the defect.** Reproduce the defect deliberately and watch it
   fail. If you cannot provoke it cheaply, say so — do not report the quiet half
   as the whole.
2. **It is silent on the fix**, and on healthy code elsewhere.

A rule that ships unproven is worse than none: it converts *nobody has checked*
into *something is checking*, and the second is much harder to doubt.

### A watch is a check, and the same proof is owed

The rule above is about checkers. It holds unchanged for the **watches a
coordinator arms** — the log tail, the capture directory — and that is exactly
where it gets skipped, because a watch emits nothing while the work is quiet and
nothing while it is broken. From outside those are the same observation.

**Arm it, then make it fire.** Drop one file, append one line, confirm the event
arrives — then confirm it goes quiet when nothing happens. Both halves, one
command each. That is the only thing separating *nobody is capturing* from
*nobody is watching*.

So read silence as suspect rather than as reassurance. A coordinator whose capture
watch stayed quiet across two clusters read it as the walkers not having shot
anything; fourteen captures had landed and the watch had never once worked. The
walk survived on the walkers reporting their own paths, which is the fallback, not
the mechanism — the watch existed to get those pictures to a person *while the
screen was still the subject*.

**The failure was the quiet kind.** The watch matched new files by relative time
(`find … -newermt '-70 seconds'`), and BSD `find` on macOS does not read relative
strings the way GNU does. It does not error; it returns an empty answer — which is
byte for byte what a working watch returns on a quiet minute. Prefer a form with
no date parsing in it at all: list the directory and emit the difference from the
previous list.

**Run the watch's own query by hand over two windows of different widths.** That
is the measurement that exposes this class, and it is cheap. Here the relative
form found ten files across six hours while an absolute cutoff found fifteen
across the last fifty minutes — and a window enclosed by another cannot hold more
than it, so the number was not counting time at all.

### Scope a rule to the defect, not to where the defect happened to be

A checker written against the two files that had the bug is a checker for a bug
that is already fixed. Two versions of this in one session: a fingerprint check
that covered three of eleven cases and reported success, and a rule listing the
two source files where a bad call had been found.

- **Sweep the whole tree**, then report the count. Zero costs nothing and proves
  coverage; non-zero is the rule earning itself immediately.
- **A hardcoded list of the current repository's paths is the thing to avoid** —
  the same rule as anywhere else, and it applies inside a test as much as a
  library.
- **Give it an escape that a reader can see and question** — a marker at the call
  site, not an omission from a list at the top of the file nobody re-reads.
- **Failing on an empty scan** catches the walk that quietly stopped matching
  anything.

### Some rules are correctly rejected, and the rejection is worth as much

Two candidate rules were written and closed the same day: one fired on four
healthy pages, another could not read exclusive branches and would have called a
working screen broken.

The project's discipline is that a finding becomes a refactor **or** a checker —
not that everything becomes a checker. **Write the rejected ones down, with the
reason.** Otherwise the next agent rediscovers the same tempting rule and ships
it, and now a gate is wrong.

### Never let a gate's output be filtered

A manual check had been failing for hours while reading green: the command was
piped through `tail`, which discards the exit code and showed only the last lines.

Read the status, not the tail. A gate whose failure can scroll off the screen is
a gate nobody is running.

### A path that exists is not a screen anybody has seen

Refusal copy existed in three locales, was reachable in code, passed every check,
and had **never rendered once** — no sample data produced the state it belonged
to. The walker reported it as working because the code path was right.

**If a state needs data to exist, that data is part of the frame.** Empty states,
error states, blocked states and "unavailable" states are exactly the ones no
ordinary fixture produces, and exactly the ones that matter when they are wrong.

The general form: *the code path is not the screen.* Only opening the picture
settles whether a person meets what you intended.

## Sharing one working tree, and one machine

The one-walker-at-a-time rule is in the main document. These are the failures that
follow when it is bent, all of which cost real work in a single session.

### A shared resource arbitrates itself — a coordinator holding the queue is the bug

Two agents driving one simulator, browser, or device produce **captures of the
wrong screen that look entirely correct** — a real screen, properly drawn, at the
right path, under the right name. One came back showing another section's dialog,
because the other agent had opened it between the deep link and the shutter.
Nothing in the image says it is wrong. So the resource genuinely must be used by
one agent at a time.

**The test database is one of these, and it lies in a worse way.** Two suites
running at once collide over rows and report a unique-key violation on an email —
which reads as a defect in the code under test, not as two runs in one place. A
wrong capture at least looks like a screen; this looks like a bug, and whoever
receives it starts reading the wrong file. It cost half an hour of reading a
migration that was fine. The same lock applies, and the same rule about clearing a
stale one: **before measuring anything against a shared database, check whether a
run is already in it.**

**The obvious answer is for the coordinator to hand it out, and that answer is
wrong.** It was tried for a full session and failed four times: every run becomes a
message round trip, and a message that crosses or is dropped leaves an agent
sitting on a permission it already had. The longest stall was half an hour, and it
is invisible from both ends — the agent believes it is waiting, the coordinator
believes it is working. Standing reservations do not fix it either, because a
coordinator with two agents ends up relaying one agent's permission to the other's
sub-agent, and that is one more hop to lose it on.

**Put the arbitration in the tool that uses the resource.** The script takes a lock
file on start, atomically; a second run stops and names who holds it. Nobody asks,
so nobody can be left waiting for an answer that was already sent.

Three things that make such a lock trustworthy rather than another trap:

- **A stale lock is cleared, not honoured.** A run killed mid-flight leaves its file
  behind, and a lock nobody holds must never become permanent — that replaces a
  collision with a deadlock, which is worse because it looks like the rule working.
  Record the pid and check whether it is alive.
- **Refuse loudly and say who holds it**, with what they are doing. "Resource busy"
  sends somebody hunting; "pid 54742, frames A-01" ends the question.
- **Prove both directions before trusting it**, like any other check: refuse against
  a live holder, clear a stale one and carry on. A lock that has never refused is
  indistinguishable from one that cannot.

**Checking `ps` is not a substitute for a lock.** Two runs can both be between steps
at the same instant, and the check reads clear.

A resource the machine cannot arbitrate — a physical handset somebody is holding,
a shared account, a lab device — still goes through a person. The rule is not "never
coordinate"; it is that **anything a lock can arbitrate should not be arbitrated by
messages**, because the messages are the part that fails.

### An agent that ends, and an agent that only paused

A walker's session can end for reasons that have nothing to do with the work — a usage
limit, a dropped connection. Three failures follow, and each has cost a session.

**A half-finished tree is read as the existing state.** When an agent dies, read the tree
rather than guessing: commits landed, uncommitted files half-written, a frame deleted from
the list whose deliverables never appeared. Finish or discard what is half-done **before**
dispatching the next agent into it; a successor inheriting a half-migration treats it as
what was there all along and builds on it.

**A pause looks exactly like a death.** A usage limit suspends every agent at once and
resumes them when it lifts, so an agent reported as failed can be mid-sentence rather than
gone — and dispatching a replacement puts two agents on one job. They will not notice each
other: both read the same tree, both stage, and the first `git add` folds the other's staged
files into a commit neither of them meant to make. So before replacing an agent that ended
for an outside reason, check whether the work is still moving — the last commit's timestamp,
the file it was writing, its log. If it is, wait; that agent still holds everything it had
worked out, and a replacement starts from nothing. If a replacement is already running when
the original wakes, stop the replacement rather than the one with the context.

**When the work has already moved on, a waking agent is more dangerous than a dead one.** A
dead agent does nothing. A woken one resumes from the tree it remembers — which may be
dozens of commits stale — and treats that memory as the current state: it writes files that
have since been split, rebuilds what somebody else already judged, and commits over work it
cannot see. The wake arrives with no warning and its first act may be a write, so a message
telling it to stand down can land after the damage. **The moment a cluster is handed to
somebody else, stop the agent it was taken from.** Stopping is the only thing that reaches
it before it wakes.

### Two agents on one surface is the coordinator's mistake, never theirs

It happens the same way every time: a walker reports that the API cannot supply what
a frame draws, the coordinator adds that to the walker's brief, and later dispatches a
server agent for the same area — having forgotten that the first brief reached into it.
Nobody involved did anything wrong.

The guard is to say, in every brief, **which paths belong to this agent** and that
everything else is somebody's. Write it as two columns — mine, and not mine, each named
— rather than as a scope stated only in the positive: a brief that says what an agent
owns and stays silent about the rest reads, to the agent, as permission for anything
adjacent. An agent that then finds foreign edits knows immediately that it is looking at
a collision rather than at its own earlier work.

Ask each one to **stand down and report** rather than to resolve it. They cannot see each
other, and the one who stands down is the one whose scope was wrong — which only the
coordinator knows. An agent that finds another working the same tree stands down and says
so without touching the index; that is the correct answer, and the coordinator's job is to
make it unnecessary.

### The overlap that hides best is not a file — it is a deliverable

Two briefs can name disjoint paths and still ask for the same thing: a checker for the
same rule, a helper for the same convention, a fixture for the same screen. Neither agent
can see the duplicate, because what they were told to build is not something the tree
shows until it exists. It surfaces as two implementations of one idea, or as one agent's
work vanishing into the other's commit — and by then both are finished and sure.

So before dispatching, read the new brief against every running one and ask what each is
asked to **produce**, not only what it may touch. Where two would build the same artefact,
name its owner in both briefs — the one who builds it, and the one who waits for it and is
told where it will appear.

### Stage your own paths, never everything

A broad `git add` sweeps up another agent's staged-but-uncommitted work. Nothing
is lost and the history becomes false: one agent's copy changes recorded inside
another's commit about something unrelated, and somebody has to unpick their own
hunks out of shared files.

Stage explicit paths. Check what is dirty before committing, and leave alone what
you did not touch.

**Path-level staging runs out when a file itself is shared** — a manifest, a
config, a barrel that two agents both add a line to. Staging your own line without
taking theirs is a blob written straight into the index, and the commands are in
`references/walking-a-cluster.md` § Commit at every point that stands on its own.
Learn it before it is needed; by then every obvious move costs somebody their work.

The mirror of it: **uncommitted work in a shared tree is not private.** It is a
broken build every other agent inherits without being able to see why — a red
typecheck they must reason past before they can trust their own run. Commit at every
point that stands on its own, never once per cluster.

### Say what you cannot attribute — and do not read attribution off a commit

With more than one agent in a tree, a gate can be red for somebody else's reason.
An agent that reports "gates green" after only running the ones it could attribute
is telling the truth; one that reports green because it did not look is not.

Name the failures you could not attribute and whose you think they are. The
coordinator is the only one who can see all of them at once.

**The same holds for authorship, because the index is shared.** One agent stages by
path and another commits in the gap, and the second author's name goes on both. Do not
read `git show --stat` as attribution, and do not assign follow-up work from it — ask
the agents. Getting this wrong sends the next brief to the wrong one, which is how a
collision outlives the collision.
