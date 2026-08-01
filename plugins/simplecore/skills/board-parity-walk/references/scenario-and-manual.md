# One story feeds the sample data, the captures, and the manual

A board tells you what each screen holds. It does not tell you *whose* front gate
is on the list, or how many people are behind the number, or what happened before
this screen. Left to each frame, those get invented at the screen — and the
moment they are, the front gate on the list and the front gate on the detail page
quietly become different machines. Nothing fails; the two just disagree.

So one document carries the story: from an empty device to a site in operation,
as numbered steps, each step naming the frames it feeds. **Sample data is derived
from it, captures are taken against it, and the manual is written along it.**

## What the user decides, and must never be decided for them

**The shape of the manual is a product decision, not a walker's.** Get these
answered before the first page is written, and go back to the user when the
answer stops fitting. A book written to the wrong assumption is not corrected by
editing pages — it is rewritten.

| Question | Why it cannot be inferred |
| --- | --- |
| **Who reads it** — an operator on site, an administrator, an end user, an installer | The audience sets the vocabulary, what may be assumed, and which screens even belong in it. A book for the person at the door and a book for the person configuring the system share almost no pages. |
| **Which languages get a book** | Ship languages and manual languages are different lists. Copy is translated cheaply; a manual is written by a person. Assuming every ship language owes a book commits somebody to writing them. |
| **Whether a page is one screen or one step of the story** | This is the biggest one, and the default is usually wrong. See below. |
| **When the shipped figures are taken** | Per frame as you go, or once at the end from a finished product. Both are defensible and they cost differently. |
| **Which devices and which theme the figures show** | A book with mixed devices or mixed themes reads as unfinished, and nobody notices while writing it one page at a time. |

Ask them together, early, with a recommendation — not one at a time as each
becomes blocking.

## A page is a step, not a screen

The tempting structure is one page per screen, because the frames are already a
list. It produces a reference nobody can follow: the reader meets screens in an
order nothing chose, and a task that spans four screens is split across four
pages that each assume the others.

**A page is a step of the story, and every frame that step feeds sits on it.**
Section letters and frame ids are the board's organisation, not the reader's.

Two consequences worth stating plainly, because they are what makes this
expensive if ignored:

- **A new frame usually lands in a step that is already written.** Adding a page
  at the end and leaving the earlier ones alone makes the book contradict itself,
  and the contradiction is invisible until somebody reads two pages side by side.
  **Update the step you touched, in the same change.**
- **Write the prose immediately; the figures can wait.** Text costs nothing to
  keep current and everything to reconstruct later — reconstructing it needs the
  memory of the person who built the screen, and that memory does not survive the
  session. Images are the opposite: every shared-component change ages every kept
  image, so a project may reasonably defer them to one final pass. **Defer the
  pictures if you must; never defer the words.**

When figures are deferred, the manual page still carries **the place** — the path
the image will occupy and the width it will have. That declaration is what says
"this screen, in this state, from this data", and it is what the final capture
run reads.

## Check it mechanically, because prose hides its own gaps

A manual is the artefact most likely to drift and least likely to be re-read. The
checks that pay for themselves:

- every walked frame appears on exactly one page, and every page names frames that
  exist;
- every frame has a step in the story — a frame with no step is one whose data was
  invented beside the screen;
- every declared figure has a file, at the declared path, for each book;
- the audience declared by a page matches the audience of the frames on it — a
  page written for the wrong reader is invisible to every other check.

## Keep the story honest as the product grows

The story is not an appendix. When a frame changes what came before it — a screen
that registers people changes where the existing people came from — **fix the
earlier step there and then.** A checker can see that a frame has a step; it
cannot see that the steps still add up.

# Progress, logs, and what a walk costs

## One line per step, written as it happens

Each walker appends to its own log, one line per step **as the step finishes** —
not a summary when the cluster ends, which answers the question too late.

```
21:40 A-08 START   build the site list
21:52 A-08 BUILT   list, empty state, current-site marker
21:58 A-08 JUDGED  both locales, phone and tablet — switcher unreachable on tablet
22:04 A-08 SHOT    4 captures
22:09 A-08 DONE    both books written, line deleted from the list
```

One word of status, one clause of what. No reasoning, no screen copy, no image
paths — those belong in the report.

**A frame takes something like half an hour, so one line per frame is a pulse
every thirty minutes, and from outside a slow pulse is indistinguishable from
none.** That is the whole reason the line is written per step rather than per
frame.

**Note a step that took far longer than its neighbours, in the line.** Nobody
outside is timing anything, so a step that is twenty times more expensive than it
should be stays that way indefinitely — one capture took twenty-five seconds for
days before anyone said so.

## The coordinator watches, and re-arms

Arm two watches **in the same turn the walker is dispatched**: the log directory
filtered to the step words, and the capture directory for new files. Both cost
the coordinator almost nothing, because only paths come back.

**A watch that stops is re-armed immediately.** Watches die quietly — a timeout,
a killed process, a resumed session — and **a dead watch looks exactly like a
live one, because both produce nothing.** It is the same trap as a check that
stopped checking, and it fails in the same direction: silence reads as calm.

So never take silence as reassurance. When events stop while a cluster is
running, suspect the watch before the walker. Re-arm without asking after a
handover, a timeout, or a process death.

## Record what it cost, or the number is gone

Duration, tokens, commits, lines, file sizes — none of it can be reconstructed
afterwards, and all of it is asked for eventually ("how long did this take?",
"was the rewrite worth it?"). A walk that spans weeks and several sessions is
exactly the case where nobody remembers.

Append the cheap facts as you go, in a machine-readable file the walk owns:
per cluster, the wall-clock span and whatever the runtime can tell you about
consumption. Derive the rest from git when it is asked for, rather than
maintaining it — commits, lines changed and file counts are already recorded
there. **What git cannot recover is time and consumption**, so those are the two
worth writing down at the moment they are known.
