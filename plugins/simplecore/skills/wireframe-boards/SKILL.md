---
name: wireframe-boards
description: >-
  Author low-fidelity PHONE, TABLET, and DESKTOP/WEB wireframes as one
  self-contained HTML board — device frames, a CSS-only narrow ⇄ wide viewport
  toggle, greybox content, dashed flow connectors, and annotation callouts, in
  per-flow sections that scale to dozens of frames. Use for wireframes, screen
  mockups, lo-fi screens, UI sketches, a screen inventory or flow board derived
  from a design/spec document, or 와이어프레임 · 화면 목업 · 로파이 · 태블릿 화면 ·
  웹 화면 · PC 화면 · 데스크톱 화면 · 관리자 화면 — including when the word
  "wireframe" is absent but the deliverable is screen layouts drawn before any
  implementation. Use it as the LIVING screen contract too: implementing a screen
  from a board, checking an implementation against one, or syncing the board when
  a screen/dialog/state/flow is added or changed. Propose it proactively when a
  substantial new UI effort has no board yet. It also carries the PERSONA REVIEW
  of a board — walking each flow as a UI/UX reviewer, as the operator whose work
  the screens carry, and as the end user the service is for — which is offered
  whenever a screen is drawn or changed, and which triggers on 페르소나 검토 ·
  페르소나 리뷰 · 사용자 관점 검토 · 담당자 관점 · UI/UX 관점 · 화면 사용성 검토.
  NOT for high-fidelity visual design or production React components.
---

# Wireframe Boards

Produce a wireframe board: a single HTML file laying out an app's screens as
rows of lo-fi device frames — phones, tablets, desktop browsers, or all three on
one board. The point is structure and flow — what is on each screen, in which
state, and how the user moves between screens — never visual polish. Screens
stay clean greyboxes; only connectors and annotations are loose and informal.

## Output contract

One self-contained `.html` file, `<!doctype html>` through `</html>`, all CSS
inline in one `<style>` block. These six hold on every board:

1. **No external resource** — no images, fonts, or stylesheets; system font
   stack only. The file must render identically offline, attached to a doc, or
   as a thumbnail; one missing network resource silently destroys the board.
2. **No JavaScript, with one narrow exception.** Layout, content, and states are
   pure HTML/CSS and must render fully with scripts off. The only script
   permitted is a small **inline** scroll-spy that highlights the table-of-contents
   entry of the frame in view — progressive, so anchors still work with JS off.
   No script may create content, drive interactivity a reviewer acts on, or gate
   what is visible.
3. **Greyscale plus exactly ONE accent color**, reserved for connectors,
   annotation pins, stickies, fold lines, and `OPEN:` markers. A second accent
   turns the board into a design and reviewers critique colors instead of flows.
4. **The `.readme` implementation contract ships on every board** and is never
   deleted or trimmed — a board reaches its reader stripped of the conversation
   that produced it, and both people and LLMs otherwise reproduce the greyboxes
   as a design. It states what the board specifies (screens, content, states,
   flow, wording) and what it deliberately does not (color, type, spacing,
   components, motion), how to read `AUTH:` / `DATA:` / `OPEN:`, that a
   narrow/wide pair is one responsive screen, and that the project's own frontend
   conventions outrank anything the board's shapes imply. Board-specific caveats
   are appended as further numbered items, never substituted for the standing
   ones.
5. **Horizontal scrollbars are always visible.** Rows scroll sideways and macOS
   hides overlay scrollbars until something scrolls, so a row of 1440px frames
   looks like it ends at the window edge. The template pins a permanent scrollbar
   on `.row`; any other horizontally scrollable region gets `.scroll-x`.
6. **The viewport toggle is pure CSS** — a checkbox plus sibling selectors —
   precisely so rules 1 and 2 survive it.

## Workflow

1. **Build the frame inventory first.** Before writing any HTML, list every
   frame as `device — route — screen — state`. Every distinct state is its own
   frame: empty, error, expired token, terminal statuses, gated variants, dialog
   overlays. A screen×state authored as a viewport pair is one inventory item.
   State variants are where wireframe reviews catch real defects — a
   happy-path-only board hides them. If the brief carries a checklist, the
   inventory must cover it item by item.
