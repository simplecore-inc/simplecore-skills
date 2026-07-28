> Commonization registry — **Layout primitives, chrome & structural composition**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry — Layout primitives, chrome & structural composition

## ListDetail Dialog Height Control

| Field | Value |
|-------|-------|
| **Pattern** | ListDetail dialog height adjustment via `dialogHeight` prop |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/patterns/list-detail.tsx` |

### Rule

`ListDetail` dialog variant (`variant="dialog"`) supports a `dialogHeight` prop to control the dialog's height behavior:

- **Default (no `dialogHeight`)**: Height fits content, capped at `max-h-[85vh]`. No minimum height enforced.
- **With `dialogHeight` (e.g. `"60vh"`, `"500px"`)**: Fixed height with internal scrolling handled by `CrudDetail`/`CrudForm` body slot (`overflow-auto`).

### Usage

```tsx
// Default — height fits content (no fixed height)
<ListDetail variant="dialog">
  <ListDetail.List>...</ListDetail.List>
  <ListDetail.Detail>...</ListDetail.Detail>
</ListDetail>

// Fixed height — internal scrolling when content overflows
<ListDetail variant="dialog" dialogHeight="60vh">
  <ListDetail.List>...</ListDetail.List>
  <ListDetail.Detail>...</ListDetail.Detail>
</ListDetail>
```

### Anti-Pattern

```tsx
// FORBIDDEN — Overriding dialog height with inline styles or className on DetailPanel
<ListDetail.Detail className="h-[500px]">...</ListDetail.Detail>

// REQUIRED — Use dialogHeight prop on ListDetail root
<ListDetail variant="dialog" dialogHeight="500px">...</ListDetail>
```

## SectionHeaderBar / PanelList / SelectableListItem / IndentedSubsection (project layout)

| Field | Value |
|-------|-------|
| **Components** | `SectionHeaderBar`, `PanelList`, `SelectableListItem`, `IndentedSubsection` |
| **Package** | `@<scope>/<ui-package>` (subpath `./layout`) |
| **Source** | `packages/<ui-package>/src/layout/*` |

### Rule

These are project-specific composition patterns (domain-agnostic but not generic enough for the framework — see [[framework-only-generic-components]]). They live in `@<scope>/<ui-package>/layout`, NOT `@simplix-react/ui`.

- **SectionHeaderBar** — title + optional count Badge + optional action/trailing, `variant: "bar" | "card" | "plain"`. Replaces ad-hoc `Flex justify-between border-b bg-muted/50` header strips, dashboard card-title rows, and uppercase micro-labels.
- **PanelList<T>** — header + loading(Skeleton)/empty(EmptyState)/list state machine for side panels.
- **SelectableListItem** — selectable/draggable row, `tone: "tint" | "inverted" | "card"`. Replaces `<button className="... bg-primary/10 ...">` selectable rows.
- **IndentedSubsection** — labeled, left-ruled indented group (`border-l-2 border-border/50 pl-4`). Replaces the raw indented `<div>` editor idiom.

## ContextBreadcrumb (@<scope>/<ui-package>/spatial)

| Field | Value |
|-------|-------|
| **Component** | `ContextBreadcrumb` + `buildSpatialSegments` |
| **Package** | `@<scope>/<ui-package>` (subpath `./spatial`) |

### Rule

Site → Building → Floor location chain. Separator standardized to `ChevronRight`. `withBox` for the muted boxed strip, `rightAction` for a trailing button. Replaces inline site/building breadcrumb strips and the `/` literal separator.

## Layout primitive variants (Stack / Grid)

| Field | Value |
|-------|-------|
| **Primitives** | `Stack` (`overflow`, `shrink`, `minSize`), `Grid` (`gap="px"`, `template`) |
| **Package** | `@simplix-react/ui` |

### Rule

Scroll bodies use `<Stack flex overflow="auto">` (not `<div className="flex-1 overflow-y-auto">`); fixed cells use `<Stack shrink={false}>`; arbitrary grid templates use `<Grid template="1fr auto">`; hairline grids use `<Grid gap="px">`. Genuinely non-replaceable cases (absolute drag/resize handles, konva/canvas hosts, custom time-grid cells, bitmap chips) keep a raw `div` with a `{/* raw layout: <reason> */}` justification comment.

## AssignmentChip trailing slot

| Field | Value |
|-------|-------|
| **Component** | `AssignmentChip` (extended) via `AssignmentPanel.Chip` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/assignment/assignment-panel.tsx` |

### Rule

`AssignmentChip` accepts a `trailing?: ReactNode` slot rendered between the label and the remove button. Use it for per-chip metadata (e.g. a count Badge, a role tag) instead of composing a bespoke chip row. Replaces hand-built `Badge` + label + remove-button chips such as a hand-built group-membership panel chip.

## BrandMapMarker (@<scope>/<ui-package>/spatial)

| Field | Value |
|-------|-------|
| **Component** | `BrandMapMarker` |
| **Package** | `@<scope>/<ui-package>` (subpath `./spatial`) |
| **Source** | `packages/<ui-package>/src/spatial/brand-map-marker.tsx` |

