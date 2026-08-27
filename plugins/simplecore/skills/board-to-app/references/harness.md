# Instruments that lie, and trees that are shared

Two ways a pass over the screens loses a day to something other than the product: an instrument that
answered plausibly, and a tree that more than one agent was holding.


## What a fixture map's values mean

`files` maps a repository-relative path to what goes in it, and each value is a different
statement:

| | |
| --- | --- |
| a string | the file, with those contents |
| `''` | the file, empty |
| `null` | **the file is not there** |
| a key ending in `/` | an empty directory |

**`null` is what half the cases here need** — a result document that was never written, a capture
that was cited and never made. Written as `''` instead, the case proves a different defect and
passes for the wrong reason, so the natural way to say 「absent」 has to mean absent.

**`undefined` is refused, loudly.** It is what a renamed constant leaves behind, and reading it as
absence would drop a file nobody meant to drop — a case that then proves whatever is left.

## The harness lies, and it lies in the shape of an answer

This work runs on instruments: a screenshot pipeline, a dev server, a checker, a
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
produced a reprimand to the agent who had already fixed it. It was the capture
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
one agent's habits.** A discipline that lives in what somebody happened to do is one
the next agent will not know about.

### In a shared tree, an edit is atomic or it is a red build for everybody

**A call site written before its import compiles for nobody**, and in a tree several agents share
that window is not private: whoever runs a build during it gets a failure naming a file they have
never opened and a symbol they have never used. Three times in one session, from one agent, same
shape — `StatusBadge` and a tone table referenced a few seconds before the import line landed.

**None of them was a break and all three cost somebody the same minutes**: read the failure, doubt
your own work, check whether the file is yours, discover it is not. The third was handled the way
they all should be — reported rather than re-run, with the two files checked as uncommitted rather
than committed broken, and the reporter's own packages typechecked in isolation first to prove the
cause was elsewhere.

- **Write the import and the call site in one edit.** Two writes are two states of the tree and the
  first one is broken.
- **A red build naming a file you have not opened is a race until proved otherwise.** Check whether
  the file is modified-uncommitted before debugging anything; a committed break and somebody's
  half-finished edit look identical in a compiler's output.
- **Report it rather than re-running it away.** A tree that fails for a reason nobody records is
  how a real break gets attributed to a race — and the count is what turned this from noise into a
  shape specific enough to name.

### A script that edits by anchor asserts the anchor is unique

**An edit script's 「ok」 is a claim that it wrote something, never a claim that it wrote it where you
meant.** `replace(old, new)` with a count of one takes the FIRST match, and an anchor like
`      )}\n\n` occurs everywhere in a React screen — so a script that lifts four blocks and
re-inserts them at that anchor lands them somewhere else, reports success, and the blocks it lifted
are simply gone. That happened twice in one session: once to a coordinator whose regex sweep
stripped trailing commas from 694 files, and once to an agent moving three cards out of a screen
that then had none.

**Both were caught by reading the result and neither by the tool.** A diff, a re-read, a count of
what changed — the check is always the same and it is always after the write, because the write is
where the tool stops being able to help.

- **Assert the anchor before writing**: it appears exactly once, or the script stops. A helper that
  asserts and an ad-hoc `replace(…, 1)` look identical in a transcript, and only one of them is safe.
- **Count what you changed against what you meant to change.** 「96 files」 when you named 96 is a
  check; 「694 files」 when you named 96 is the sweep having found a second meaning for your pattern.
- **Read the diff, not the summary.** The summary is written by the thing that got it wrong.

**The danger is proportional to how well the script reads.** A careful helper used carefully all
session builds exactly the confidence that lets an ad-hoc one through unexamined at the end of it.

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

### Both directions proved is not the same as both directions right

**The harness refuses a gate with only one direction proved, and that refusal is what makes the
second failure invisible.** A case set with a hit and a miss reads as complete: the tooling is
satisfied, the count goes up, and nobody looks again. What nothing checks is whether the case
asserts the right answer — and a case written from the same misreading that produced the gate
asserts it confidently in the direction the misreading requires.

It is not hypothetical. A rule enforcing an invariant carried a case saying
`{clash ? <Table/> : <Banner/>}` must be reported, while the invariant it enforced exempted that
exact shape in so many words — 「the other arm of the ternary that draws the table」. Both directions
were proved. The gate then fired on four screens written exactly as the invariant says to write
them, and the only route to a green tree was to break a second invariant.

**So a case set is held against the sentence it claims to enforce, by somebody reading both.**
The check is not 「is there a hit and a miss」 but 「does the hit describe something the rule's own
source forbids」. Where a gate implements a written invariant, quote the invariant's sentence beside
the case that decides the boundary; a case with no such sentence beside it is asserting a boundary
its author invented.

