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

## Record what a cluster cost, or the number is gone

The log format and the watches the coordinator arms on it are in the main document; what
that log does not carry is the price. Duration, tokens, commits, lines, file sizes — none
of it can be reconstructed afterwards, and all of it is asked for eventually ("how long did
this take?", "was the rewrite worth it?"). A walk that spans weeks and several sessions is
exactly the case where nobody remembers.

Append the cheap facts as you go, in a machine-readable file the walk owns:
per cluster, the wall-clock span and whatever the runtime can tell you about
consumption. Derive the rest from git when it is asked for, rather than
maintaining it — commits, lines changed and file counts are already recorded
there. **What git cannot recover is time and consumption**, so those are the two
worth writing down at the moment they are known.
