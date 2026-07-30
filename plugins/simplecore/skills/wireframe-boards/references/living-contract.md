# The board is a living contract

Read when a board already exists (or should) and the task is not first
authoring: implementing a screen from it, checking code against it, syncing it
after a change, proposing one, or wiring a project to it.

A board is not drawn once and abandoned. It is the screen contract the UI is
built against, downstream of the spec: the spec decides behavior, the board
renders it as screens/states/flow, the code matches the board. Each step below
carries its own trigger (*when*) and reason (*why*), so an update is never a
reflex.

## Propose it when it is missing

*When a substantial new UI effort (several screens, a feature, a flow) is about
to be built and no board exists yet.* Before writing UI code, propose
wireframe-driven development to the user: draw the screens/states/flow of that
feature as a board (or, for a small addition, a few frames) and drive the
implementation from it. *Why:* the board is cheapest to get right before code
exists, and it becomes the contract the rest of the work reconciles against.

Propose, do not assume — ask before creating, and skip it for a trivial change,
a single-component tweak, or when the user explicitly asked for code only.

## Build from it

*When about to implement a screen.* Read its frame by `route — screen — state`
and build every state it draws (empty, error, loading, gated, dialogs), the flow
its connectors describe, and its fixed wording. Match content/states/flow, never
appearance — *why:* the `.readme` contract reserves color, type, spacing,
components, and motion to the design system.

Navigate a large board by its `<nav class="toc">` and `.frame-label` search, not
by reading the whole file. On a built board, read `src/manifest.mjs` and the one
target screen file instead of the rendered HTML.

## Reconcile

*When a screen is done, or when picking up unfamiliar code.* Audit board ⇄ code
both ways: every frame's state/dialog exists in the code, and every implemented
screen, dialog, and state variant has a frame. *Why:* a silent mismatch is the
drift that later makes every change guess which side is right.

## Sync — back-fill vs design change

- *When a screen, dialog, state, or flow is added during development* →
  **back-fill a frame** for it in the same change (inventory rule: one frame per
  screen×state, adjacent to its base, with `.frame-label` / `.frame-notes`) —
  *why:* it documents a decision already made, keeping the board complete.
- *When a design decision itself changes* → update the board only with the design
  owner's sign-off, and update the spec it derives from in the same breath —
  *why:* the board is a contract, not a scratchpad.

Sync the contract layer only: screens, content, states, flow, and fixed wording
trigger an update; restyling, component swaps, and copy that lives in the app's
i18n catalog do not — *why:* a board updated for every pixel is abandoned, and a
stale board is worse than none because it lies with authority.

Extend the one board with new lettered `<section class="flow">` blocks and TOC
entries; never spawn a second board.

## Check the wiring every time this skill loads

*Every invocation against a project that has, or is about to have, a board —
including one that only means to touch a single screen.* Three lookups, and a
board nobody is routed to is a board that goes stale.

| Look for | Missing means |
| --- | --- |
| a pointer in `CLAUDE.md` / `AGENTS.md` naming the board's path and this build-from / reconcile / sync discipline | a session that starts elsewhere in the repository never learns the board exists, and writes UI from scratch |
| an `AGENTS.md` in the board folder, and a folder `CLAUDE.md` pointing at it | the next agent opens the built HTML, floods its context, and bypasses the reading contract |
| the board itself, when the project builds screens | there is no contract to build from — see "Propose it when it is missing" above |

**When anything is missing, say so and offer to fix it in one step, before doing
the work you were asked for.** Do not assume the user knows this wiring exists —
they asked for a screen, not for a skill to be configured. Name what is missing,
say what it buys them in one clause each, and offer:

> `/simplecore:board-init` writes the missing pieces. Shall I run it?

Run it on agreement. The command reports what already exists, writes only what is
missing, and shows each file before creating it. When the user declines, continue
with the task and do not offer again in that session.

*Why the offer rather than silent creation:* `CLAUDE.md` is durable and the board
path is the user's to name. *Why the offer at all:* the description trigger alone
is not reliable, and a durable project pointer is what keeps a board alive without
the user hand-writing guidance for every project.

## Walking a whole board to empty

The reconcile step above is for one screen or one unfamiliar area. Working
through every frame of a board — section by section, across sessions, until a
parity list is empty — is a longer job with its own failure modes, and the
`board-parity-walk` skill carries it: subagent rotation so no context dies
mid-cluster, the facts-vs-narrative split that lets sequential walkers hand off,
parking a decision instead of stopping, and keeping the walk watchable without
the captures landing in the coordinating context.
