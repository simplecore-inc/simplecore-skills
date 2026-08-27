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

### A claim about WHO did something is the one claim with nothing to check it against

**Every other claim in a wave can be verified before it is sent.** Counts, findings, whether a file
is clean, whether a gate fires — each is a command away, and that is why the checks catch things.
**「Which agent did this」 is not**: the repository cannot answer it. Every agent commits as the same
author, `git blame` names the human on every line, and the trailers carry a chapter rather than a
hand. The only record is who said so in a message.

**So a misread message is the whole distance between a fact and its opposite, with nothing standing
in the way.** One agent read 「the gate moved twice UNDER me」 as 「BY me」, turned the reporter into
the author, and asserted it back to them — with their 「I never touched that file」 in the same
paragraph. Of everything that agent claimed that day it was the only claim it could not have
checked, and the only one it got wrong.

- **State it as attribution, not as fact.** 「Your message named `abc1234`」 is true and checkable;
  「your `abc1234`」 is a claim about a hand and it is a guess. The phrasing costs nothing and is the
  whole fix.
- **A correction about authorship goes to both parties**, because the one who was misnamed cannot
  see the message that misnamed them.
- **Where a project wants it answerable, that is a trailer naming the agent** — a decision for
  whoever owns the commit conventions, not for a wave to adopt on its own.

### A path list you generated is a directory in disguise, and the list gets long exactly when you stop reading it

**「Stage by explicit path」 is two disciplines and only one of them survives a long list.** The first
is checking the tree is clean before staging, which is what finds a collision. The second is
**naming the paths**, and it is the one that goes: the moment the list is inconvenient to type,
somebody builds it from `git status --porcelain -- <dir>` and passes that to `--only`. That is a
directory query wearing a list's clothes, and `--only` then takes each named file's whole working
tree, including whatever arrived while the work was being done.

It happened to an agent who had avoided the same collision three times that day by checking. **The
check was not what failed** — it had been running all along. What failed was reading the list, on
the twenty-fifth file of a change where the first twenty-four had made typing them feel like
ceremony.

- **Type the paths, or derive them from what you edited rather than from what is dirty.** A list
  built from the tree's state answers 「what changed here」; the question is 「what did I change」.
- **The signal is the list becoming tedious.** That is when the shortcut arrives, and it arrives
  looking like the rule being followed.
- **`git diff -- <file>` on each one before committing** is what turns the remaining case into a
  message rather than a sweep.

### Git cannot tell two agents apart, so a commit that carried somebody's work says so or nothing does

**Every agent in a wave commits as the same author.** The trailers name a chapter, not a hand — so
`git log` can say what changed and when, and never who. **That is fine until a commit carries work
that arrived in one of its files while it was being written**, and then the history is not merely
silent: it is wrong, and confidently.

There is no way to correct it in place. A reset or an amend takes whatever landed on top, which in
a shared tree is somebody else's commit — so the record has to be made **forward**:

- **A commit that says what it carried, named as its own change.** What rode in, what it does, and
  who caused it. That is a fact on disk, which a message between two agents is not.
- **And a message to the agent whose work it was**, because they are the only one who can say
  whether the content is right — the commit's author saw a diff and thought it correct, which is a
  weaker claim than it looks.
- **Never a reset to tidy it.** The instruction against rewriting exists for exactly this tree, and
  the receiving agent reporting the sweep rather than fixing it is the behaviour to expect.

**The temptation is to leave it**, because nothing is lost and the code is right. What is lost is
the next reader's ability to ask why a rule changed, of the person who changed it.

### In a shared tree, an edit is atomic or it is a red build for everybody

**A call site written before its import compiles for nobody**, and in a tree several agents share
that window is not private: whoever runs a build during it gets a failure naming a file they have
never opened and a symbol they have never used. Four times in one session, from three different agents, the same
shape — a component or a tone table referenced a few seconds before its import line landed. **The
third peer is what settles it**: this is not one agent's habit, it is what an arrangement of several
agents editing one tree produces, and the count is the only thing that could have told the two
apart.

**None of them was a break and every one cost somebody the same minutes**: read the failure, doubt
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