2. **Let that inventory pick the authoring path, then copy its starting point.**
   - *Under roughly twenty frames, with chrome that varies screen to screen:*
     copy `assets/board-template.html` as the document skeleton. It defines the
     full CSS vocabulary; keep the class names, variables, and the `.readme`
     block, and delete the example sections (and the toggle, when no pairs
     remain). Extend the CSS only for a primitive that does not exist yet.
   - *At or past that size, or once the same nav / titlebar / status bar would be
     hand-copied into every frame:* copy `assets/build-kit/` and follow
     `references/build-kit.md`. The deliverable is identical — every rule here
     still applies — but each frame is authored as a `src/screens/` file composed
     from components.
3. **Organize into flow sections.** One `<section class="flow">` per user flow or
   feature area, with a lettered title (`A. Sign-in`, `B. Checkout`) and a frame
   count. Add a `<nav class="toc">` when the board has more than two sections —
   on a 40-frame board, navigation is the difference between a review tool and a
   wall of grey.
4. **Compose each frame from the primitives** → `references/primitives.md`.
   Frames render at their device-class dimensions so proportions read truthfully
   — if a label or button row overflows at that width, the real screen will too,
   and surfacing that is part of the wireframe's job. Device classes, fixed vs
   fluid height, and viewport pairs → `references/device-frames.md`.
5. **Connect and annotate** → `references/primitives.md` § Connectors and
   annotations.
6. **Self-check** (below), then write the file to the requested path. If browser
   tooling is available, open the file and visually verify at least one wide
   section, one overlay frame, one desktop fold, and — on boards with pairs —
   both toggle states.
7. **Offer the persona review** → `references/persona-review.md`. Required on a
   new board, on added frames, and on any change to a screen's structure, states,
   flow, or fixed wording. Ask; do not run it unasked and do not skip it. When
   the user accepts, fold the findings back into the board and re-run step 6.

## References — read on demand

All paths are relative to this skill's own directory.

| Situation | Read |
| --- | --- |
| Choosing a device class, height behaviour, or authoring a narrow/wide pair | `references/device-frames.md` |
| Composing frame content, chrome, connectors, annotations; fidelity rules | `references/primitives.md` |
| Implementing from a board, reconciling code ⇄ board, syncing after a change, proposing a board, wiring a project to its board | `references/living-contract.md` |
| Past ~20 frames, or repeated chrome — the component kit, screen files, and build | `references/build-kit.md` |
| Running the persona review after a screen is drawn or changed | `references/persona-review.md` |

Boards are drawn **downstream of the spec**: the spec decides behavior, the
board renders it as screens/states/flow, the code matches the board. A board is
not drawn once and abandoned — `references/living-contract.md` carries the
build-from, reconcile, and sync discipline, and applies whenever this skill is
used against a project that has a board.

## Self-check (before delivering)

- The `.readme` implementation contract is present, complete, and above the
  first flow section.
- Frame inventory ⇄ board: every inventory item (and every brief checklist item)
  has exactly one frame — one pair, for paired items; report the final frame
  count per section.
- Every frame has a `.frame-label`; every state variant is adjacent to its base
  screen; every `.narrow` frame has its `.wide` twin adjacent, and neither tag
  appears on a single-viewport screen.
- Toggling the viewport switch shows exactly one frame of each pair and flips
  the highlighted segment in the header; the toggle is absent on boards with no
  pairs.
- Every desktop frame has a `.fold` with its reference size, and the screen's
  primary action sits above it. No phone or tablet frame with `.tabbar` / `.cta`
  runs past its fold.
- Each row's horizontal scrollbar is visible without scrolling — verify at a
  window narrower than the row's content.
- No label overflow at any frame's width in either viewport; no
  near-white-on-white regions.
- Flow reads left-to-right within each row; step numbering is continuous and
  holds in both toggle states.
- The single accent appears only on connectors, pins, stickies, folds, `OPEN:`
  notes, and the `.readme` rule.
- The persona review was offered — and, when the user accepted, its findings are
  in the board (new frames, `OPEN:` notes, corrected wording) rather than in the
  conversation, and this checklist ran again after them.
