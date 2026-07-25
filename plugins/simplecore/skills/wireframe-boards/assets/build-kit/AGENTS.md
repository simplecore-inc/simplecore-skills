# {{PRODUCT}} wireframe board — working rules

<!-- TEMPLATE: copy into your board folder and replace {{PRODUCT}} and the paths. This
     file is the agent-facing contract; keep it in English so it applies everywhere. -->

This folder is the **screen contract** for {{PRODUCT}}. The spec decides behavior, this
board renders it as screens/states/flow, and the UI is built to match the board. The
rendered `board.html` is the artifact humans review; **what you edit is the source
under `src/` plus the build.** Read this file before touching a screen.

> **Do not open `board.html` to read it.** It is a thousands-of-lines build output;
> reading it whole just floods context. To find a screen, read `src/manifest.mjs` (the
> table of contents), then open the one screen file you need and the components it
> composes from.

## Folder layout

| Path | Role |
| ---- | ---- |
| `board.html` | Build output (for humans). **Never edit directly** — the build overwrites it. |
| `src/manifest.mjs` | Table of contents, build order, screen numbers. **Read this first.** |
| `src/screens/<num>-<slug>.mjs` | One screen = a data object + a body composed from components. |
| `src/components.mjs` | Content primitives (the composition kit) and the `CATALOG`. |
| `src/partials.mjs` | Shared chrome — nav, titlebar, statusbar, `frame`, sidebar, page. |
| `src/styles.css` | The class vocabulary (the contract). The build inlines it. |
| `src/intro.html` | Optional board intro (readme / reading contract), rendered at the top. |
| `build.mjs` | `node build.mjs` → `_proof.html` · `node build.mjs --release` → `board.html`. |
| `catalog.mjs` | `node catalog.mjs` → `_catalog.html` (component storybook). |

## How to read and edit a screen

- **To touch one screen**, find its file in `manifest.mjs`, then open only that screen
  file and the components it composes from. Never read the whole board (the built
  HTML) — that narrow read is what keeps a large board tractable.
- **Screens are addressed by number** (e.g. `A-02`). The number comes from the screen's
  position in its section; the sidebar and anchors resolve it.
- **A new screen = one file in `src/screens/` + one line in `manifest.mjs`.**
- **A body writes no raw HTML tags.** Compose from `components.mjs` functions; when a
  primitive is missing, build it as a component and register it in `CATALOG` (it then
  shows up in the storybook). Chrome (nav/titlebar/statusbar) is regenerated from data
  by `partials.mjs`, so it never lives in a screen file.
- **Preview** with `node build.mjs` and open `_proof.html`. Replacing `board.html` is
  `--release` only, gated on the board being complete.

## The reading contract

A wireframe fixes **what** is on each screen, which **states** exist, and how screens
**connect** — never how the product looks. Non-negotiables:

1. Lo-fi, not a design. Grey fills, borders, radii, spacing, the single accent, and
   monospace are board notation; the design system owns color/type/spacing/motion.
2. Text on a frame is fixed copy — use it verbatim. Grey placeholder bars are not
   strings.
3. One frame is one screen × one state. Every drawn state (empty, error, loading,
   gated, overlay) is a requirement, not a happy-path option.
4. A frame label reads `route — screen — state`. In the notes, `AUTH:` is the entry
   precondition, `DATA:` the source endpoint, `OPEN:` an unresolved question that
   blocks that part's implementation until resolved with the board owner.

## Living contract — build from it, reconcile, sync

- **Build from it:** implement every state/flow/fixed string a frame draws; match
  content/states/flow, never appearance.
- **Reconcile:** audit board ⇄ code both ways — every frame's state exists in code, and
  every implemented screen/dialog/state has a frame.
- **Sync:** a screen/dialog/state/flow **added** during development is back-filled as a
  frame in the same change. A **design decision that changes** updates the board only
  with the design owner's sign-off, and the spec in the same breath. Sync the contract
  layer only (screens, content, states, flow, fixed wording) — not restyling or i18n
  copy.

This board is maintained with the `wireframe-boards` skill; its rules are the authority.