### Rule

Renders the brand map-pin glyph (`/images/logo/<brand-icon>.svg`). Props: `size?` (Tailwind size token, default `size-5`), `className?`. Replaces raw `<img src="/images/logo/<brand-icon>.svg" ... />` inside `MapPinContainer` marker slots. Project-specific (brand asset) → lives in `@<scope>/<ui-package>/spatial`, not the framework.

## Section variant convention (detail=flat / form=card)

| Field | Value |
|-------|-------|
| **Pattern** | `CrudDetail.Section variant="flat"` (read) / `CrudForm.Section variant="card"` (write) |
| **Scope** | All detail/form/editor widgets + the `form.hbs` / `detail.hbs` scaffold templates |

### Rule

Every read-only `CrudDetail.Section` uses `variant="flat"`; every write `CrudForm.Section` uses `variant="card"`. `collapsible` is an additive flag, independent of variant. `CrudForm.Section` and `CrudDetail.Section` are pure styled wrappers (no parent context dependency), so a write-context section that contains `FormFields.*` MUST use the FORM primitive (`CrudForm.Section`), never `CrudDetail.Section`. The scaffold templates emit the canonical variant (`form.hbs` → card, `detail.hbs` → flat) so regeneration does not re-introduce drift. Sole sanctioned `flat` exception in a form: a section embedded in a tab/dialog host that already supplies card chrome (annotate with a `{/* raw layout: tab host supplies chrome */}` note).

## HardwareEditorActions / CapacityBadge / GridControls

| Field | Value |
|-------|-------|
| **Components** | `HardwareEditorActions` (@<scope>/<ui-package>/hardware); `CapacityBadge`, `GridControls` (a module-local `shared/ui`) |

### Rule

- `HardwareEditorActions` — standardized editor footer (Back/Cancel + optional aria-labelled Delete + `SaveButton`) inside `EditorFooter`. Adopted across the 4 hardware editors + sio-creator.
- `CapacityBadge` — interval-count badge whose tone derives from `count/max` ratio (no magic literal; replaced `getIntervalBadgeVariant`).
- `GridControls` — undo/redo/delete icon-button cluster shared between the schedule editor panel header and toolbar.
- Module-local commonization (a `modules/<m>/src/shared/ui/` component) is correct when reuse is WITHIN one module; promote to `@<scope>/<ui-package>` only when 2+ modules need it. A single-consumer "shared" component (e.g. a reader-port row that lives in exactly one editor) must NOT be extracted — that is a speculative abstraction.

## ResizeHandle (shared drag-on-track edge resize affordance)

| Field | Value |
|-------|-------|
| **Component** | `ResizeHandle` (+ `DRAG_THRESHOLD_PX`) |
| **Package** | `@<scope>/<ui-package>` (root export) |
| **Source** | `packages/<ui-package>/src/resize-handle.tsx` |
| **Export** | `import { ResizeHandle, DRAG_THRESHOLD_PX } from "@<scope>/<ui-package>"` |

### Rule

Edge resize affordance for absolutely-positioned draggable bars on a track (bit-map field bars, schedule time blocks). Renders a fixed-width (`w-2.5`) hit area pinned to the `left`/`right` edge with `cursor-col-resize hover:bg-white/20` and a centered ALWAYS-WHITE vertical grip line (SVG, `non-scaling-stroke` 1.5px, round caps) that fills the parent bar height. The handle calls `event.stopPropagation()` before the consumer's `onPointerDown`, so grabbing an edge resizes instead of moving the whole bar. `DRAG_THRESHOLD_PX` (4) is the shared tap-vs-drag boundary; consumers gate the first move with `Math.hypot(dx, dy) > DRAG_THRESHOLD_PX` to push exactly one undo per drag.

Props: `side: "left" | "right"`, `onPointerDown`, `disabled?`, `className?`.

Project-specific drag-on-track editor primitive (not generic enough for the framework — see [[framework-only-generic-components]]); promoted to `@<scope>/<ui-package>` because 2 modules need it (device-settings card-format + schedule). Grip is hardcoded white because both hosts sit on saturated colored bars.

### Anti-Pattern

```tsx
// FORBIDDEN — inline edge resize handle (raw div + pill/line grip)
<div
  className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-white/20 flex items-center justify-center"
  onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, "resize-left"); }}
>
  <div className="rounded-full" style={{ width: 2, height: 12, backgroundColor: "rgba(255,255,255,0.6)" }} />
</div>

// REQUIRED — shared ResizeHandle
<ResizeHandle side="left" disabled={disabled} onPointerDown={(e) => handlePointerDown(e, "resize-left")} />
```

### Exception

Non-edge / non-bar drag handles keep their bespoke rendering: the bit-map parity COVERAGE handles (centered boundary/edge arrow icons on the 16px coverage row) and konva/canvas vertex handles (floor-plan polygon vertices) are NOT left/right edge grips and stay local. The coverage arrow icons share the white grip color (`text-white`) so all drag handles in the bit-map editor read identically.