### A check that nothing was lost is not a check that the right thing moved

**The two are different claims and only one of them is easy.** Comparing a file's sorted lines
before and after proves a bulk move was lossless — nothing dropped, nothing rewritten. It says
nothing about whether the lines went where they were meant to, and a move that puts a card in the
wrong region passes it cleanly.

An agent writing a JSX splitter for a 27-page reordering fixed it three times: indentation cut a
child at the `)}` closing it, a tag stack fixed that and then a `trailing={<Thing />}` prop closed
the outer tag on the inner one's `/>`, and fixing that made a `=>` inside a prop read as the end of
the element. **Each fix passed the file it was tested on and broke a different one.** They stopped,
and moved line ranges they had read themselves.

- **A tool you cannot trust is worse than the hand edits it saves**, because its output looks like
  the same work done faster.
- **The third fix always feels like the last one.** That is the moment to count how many there have
  been rather than to make another.
- **Say which claim your check makes.** 「Purity verified」 reads as 「correct」 and is not.

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

### A specimen weakens when somebody opens it, and that is the direction to expect

**A case described from a distance is always stronger than the code.** 「A `.map` painting several
cards whose kinds differ」 became an IIFE returning one card with a four-way kind; the replacement
specimen became one producer with a hardcoded kind. Three descriptions, each weaker than the last,
each corrected by whoever opened the file — **and none of the corrections went the other way.**

That asymmetry is the rule. A description is built from what the reader expected to find, so it
carries the shape the rule wants; the file carries only what somebody wrote. **So a specimen cited
without being opened is an argument, and a rule justified by one is justified by nothing.**

- **Cite the file and the line, and open it before repeating it.** Repeating somebody's description
  as a fact about the code is the same failure as claiming who wrote a commit.
- **When the strongest case for a rule keeps shrinking, the rule may be answering a shape the
  product does not have.** That is worth knowing before more is built on it.
- **A rule whose only justification is an unexercised case is still allowed** — but say so, and say
  which real case does justify it. A structural argument, one the other instrument cannot have at
  all, is worth more than a vivid case nobody has met.

### A fixture written from the rule cannot test the rule's contact with the product

**A rule has a boundary the fixtures never touch if the fixtures were written from the rule.** One
check had to decide what counts as a region — too wide and it asks a form's three sections to be
reordered, too narrow and it finds nothing at all, because the component wraps each card in a box of
its own to scroll a restored one into view. **Every fixture passed either way**, and 「compared 0」 on
a four-card page reads exactly like a clean one.

They passed because they were written flat, from the rule's statement rather than from what the
product actually renders. The rule was correct in the abstract and had never met the product.

- **Write at least one fixture from a real screen's shape**, wrappers and all, not from the sentence
  the rule states. It is the only one that can fail for the right reason.
- **When a boundary has two ways to be wrong, one of them is usually silent.** Too wide is loud and
  gets fixed; too narrow reports zero and gets believed.
- **A `compared` count is what separates them**, and only if somebody reads it against what they
  expected the page to hold.

### A check that inverts certifies the defect

**A rule that has been reversed is not merely wrong; it vouches for the broken state.** It reports
every page that obeys the new rule and stays silent on every page that breaks it — so the tree reads
as covered, the count reads as progress, and the pages somebody has to fix are the ones it calls
clean. **A check nobody wrote is safer than a check pointing the other way**, because the first
leaves the question open and the second answers it wrongly with authority.

So a rule change is a change to every instrument that asserts it, in the same breath:

- **Turn the check round with the rule, and rewrite its fixtures.** A fixture set that still passes
  after the rule inverted is a fixture set proving the old rule under the new rule's name.
- **The exemptions usually survive and the assertion does not.** A tab pane's cards, a panel's, a
  table's cells — those are about what a region is, and a reversal of the order does not touch them.
- **Say which instruments assert the rule before changing it.** Two source gates and a rendered
  check asserted this one, and only one of them was inverted on the day the rule turned round.

### Reading the diff is a point in time, and the write is after it

**「Name the path, read `git diff`, then commit」 is the discipline and it does not cover the window
it opens.** The diff you read was true when you read it; a peer's write lands between the reading
and the commit, and the file goes in whole. It happened twice in one session between two agents,
once in each direction, and **both times every rule was followed.**