**The tell that this has happened is a gate firing on code somebody wrote carefully.** A finding
whose fix would break a different rule is never a finding — it is the gate disagreeing with the
rulebook, and the rulebook wins until somebody changes it deliberately.

### A value you re-derived is checked against rows nobody changed

Recovering a value the product generated — reproducing a language's random sequence in
another language, recomputing a hash, replaying a formula — produces something that **looks
right on arrival and has no witness**. It goes into rows that are then indistinguishable from
correct ones, and nobody opens them again.

**Run the derivation over rows you are NOT changing first, and compare.** They already hold
the answer, so a mismatch is free and immediate. One re-implementation of a random name
generator was wrong on its first attempt — a signed/unsigned difference in one step — and the
three untouched rows caught it in a second. Without them the wrong names would have been
written and never looked at again.

The same holds for any restore, backfill or migration that computes rather than copies: the
untouched neighbours are the oracle, and they are free.

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
watch stayed quiet across two units of work read it as the agents not having shot
anything; fourteen captures had landed and the watch had never once worked. The
the run survived on agents reporting their own paths, which is the fallback, not
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
- **Failing on an empty scan** catches the scan that quietly stopped matching
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

**The pipe is reached for to protect the context, which is why the rule keeps
breaking.** A gate that takes ten minutes has to run in the background, and its
log is thousands of lines an agent must not read — so `| tail -25` looks like the
careful move rather than the careless one, and it is the exact move that throws
the verdict away. It has now cost an agent a run reported as green that had two
failing tests in it, and the pass was believed because the *last* twenty-five
lines were a passing checker.

Redirect and record the status instead — the log stays on disk, unread, and the
one line that matters is the one written last:

```bash
<gate> > <scratch>/gate.log 2>&1; echo "EXIT=$?" >> <scratch>/gate.log
```

Then `grep` for `EXIT=` and for the failure lines. **Never conclude from the tail
of a log that the run passed**, and never from a background task's own exit code
either: a task wrapping a pipeline reports the *pipeline's* status, which is the
last stage's — `tail` always succeeds.

**A semicolon does what the pipe does, and it wears the rule's own clothes.**
Writing `<gate> > gate.log 2>&1; echo "EXIT=$?"` looks like obeying this section —
the redirect is there, the status is computed — but the status goes to stdout,
which for a background task is *the log nobody reads*, and the exit the harness
then reports is `echo`'s. `echo` always succeeds. The three steps are redirect,
**append the status into the log**, and **grep the log**; doing two of them is
doing none, because what the first two produce is a number nobody looks at. A
coordinator did exactly this and told the user a red gate was green — having
written the `echo` specifically to avoid that mistake. So: `>> gate.log` on the
echo, and a second command that greps. If a report says a gate passed, the words
`EXIT=0` were read out of a file, or the claim is not evidence.

### A path that exists is not a screen anybody has seen

Refusal copy existed in three locales, was reachable in code, passed every check,
and had **never rendered once** — no sample data produced the state it belonged
to. The agent reported it as working because the code path was right.

**If a state needs data to exist, that data is part of the frame.** Empty states,
error states, blocked states and "unavailable" states are exactly the ones no
ordinary fixture produces, and exactly the ones that matter when they are wrong.

The general form: *the code path is not the screen.* Only opening the picture
settles whether a person meets what you intended.

## Sharing one working tree, and one machine

The one-agent-at-a-time rule is in the main document. These are the failures that
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

An agent's session can end for reasons that have nothing to do with the work — a usage
limit, a dropped connection. Three failures follow, and each has cost a session.

**A half-finished tree is read as the existing state.** When an agent dies, read the tree
rather than guessing: commits landed, uncommitted files half-written, a screen reported
finished whose deliverables never appeared. Finish or discard what is half-done **before**
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

**An agent whose output is a judgment leaves nothing when it ends.** One that edits
code leaves its work in the tree, so a report that never arrives costs a look at the
diff and nothing more. One that produces a *judgment* — a contract, an audit, a
comparison, a decision between two designs — has it only in its head until it speaks,
and agents end for reasons that have nothing to do with the work. Dispatch those with
a file to write and tell them to **write as they go**, a section at a time, with a
line at the top saying how far they got.

**So a read-only agent still needs `Write`.** Reaching for a review or auditor
subagent is the right instinct — it cannot edit the tree it is judging — but the ones
that ship with a tool list usually drop `Write` along with `Edit`, and then the agent
has nowhere to put its judgment except a final message that may never arrive.
Read-only means *it does not touch the subject*, not *it produces nothing*. Check the
tool list before dispatching, and give it a scratch file outside the tree it reads.

