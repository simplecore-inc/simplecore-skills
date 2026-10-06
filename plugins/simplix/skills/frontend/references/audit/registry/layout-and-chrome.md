> Commonization registry - **Layout primitives, chrome & structural composition**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need. Entries whose package is `@<scope>/<ui-package>` illustrate the kind of pattern a project's own UI package holds - their component, map and module names are examples, never imports to copy (`../registry.md`).

# Registry - Layout primitives, chrome & structural composition

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

These are project-specific composition patterns (domain-agnostic but not generic enough for the framework - the placement rule is SKILL.md invariant #23). They live in `@<scope>/<ui-package>/layout`, NOT `@simplix-react/ui`.

- **SectionHeaderBar** - title + optional count Badge + optional action/trailing, `variant: "bar" | "card" | "plain"`. Replaces ad-hoc `Flex justify-between border-b bg-muted/50` header strips, dashboard card-title rows, and uppercase micro-labels.
- **PanelList<T>** - header + loading(Skeleton)/empty(EmptyState)/list state machine for side panels.
- **SelectableListItem** - selectable/draggable row, `tone: "tint" | "inverted" | "card"`. Replaces `<button className="... bg-primary/10 ...">` selectable rows.
- **IndentedSubsection** - labeled, left-ruled indented group (`border-l-2 border-border/50 pl-4`). Replaces the raw indented `<div>` editor idiom.

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

## Section variant convention (detail=flat / form=card)

| Field | Value |
|-------|-------|
| **Pattern** | `CrudDetail.Section variant="flat"` (read) / `CrudForm.Section variant="card"` (write) |
| **Scope** | All detail/form/editor widgets + the `form.hbs` / `detail.hbs` scaffold templates |

### Rule

Every read-only `CrudDetail.Section` uses `variant="flat"`; every write `CrudForm.Section` uses `variant="card"`. `collapsible` is an additive flag, independent of variant. `CrudForm.Section` and `CrudDetail.Section` are pure styled wrappers (no parent context dependency), so a write-context section that contains `FormFields.*` MUST use the FORM primitive (`CrudForm.Section`), never `CrudDetail.Section`. The scaffold templates emit the canonical variant (`form.hbs` → card, `detail.hbs` → flat) so regeneration does not re-introduce drift. Sole sanctioned `flat` exception in a form: a section embedded in a tab/dialog host that already supplies card chrome (annotate with a `{/* raw layout: tab host supplies chrome */}` note).

## A domain's editor primitives (@<scope>/<ui-package>/<domain>)

| Field | Value |
|-------|-------|
| **Components** | the chrome every editor of one domain draws the same way - an editor footer (`<Domain>EditorActions`), a drag-on-track edge handle (`<EdgeHandle>` and its tap-vs-drag constant), a location breadcrumb, a brand marker |
| **Package** | `@<scope>/<ui-package>` (the domain's subpath, or the package root) |

### Rule

A piece of editor chrome that several editors draw the same way - the footer's Back/Cancel, Delete and Save, the grip on a draggable bar's edge, the location chain above a plan - is ONE component in the project's UI package, listed in the project's own registry (`../registry.md` § Adding a new pattern), never redrawn per editor. Module-local commonization (a `modules/<m>/src/shared/ui/` component) is correct when reuse is WITHIN one module; promote to `@<scope>/<ui-package>` only when 2+ modules need it. A single-consumer "shared" component (a row that lives in exactly one editor) must NOT be extracted - that is a speculative abstraction.

Where the project declares its edge handle and the constants its UI package owns in `.claude/simplix.json`, the audit holds every module to them: `audit.cursorColResize` (`{ "component": "<EdgeHandle>", "importFrom": "@<scope>/<ui-package>" }`) for `cursor-col-resize`, `audit.dragThresholdCopy` (`{ "names": ["<SHARED_CONSTANT>"], "importFrom": "@<scope>/<ui-package>" }`) for `drag-threshold-copy` → `../audit-checklist.md` § Project Edge Handle Violations.
