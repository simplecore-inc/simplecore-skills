# One story feeds the sample data and the captures

A board tells you what each screen holds. It does not tell you *whose* front gate
is on the list, or how many people are behind the number, or what happened before
this screen. Left to each frame, those get invented at the screen — and the
moment they are, the front gate on the list and the front gate on the detail page
quietly become different machines. Nothing fails; the two just disagree.

So one document carries the story: from an empty device to a site in operation,
as numbered steps, each step naming the frames it feeds. **Sample data is derived
from it, and captures are taken against it.**

That one document then does two jobs at once: it is the source every fixture
derives from, and it is the script the final capture run follows. Once its steps
can actually be executed it does a third — a capture taken at step four is a
capture of a system that genuinely went through steps one to three.

## Keep the story honest as the product grows

The story is not an appendix. When a frame changes what came before it — a screen
that registers people changes where the existing people came from — **fix the
earlier step there and then.** Appending only, with the earlier steps untouched,
leaves the story contradicting itself, and the contradiction is invisible until
somebody puts two screens side by side. Ask both questions per frame: which moment
does this show, and which already-written moment does this change?

**This skill ships no checker for any of it, and 「a checker could hold that」 is not one.**
Coverage — every frame the story feeds appearing in the document, every step naming frames that
exist — is a check a project can write as a gate of its own, against its own board and its own
document format; until it writes one, nothing is holding it, and a story document naming no frame
at all stands there saying nothing. Whether the steps still add up is nobody's check: that is the
agent's judgement. Both halves are marked in the skill's *Held by eyes* table, because a sentence
saying what a checker *could* do is read as one somebody already wrote — which is the third
category this skill spends a section refusing.

## Record what a unit of work cost, or the number is gone

The log format and the watches the coordinator arms on it are in the main document; what
that log does not carry is the price. Duration, tokens, commits, lines, file sizes — none
of it can be reconstructed afterwards, and all of it is asked for eventually ("how long did
this take?", "was the rewrite worth it?"). Work that spans weeks and several sessions is
exactly the case where nobody remembers.

Append the cheap facts as you go, in a machine-readable file this work owns:
per unit of work, the wall-clock span and whatever the runtime can tell you about
consumption. Derive the rest from git when it is asked for, rather than
maintaining it — commits, lines changed and file counts are already recorded
there. **What git cannot recover is time and consumption**, so those are the two
worth writing down at the moment they are known.