**When the work has already moved on, a waking agent is more dangerous than a dead one.** A
dead agent does nothing. A woken one resumes from the tree it remembers — which may be
dozens of commits stale — and treats that memory as the current state: it writes files that
have since been split, rebuilds what somebody else already judged, and commits over work it
cannot see. The wake arrives with no warning and its first act may be a write, so a message
telling it to stand down can land after the damage. **The moment a unit of work is handed to
somebody else, stop the agent it was taken from.** Stopping is the only thing that reaches
it before it wakes.

### Two agents on one surface is the coordinator's mistake, never theirs

It happens the same way every time: an agent reports that the API cannot supply what
a frame draws, the coordinator adds that to that agent's brief, and later dispatches a
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

**`--only <directory>` stages what git already tracks and drops what it does not,
in silence.** A new file under that directory is untracked, so a commit naming the
directory does not carry it — the commit lands, the tree is clean-looking, and the
change is half in history. It bites hardest on exactly the work that creates files:
a new module, a package being split out, a reader and its fixture. Measured on one
such change, **five commits imported twenty files that were in none of them**, and
what found it was a gate reading whether an import's target exists in the commit
that added it, not anything a person noticed.

So before every commit by path, **read `git status --short` for `??` under the paths
you are about to name**, and `git add` those first. This is the one case where
adding before committing is right — the file is yours by construction, since it did
not exist until you made it.

**Stage by path, and commit in the same call.** A commit looks at the tree rather
than at the files anybody touched, so stage the paths the brief named and nothing
else, and run `git add <paths> && git commit` in one call, **after** verification
rather than before — the index is shared, so staging early to see what you have
opens a window for somebody else's commit to carry your files under a message that
says nothing about them. Never `git add -A`, never `git add .`, never `git commit -a`.

**Path-level staging runs out when the shared thing is a file rather than a
directory** — a manifest, a config, a barrel that two agents both add a line to.
`git add <that file>` takes their line too, and the moves that look obvious (wait for
them, ask them to commit first, commit both lines) each cost somebody their work or
their authorship. Build the content you want, put *that* in the index, and leave the
working tree alone:

```bash
git show HEAD:<file> > <scratch>/base        # the committed version, without their line
#  … apply only your own change to <scratch>/base …
blob=$(git hash-object -w <scratch>/base)
git update-index --cacheinfo 100644,"$blob",<file>
git commit -m "…"                            # commits the index, not the tree
```

Their edit stays in the working tree, unstaged and untouched, and neither of you
blocks. Learn it before it is needed; by then every obvious move costs somebody
their work.

**An agent that finds foreign changes and decides to skip committing altogether** has
read the situation correctly and reached the wrong answer: its work now survives only
as an uncommitted diff that the next agent, or a stray `git checkout`, can take out
entirely. Stage yours, commit yours, and say in the report what you could not
attribute.

**Measuring must not use commits.** Plant the probe in the working tree, run the
check, delete the probe. Nothing needs to be committed for a rule to fire, and
`reset`, `stash` and `checkout --` have no place in a measurement at all — in a shared
tree they drop somebody else's work while every file stays on disk and every check
stays green.

The mirror of it: **uncommitted work in a shared tree is not private.** It is a
broken build every other agent inherits without being able to see why — a red
typecheck they must reason past before they can trust their own run. Commit at every
point that stands on its own, never once per unit of work.

**Read `git status` for deletions you did not mean, and read it before you believe a
green gate.** Staging is about what you add; the file you destroyed is not in that
list. Writing to a path you did not first read, or renaming onto one, removes whatever
was there — and when what was there is a test file, **the gate goes green because those
tests are not running.** One agent overwrote a 294-line test file that way and its
first full-gate run passed with eighteen tests absent; the count in the gate's own
output was the only witness, and nobody compares counts between runs. A vanished
suite and a passing suite look identical from the outside, which is why this is a
check rather than a caution: `git status` before the gate, and account for every
deletion in it.

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

### A reading that contradicts a report is a clock before it is a defect

Measuring rather than taking an agent's word earns its keep — but a file read one
commit behind the agent who just fixed it yields line numbers for a defect already
gone, with both sides right. So before returning anything a report contradicts, **look
for the hashes it named** (an agent puts one on every claim of a change): absent is
work that has not landed, present is a reading taken in front of it. Then argue what
the file says, never where it says it — a fix that adds a line moves every number
under it.

**Take the reading out of a commit, never off the working tree.**

```bash
git show HEAD:<path> | grep <what you are checking for>   # or the hash the report named
```

While an agent is in the tree, the tree is not any moment at all. Proving a new rule
means planting the defect back into the file and taking it out again — in the working
tree and never in a commit — so a `grep` that lands in that window reads a file
mid-repair and reports finished work as missing. One session paid for exactly that
twice, both times as "it did not go in, I measured it", and both times the agent
answered with a `git show` of a hash its report had already named. A commit holds
still; disk does not.
