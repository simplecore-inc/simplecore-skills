# Screens left to walk

Having a route and matching the state a frame draws are different things, and a frame with no route
at all is a third. This document holds every frame that is not yet both built and checked against
the board.

**This is not an initiative.** It is a list that is edited for as long as the board lives, so it
carries no date.

## This list only shrinks

A walked frame is **deleted.** No marker is left behind — counting what is behind is not this
document's job; saying what is left is. An empty list means the board and the code agree.

## The discipline lives in the skill

Invoke **`simplecore:board-parity-walk`** before walking. It carries one cluster per subagent with
a fresh agent after each, the split that keeps facts shared and narrative private, parking a
decision instead of stopping, and how a person watches the walk without filling the coordinating
context.

## Parked decisions

What is here stopped on a decision; it was not forgotten. Read this section first when a session
opens. When a decision is settled, apply it and delete the line.

One line each: which frame, what the choice or the blocker is, and which side looks stale. Without
the third part the next session has to re-derive the context, which is the cost parking exists to
avoid.

- C-07 — board draws a bulk reverse; the API reverses one record at a time. Board looks stale, but
  the operator does 40 a day. Product decision.
- D-02 — needs a role that exists in no environment yet. Blocked, not stale.

## Screens left to walk

One line per frame, addressed by the board's **permanent id** (`A-01`) — the id never changes when
the board is reordered, which is what keeps this list valid between sessions. Never write a frame's
bracketed board position (`[02]`) here; it moves on every build. The file name follows the id so a
frame can be opened without searching.

### A <section name>

- A-01 `<frame file name>` — <screen · state>

A line says nothing about whether the frame exists in the code. Finding that out is the walker's
first act, and a frame that turns out to need building is walked the same way as one that needs
correcting.
