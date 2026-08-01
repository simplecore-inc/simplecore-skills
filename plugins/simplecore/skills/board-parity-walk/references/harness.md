# The harness lies, and it lies in the shape of an answer

A walk runs on instruments: a screenshot pipeline, a dev server, a checker, a
gate. Each one turns the running product into something a person can judge. When
one of them is wrong it does not go quiet — **it returns a plausible answer**, and
plausible answers get acted on.

Everything below is the same failure wearing different clothes: *something
measured the harness and reported it as a fact about the product.*

## A measurement of the product is a measurement of the instrument too

Before sending anybody to fix what a number says, ask what else that number could
be measuring.

A screen was reported at nineteen screenfuls, then seven, then three, across runs
of unchanged code. Read as a screen that would not stay fixed, it produced a
reprimand to the walker who had already fixed it. It was the capture pipeline:
a reloaded bundle redrew the top of the screen into the lower bands, so the image
grew while the screen did not. Four of five findings from that gate were the
instrument, including one screen reported at eight screenfuls that was one.

The tells, none of which require knowing the cause:

- **The same input gives different outputs.** Run it twice. If two runs of
  unchanged code disagree, nothing downstream of that number is knowable yet.
- **A number moves back on its own.** Improvement that reverses without a change
  is not improvement reversing; it is noise you were reading as signal.
- **The magnitude is implausible.** A summary screen is not nineteen screenfuls.
  Surprise is a reason to check the instrument before reporting the finding.

**Fix the instrument first, then re-measure, then act.** A gate whose readings
cannot be reproduced must not send anybody anywhere — a checker that sends someone
to fix a non-problem is worse than no checker, because they will do it.

When a fix makes the instrument deterministic, **put it in the tool, not in a
walker's habits.** A discipline that lives in what somebody happened to do is one
the next agent will not know about.

## A guard that never fires is not proof of anything

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

## Scope a rule to the defect, not to where the defect happened to be

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

## Some rules are correctly rejected, and the rejection is worth as much

Two candidate rules were written and closed the same day: one fired on four
healthy pages, another could not read exclusive branches and would have called a
working screen broken.

The project's discipline is that a finding becomes a refactor **or** a checker —
not that everything becomes a checker. **Write the rejected ones down, with the
reason.** Otherwise the next agent rediscovers the same tempting rule and ships
it, and now a gate is wrong.

## Never let a gate's output be filtered

A manual check had been failing for hours while reading green: the command was
piped through `tail`, which discards the exit code and showed only the last lines.

Read the status, not the tail. A gate whose failure can scroll off the screen is
a gate nobody is running.

## A path that exists is not a screen anybody has seen

Refusal copy existed in three locales, was reachable in code, passed every check,
and had **never rendered once** — no sample data produced the state it belonged
to. The walker reported it as working because the code path was right.

**If a state needs data to exist, that data is part of the frame.** Empty states,
error states, blocked states and "unavailable" states are exactly the ones no
ordinary fixture produces, and exactly the ones that matter when they are wrong.

The general form: *the code path is not the screen.* Only opening the picture
settles whether a person meets what you intended.

# Sharing one working tree, and one machine

The one-walker-at-a-time rule is in the main document. These are the failures that
follow when it is bent, all of which cost real work in a single session.

## A shared physical resource is serialised through the coordinator

Two agents driving one simulator, browser, or device produce **captures of the
wrong screen that look entirely correct** — a real screen, properly drawn, at the
right path, under the right name. One came back with another section's dialog
stitched into five of its six bands. Nothing in the image says it is wrong.

So the coordinator holds the queue, and hands the device to one agent at a time.
Two corollaries, both learned the hard way:

- **Checking `ps` is not a substitute.** Two runs can both be between steps at the
  same instant, and the check reads clear.
- **Release it explicitly and confirm the release landed.** Twice in one session a
  walker sat blocked for an hour on a queue that had already been released, because
  the message did not arrive. When one agent is alone in the tree, give it a
  standing reservation instead of a per-run handshake, and tell it to carry on
  rather than wait if an answer does not come.

## Stage your own paths, never everything

A broad `git add` sweeps up another agent's staged-but-uncommitted work. Nothing
is lost and the history becomes false: one agent's copy changes recorded inside
another's commit about something unrelated, and somebody has to unpick their own
hunks out of shared files.

Stage explicit paths. Check what is dirty before committing, and leave alone what
you did not touch.

The mirror of it: **uncommitted work in a shared tree is not private.** It is a
broken build every other agent inherits without being able to see why — a red
typecheck they must reason past before they can trust their own run. Commit and
push per frame, not per cluster.

## Say what you cannot attribute

With more than one agent in a tree, a gate can be red for somebody else's reason.
An agent that reports "gates green" after only running the ones it could attribute
is telling the truth; one that reports green because it did not look is not.

Name the failures you could not attribute and whose you think they are. The
coordinator is the only one who can see all of them at once.