It cannot be closed by reading harder. What is left is to make the window small and the record
honest:

- **Read and commit as one motion**, with nothing between them — no second verification pass, no
  re-run of a gate, no message written in between.
- **When it happens, record it forward and tell the other agent.** Neither of them can correct it in
  place, and the commit that swept it is the only place the fact can live.
- **Expect it rather than resolving to avoid it.** Several sessions writing to one tree makes this
  a rate, not a mistake.

### A long sweep does not measure a tree; it measures a smear of trees

**A run that takes twenty minutes across a tree several agents are writing to reads its last route
against a different codebase from its first.** The number it prints is right about what it read and
wrong about what exists, and **nothing in the output says which** — the findings look identical
whether the file still says that or was fixed while the sweep was passing another route.

It is the intermediate-state reading at a different scale. A gate reading a file mid-edit produces a
true finding about a state that lived for a minute; a sweep produces a page of them about states
that lived for a run. **The scale is what makes it dangerous**: one is obviously suspect and the
other arrives as a report.

- **Record the commit the sweep started from**, in the output rather than in somebody's memory.
- **Re-measure anything it finds before acting on it**, and re-measure the whole thing before
  quoting its count as the state.
- **This applies to every long reading, not only to checks** — a capture run, a persona walk, an
  audit across a hundred screens. Whatever the run is doing, it is doing it to a tree that moved
  underneath it.
- **The reading is still worth having.** What it is not is current, and saying which commit it is
  current for costs one line.

### An agent that stops without reporting is indistinguishable from one that found nothing

**A wave's idle notice says an agent stopped; it never says whether it finished.** Three judges in
one round went idle having returned nothing, and each time the coordinator had to ask — because a
missing report and a clean report look identical from where the work is dispatched. **The chapter
simply stands still**, and nothing about that state announces itself.

- **Ask rather than wait, and ask for the partial.** 「Which captures did you open, what did you
  find, what had you not reached」 recovers a report that was nearly complete; waiting recovers
  nothing.
- **Say in the brief that being stopped is a reportable outcome.** 「I could not open that file」 is
  an answer; a briefed agent that believes only findings are worth sending will send nothing when
  it has none.
- **Re-send the brief with the ask.** A long run pushes the original out of the agent's context, so
  the agent that went quiet may no longer know what it was to return.
- **This is the same failure the round is usually about, one level up**: an unexercised demand and a
  passed one leave the same mark, and so do an unfinished agent and a finished one.

### A check's silence covers what it reached, and what it reached is how it was run

**A rule can be correct, exempt nothing it should not, and still say nothing about half its
subject** — because the run never met that half. A sweep that loads each route bare never mounts a
detail panel, so the cards inside one were not exempted; they were **never seen**. The output is
identical either way and reads as a verdict.

**So a check reports what it compared, and whoever reads it says what that number covers.** 「86
messages compared, 3 findings」 is a result; 「3 findings」 is an assertion about a population nobody
named. When somebody asks whether a class of thing is clean, the honest answer is often 「my run did
not reach it」, and saying so is worth more than the three findings.

- **Name the population in the same breath as the count.** Bare routes, no row selected, signed in
  as one account, one viewport — each of those is a boundary of the claim.
- **The account is the axis that gets left out, and it is the one a source rule does not have.** A
  rule reading files reads every screen regardless of who could open one; a rendered check reads
  what its persona is allowed to see, and a route the persona is refused returns a permission panel
  that reports 「reached nothing」. A sweep run as one role reported 「all sixteen closed」 and 「the
  two instruments agree」 — true over what that role could open, and the routes it could not were
  exactly where the source rule's last findings were. **Sweep for refusals first, then re-run as
  whatever role each refusal names.**
- **A finding you cannot see is not a finding you cleared.** Adding an exclusion for a shape the run
  never met changes nothing today and is still right, because it is correct for the day somebody
  drives that shape open.
- **Never let another agent read your silence as coverage.** The one who asked was about to act on
  a list that could not contain what they were asking about.

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
