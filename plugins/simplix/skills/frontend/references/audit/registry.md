# Commonization Registry

> **These entries are reference examples of a commonization registry.** Concrete component, package, and module names are illustrative — substitute your project's own. The portable rule is the process: before inlining an empty / error / loading / status / toolbar / layout pattern, check this registry for an existing shared component; keep shared components in a shared package (framework-generic in `@simplix-react/ui`, project-specific in your own UI package, e.g. `@<scope>/<ui-package>`), never inlined in `modules/` or `apps/`. The `@simplix-react/ui` entries are generic; project-package entries illustrate the *kind* of pattern that belongs in a project's shared UI package.

## How to use this index

Each entry below is one registered shared pattern: what it is, and which detail file holds its full contract (usage, props, migration recipe, detection). Scan the index to find whether a pattern already exists (invariant #22); Read ONLY the matching detail file section before implementing. Detail files live in `registry/`.

## Empty / loading / fallback states → `registry/states-and-fallbacks.md`

- **EmptyState** — Shared empty-state block (icon + title + description + action) for every no-data area — never an inline icon-in-circle hand-roll
- **DetailFields Fallback Standardization** — All `DetailFields.*` components MUST render the shared `EmptyValueBadge` (muted dashed-outline "No value" pill
- **Loading Indicator Standardization (Button `loading` prop)** — Button carries `loading` / `loadingText` built in — no manual `disabled={isPending}` + ternary text + spinner icon
- **EmptyValue (em-dash placeholder for non-field cells)** — Muted em-dash placeholder (`children` default `—`) for "no value" in COMPACT contexts where neither a `DetailF
- **EmptyValueBadge (no-value pill for detail-style displays)** — Muted dashed "No value" pill for empty detail-style values (standard label: 값 없음 / No value / 値なし)

## Identity, detail fields & user labels → `registry/identity-and-detail-fields.md`

- **ID/UUID Exposure Prevention** — All user-facing UI text MUST display human-readable names, NEVER raw UUIDs. This applies to:
- **System Field Exclusion** — 1. Detail views: System fields MUST NOT appear as visible `DetailFields.*` components. `id` is only shown in `
- **CrudDetail AuditFooter** — `DetailAuditFooter` is a standalone component exported from `@simplix-react/ui`. It is also integrated into `C
- **LabeledField** — Label + optional description on the left, an arbitrary `control` (Switch/Select/Button/…) on the right. `Setti
- **DetailListRow / DetailList** — Bordered list of `icon? + primary + trailing?` rows. `DetailList` is the `overflow-hidden rounded-lg border` c
- **DetailStatusField (tone-driven status detail field)** — Read-only status/severity detail field. Renders a tone-driven `StatusBadge` inside the standard `DetailFieldWr
- **User identity labels (UserAvatar / UserLabel / UserHeading / useCurrentUserAvatar)** — Every render of a user account's display name carries the user's avatar. The public avatar endpoint 404s for u
- **PeekTriggerButton (cross-detail peek trigger)** — A cross-detail reference opens the referenced record in a `DetailPeekDialog`; its trigger is always `PeekTrigg
- **usePeekTarget (peek open/close state machine)** — The open/close state a widget-root `DetailPeekDialog` needs comes from `usePeekTarget`, never a hand-rolled `useState(fals
- **usePeekHost / PeekHost (app-root peek mounting)** — Reference labels dispatch their dialog to the app-root host instead of mounting it in the row that opened it

## Status tones, badges & flash → `registry/tones-and-badges.md`

- **Status Tone System (STATUS_TONES + StatusBadge + StatusDot)** — Status / severity coloring is centralized in `STATUS_TONES` — a single table of 7 semantic tones (`success | w
- **Domain enum→tone maps (@<scope>/<ui-package>)** — Each domain status enum has exactly ONE tone map, defined once in `@<scope>/<ui-package>`. Modules import the 
- **AlertBanner** — Tone-tinted inline notice box (icon + title/subtitle/children + optional trailing). `tone` (StatusTone), `dens
- **StatCard tone / highlighted** — Conditional surface tint is expressed via `tone?: StatusTone` + `highlighted?: boolean`, NOT a call-site `clas
- **theme.css status-flash / live-flash keyframes** — Status flash animation lives in the framework `theme.css` (`@keyframes status-flash` / live-flash) and is cons
- **ColorDot (arbitrary-hex color swatch)** — Small circular swatch filled with an arbitrary CSS color (props: `color`, `size?: "xs"|"sm"|"md"`, `className`
- **New domain tone maps (extension)** — Extends the [[Domain enum→tone maps (@<scope>/<ui-package>)]] set:
- **Seed-driven tone classes (toneSlotClass + STATUS_TONE_CLASS_OVERRIDE)** — Each status tone is painted from ONE seed CSS variable (`--tone-<name>`). The authored classes in `tones.css` 
- **Domain status badge + status variant maps (@<scope>/<ui-package>/<domain>)** — A status vocabulary shared by several entities of one domain renders via ONE badge; variant maps defined once

## Actions, saves, selects & validation → `registry/actions-and-forms.md`

- **Row Action Standardization** — 1. Delete button color normalized: Removed `text-destructive` (icon variant) and `variant="destructive"` (outl
- **SearchPopover (Unified Searchable Assignment)** — Unified searchable assignment popover (trigger + search + flat/grouped items) — replaces hand-rolled Popover+Command
- **SelectField Compact Mode** — `FormFields.SelectField compact` for table-cell / toolbar selects — modules never import raw Select primitives
- **Awaitable Cache Invalidation (useInvalidateEntity)** — `useInvalidateEntity` returns `() => Promise<void>` and calls `queryClient.invalidateQueries(...)` directly (n
- **SaveButton (Unified Save Button with isDirty + Validation)** — Save button with isDirty / isSaving / validation-count state built in — no hand-rolled primary save Button
- **Enum SelectField options — derive from the generated enum, not a hardcoded array** — When a `SelectField` offers the FULL set of an enum's values, derive options from the generated domain enum co
- **groupValidationErrors (no inline validation-error grouping loops)** — In hand-rolled mutation `.catch`/`onError` handlers, group server validation errors with the framework helper,
- **createEntityOptions (FK options loader factory)** — An FK entity's `{ label, value }` options — shared by its `EntityCombobox` picker and any faceted filter over 

## Layout primitives, chrome & structural composition → `registry/layout-and-chrome.md`

- **ListDetail Dialog Height Control** — `ListDetail` dialog variant (`variant="dialog"`) supports a `dialogHeight` prop to control the dialog's height
- **SectionHeaderBar / PanelList / SelectableListItem / IndentedSubsection (project layout)** — These are project-specific composition patterns (domain-agnostic but not generic enough for the framework — se
- **ContextBreadcrumb (@<scope>/<ui-package>/spatial)** — Site → Building → Floor location chain. Separator standardized to `ChevronRight`. `withBox` for the muted boxe
- **Layout primitive variants (Stack / Grid)** — Scroll bodies use `<Stack flex overflow="auto">` (not `<div className="flex-1 overflow-y-auto">`); fixed cells
- **AssignmentChip trailing slot** — `AssignmentChip` accepts a `trailing?: ReactNode` slot rendered between the label and the remove button. Use i
- **BrandMapMarker (@<scope>/<ui-package>/spatial)** — Renders the brand map-pin glyph (`/images/logo/<brand-icon>.svg`). Props: `size?` (Tailwind size token, defaul
- **Section variant convention (detail=flat / form=card)** — Every read-only `CrudDetail.Section` uses `variant="flat"`; every write `CrudForm.Section` uses `variant="card
- **HardwareEditorActions / CapacityBadge / GridControls** — - `HardwareEditorActions` — standardized editor footer (Back/Cancel + optional aria-labelled Delete + `SaveBut
- **ResizeHandle (shared drag-on-track edge resize affordance)** — Edge resize affordance for absolutely-positioned draggable bars on a track (bit-map field bars, schedule time 

## List toolbars, filters & counts → `registry/lists-and-filters.md`

- **ListTotalBadge (standard "Total N" FilterBar leading badge)** — The leading total-count badge of every list FilterBar is `<ListTotalBadge count={list.pagination.total} />` — 
- **User-select filter (useUserOptions + faceted dropdown)** — Every list filter over a user-account reference field (`userAccountId`, `delegatorId`, actor ids, …) is a `fac
- **useFilterBarState (FilterBar on non-CrudList surfaces)** — A surface whose query is NOT a `useCrudList` list (an aggregation report, a dashboard section, a custom endpoi
- **FilterBar count prop (the one total badge)** — The "전체 N건" badge comes from the FilterBar's `count` prop, which renders the shared `ListTotalBadge` internall
- **StatusCard placement (page-level status strip only)** — On a page with an always-visible status strip (summary `StatusCard`s under the page header), tab bodies must N

## Domain-shared widgets (activity / calendar / lifecycle / approval) → `registry/domain-widgets.md`

- **ActivityList (@<scope>/<ui-package>/activity)** — Scrolling activity/event feed. Rows are `ActivityRowModel { id, title, subtitle?, icon?, badge?, timestamp?, o
- **CalendarShell / CalendarApiBridge / CalendarColorLegend (calendar package)** — Every calendar screen composes its chrome from the calendar package, inside a `CalendarProvider`:
- **Day-detail dialog for calendar boards (@<scope>/<ui-package>/<domain>)** — Every board over the same day-scoped record family shares ONE day-detail popup — status pill, breakdown
- **Gantt row extras and view-family legends (@<scope>/<ui-package>/<domain>)** — Row-extra badges are one shared component; the legend swaps with the active view family; the timeline
- **Lifecycle / presence predicate tables (module `features/`)** — The condition for whether a lifecycle action applies (submit / review / cancel / check-in / extend / assign) l
- **ApprovalFlowSection (approver-scoped — not for operator surfaces)** — `ApprovalFlowSection` reads the approval-flow endpoint, which is scoped to the flow's PARTICIPANTS — for any o

## Adding a new pattern

A pattern the project commonizes is registered where the project can edit it — its own reference under `.claude/`, in the same index-plus-detail shape used here. A pattern that holds for any simplix-react project is contributed upstream to this skill instead of copied per project.

Either way, the shape of an entry is the same:

1. The full section (usage, props, migration recipe, detection greps) in the matching detail file — a new detail file only for a genuinely new category.
2. Its one-line entry in the index under that category.
3. If the pattern is regex-detectable, a rule in the audit script (`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`) and a recipe section in `audit-checklist.md`.
