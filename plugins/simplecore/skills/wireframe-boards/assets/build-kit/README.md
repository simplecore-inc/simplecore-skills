# build-kit — a data-driven build for a large wireframe board

Use this when a board outgrows the single `board-template.html` file — past roughly
twenty frames, or once the same chrome is copied into every frame. It builds a
multi-file source into the **same** deliverable: one self-contained, offline HTML
(the only script is a progressive-enhancement scroll-spy). Splitting is a *source*
concern, not a *deliverable* one.

## What's here

This kit speaks the **same greybox vocabulary** as `board-template.html` — the
responsive phone/tablet/desktop primitives that the skill documents. Choosing the
build over the single file is purely about scale, not a different design language.

```
build.mjs          # reads the manifest, wraps each screen's body in its device frame, writes the HTML
catalog.mjs        # renders CATALOG into a component storybook (_catalog.html)
AGENTS.md          # agent-facing contract template  → copy to your board folder
CLAUDE.md          # folder pointer template          → copy to your board folder
src/
  manifest.mjs     # table of contents + build order + screen numbers
  intro.html       # board header + the .readme reading contract (ships in every built board)
  partials.mjs     # frame() device shell + sidebar() TOC + page() document
  components.mjs   # content + chrome primitives (appbar/tabbar/shell/sidebarNav/…) + self-registering CATALOG
  styles.css       # the class vocabulary the build inlines (board-template's, verbatim)
  screens/
    s-01-sample.mjs         # sample phone screen composed from components
    s-02-sample-desktop.mjs # sample desktop screen (app shell)
```

## Adopt it

1. Copy this folder's contents into your board folder (e.g. `docs/.../wireframes/`).
2. **Onboard by building the kit first:** customize the chrome components in
   `components.mjs` (brand/nav in `sidebarNav`, `appbar`, `topbar`, `browserbar`),
   trim `CATALOG` to your primitives, and keep the sample screens as the composition
   reference. Run `node catalog.mjs` and `node build.mjs`, open `_catalog.html` and
   `_proof.html` to confirm they render. `partials.mjs` rarely needs changing.
3. **Edit `src/intro.html`** — replace `{{PRODUCT}}`/`{{AREA}}`, keep reading-contract
   items 1-10 verbatim, add board-specific rules as items 11+. This is what puts the
   `.readme` contract into every built board; never ship a board without it.
4. Copy `AGENTS.md` and `CLAUDE.md` into the board folder and replace `{{PRODUCT}}`.
   They keep the next agent reading the source, not the built HTML.
5. Author product screens: one file in `src/screens/` + one line in `src/manifest.mjs`
   each. A screen is a data object (`device`, route, screen, state, notes) plus a
   `body` composed from components; `device` is `phone` (default) / `tablet` /
   `desktop`, and `variant` is `narrow` / `wide` for a responsive pair. Address screens
   by number (`A-01`).
6. `node build.mjs --release` writes `board.html` — the artifact humans review. Set the
   `REQUIRED` letters in `build.mjs` so `--release` refuses an incomplete board.

## How it reads

- **The author (human or LLM) reads `manifest.mjs` + one screen**, never the whole
  board — that is what keeps a large board tractable.
- **The device shell is generated once** by `frame()` in `partials.mjs`; chrome and
  content are composed from `components.mjs`; screens carry only their bespoke body.
- **Screen numbers** (`A-01`) are the address a person and an agent use to name a
  screen; the sidebar and anchors resolve them.

See the `wireframe-boards` skill for the full board contract and the living-contract
(build-from / reconcile / sync) discipline.
