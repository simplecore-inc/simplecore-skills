# Commonization Registry

> **These entries are reference examples of a commonization registry.** Concrete component, package, and module names are illustrative - substitute your project's own. The portable rule is the process: before inlining an empty / error / loading / status / toolbar / layout pattern, check this registry for an existing shared component; keep shared components in a shared package (framework-generic in `@simplix-react/ui`, project-specific in your own UI package, e.g. `@<scope>/<ui-package>`), never inlined in `modules/` or `apps/`. The `@simplix-react/ui` entries are generic; project-package entries illustrate the *kind* of pattern that belongs in a project's shared UI package.

## How to use this index

Each entry below is one registered shared pattern: what it is, and which detail file holds its full contract (usage, props, migration recipe, detection). Scan the index to find whether a pattern already exists (invariant #22); Read ONLY the matching detail file section before implementing. Detail files live in `registry/`.

## Empty / loading / fallback states → `registry/states-and-fallbacks.md`

- **EmptyState** - Shared empty-state block (icon + title + description + action) for every no-data area - never an inline icon-in-circle hand-roll
- **DetailFields Fallback Standardization** - All `DetailFields.*` components MUST render the shared `EmptyValueBadge` (muted dashed-outline "No value" pill
- **Loading Indicator Standardization (Button `loading` prop)** - Button carries `loading` / `loadingText` built in - no manual `disabled={isPending}` + ternary text + spinner icon
- **EmptyValue (hyphen placeholder for non-field cells)** - Muted placeholder (`children` default `EMPTY_VALUE_TEXT`, one hyphen-minus) for "no value" in COMPACT contexts where neither a `DetailF
- **EmptyValueBadge (no-value pill for detail-style displays)** - Muted dashed "No value" pill for empty detail-style values (standard label: `값 없음` / `No value` / `値なし`)

## Identity, detail fields & user labels → `registry/identity-and-detail-fields.md`

- **ID/UUID Exposure Prevention** - All user-facing UI text MUST display human-readable names, NEVER raw UUIDs. This applies to:
- **System Field Exclusion** - 1. Detail views: System fields MUST NOT appear as visible `DetailFields.*` components. `id` is only shown in `
- **CrudDetail AuditFooter** - `DetailAuditFooter` is a standalone component exported from `@simplix-react/ui`. It is also integrated into `C
- **LabeledField** - Label + optional description on the left, an arbitrary `control` (Switch/Select/Button/…) on the right. `Setti
- **DetailListRow / DetailList** - Bordered list of `icon? + primary + trailing?` rows. `DetailList` is the `overflow-hidden rounded-lg border` c
- **DetailStatusField (tone-driven status detail field)** - Read-only status/severity detail field. Renders a tone-driven `StatusBadge` inside the standard `DetailFieldWr
- **User identity labels (@<scope>/<ui-package>/identity)** - Placeholder: where the product shows avatars, every user display name goes through the project's identity components; the project's registry names them
- **PeekTriggerButton (cross-detail peek trigger)** - A cross-detail reference opens the referenced record in a `DetailPeekDialog`; its trigger is always `PeekTrigg
- **usePeekTarget (peek open/close state machine)** - The open/close state a widget-root `DetailPeekDialog` needs comes from `usePeekTarget`, never a hand-rolled `useState(fals
- **usePeekHost / PeekHost (app-root peek mounting)** - Reference labels dispatch their dialog to the app-root host instead of mounting it in the row that opened it

## Status tones, badges & flash → `registry/tones-and-badges.md`

- **Status Tone System (STATUS_TONES + StatusBadge + StatusDot)** - Status / severity coloring is centralized in `STATUS_TONES` - a single table of 7 semantic tones (`success | w
- **Domain enum→tone maps (@<scope>/<ui-package>)** - Each domain status enum has exactly ONE tone map, defined once in `@<scope>/<ui-package>`. Modules import the 
- **AlertBanner** - Tone-tinted inline notice box (icon + title/subtitle/children + optional trailing). `tone` (StatusTone), `dens
- **StatCard tone / highlighted** - Conditional surface tint is expressed via `tone?: StatusTone` + `highlighted?: boolean`, NOT a call-site `clas
- **theme.css status-flash / live-flash keyframes** - Status flash animation lives in the framework `theme.css` (`@keyframes status-flash` / live-flash) and is cons
- **ColorDot (arbitrary-hex color swatch)** - Small circular swatch filled with an arbitrary CSS color (props: `color`, `size?: "xs"|"sm"|"md"`, `className`
- **New domain tone maps (extension)** - Extends the [[Domain enum→tone maps (@<scope>/<ui-package>)]] set:
- **Seed-driven tone classes (toneSlotClass + STATUS_TONE_CLASS_OVERRIDE)** - Each status tone is painted from ONE seed CSS variable (`--tone-<name>`). The authored classes in `tones.css` 
- **Domain status badge + status variant maps (@<scope>/<ui-package>/<domain>)** - A status vocabulary shared by several entities of one domain renders via ONE badge; variant maps defined once

## Actions, saves, selects & validation → `registry/actions-and-forms.md`

- **Row Action Standardization** - Every row action icon uses the same base color, the delete action included; removing an association is the `"unlink"` type
- **SearchPopover (Unified Searchable Assignment)** - Unified searchable assignment popover (trigger + search + flat/grouped items) - replaces hand-rolled Popover+Command
- **SelectField Compact Mode** - `FormFields.SelectField compact` for table-cell / toolbar selects - modules never import raw Select primitives
- **Awaitable Cache Invalidation (useInvalidateEntity)** - `useInvalidateEntity` returns `() => Promise<void>` and calls `queryClient.invalidateQueries(...)` directly (n
- **SaveButton (Unified Save Button with isDirty + Validation)** - Save button with isDirty / isSaving / validation-count state built in - no hand-rolled primary save Button
- **Enum SelectField options - derive from the generated enum, not a hardcoded array** - When a `SelectField` offers the FULL set of an enum's values, derive options from the generated domain enum co
- **groupValidationErrors (no inline validation-error grouping loops)** - In hand-rolled mutation `.catch`/`onError` handlers, group server validation errors with the framework helper,
- **createEntityOptions (FK options loader factory)** - An FK entity's `{ label, value }` options - shared by its `EntityCombobox` picker and any faceted filter over 

## Layout primitives, chrome & structural composition → `registry/layout-and-chrome.md`

- **ListDetail Dialog Height Control** - `ListDetail` dialog variant (`variant="dialog"`) supports a `dialogHeight` prop to control the dialog's height
- **Project layout primitives (section header strip, side-panel list, selectable row, indented sub-section)** - Project-specific composition patterns that live in the project's UI package `layout` entry, not in `@simplix-react/ui`; the names are the project's own
- **Layout primitive variants (Stack / Grid)** - Scroll bodies use `<Stack flex overflow="auto">` (not `<div className="flex-1 overflow-y-auto">`); fixed cells
- **AssignmentChip trailing slot** - `AssignmentChip` accepts a `trailing?: ReactNode` slot rendered between the label and the remove button. Use i
- **Section variant convention (detail=flat / form=card)** - Every read-only `CrudDetail.Section` uses `variant="flat"`; every write `CrudForm.Section` uses `variant="card
- **A domain's editor primitives (@<scope>/<ui-package>/<domain>)** - Placeholder: editor chrome several editors draw the same way is one UI-package component; the edge handle and its constants are declared to the audit in `.claude/simplix.json`

## List toolbars, filters & counts → `registry/lists-and-filters.md`

- **ListTotalBadge (the "Total N" badge the FilterBar draws)** - A list's total badge is drawn by the FilterBar's `count` prop, which renders `ListTotalBadge` internally - never passed through `leading`
- **Reference filter and picker (user-account references as the example)** - A filter over a reference field is a `faceted` dropdown fed by the entity's options or facet loader (`createEntityOptions`, `createEntityFacet`), never a raw-id text filter; a form picks the reference through a server-searched `createEntitySearch` hook drawn by `EntitySearchCombobox`
- **useFilterBarState (FilterBar on non-CrudList surfaces)** - A surface whose query is NOT a `useCrudList` list (an aggregation report, a dashboard section, a custom endpoi
- **FilterBar count prop (the one total badge)** - The "전체 N건" badge comes from the FilterBar's `count` prop, which renders the shared `ListTotalBadge` internall
- **Figure strip placement (page-level strip only)** - On a page with an always-visible figure strip, tab bodies must NOT render their own tiles or stat cards; tab-level aggregates live in the FilterBar toolbar line

## Domain-shared widgets (calendar chrome and per-domain widgets) → `registry/domain-widgets.md`

- **CalendarShell / CalendarApiBridge / CalendarColorLegend (calendar package)** - Every calendar screen composes its chrome from the calendar package, inside a `CalendarProvider`:
- **A widget several boards of one domain draw (@<scope>/<ui-package>/<domain>)** - Placeholder: one component per domain in the UI package, and one lifecycle predicate table in the module's `features/`; the project's registry names them

## Machine-checked rules

Every rule of `${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs` is listed here, either under the registry entry whose pattern it guards or under the invariant it enforces. `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs" --list` prints each rule's id, level (`error` must be 0, `review` is judged), provenance and description; a rule added to the script is added to this section in the same change.

### Rules that guard a registry entry

| Registry entry | Rule ids |
| --- | --- |
| Shared search popover (SearchPopover) | `command-primitives` |
| SelectField compact mode | `raw-select-import` |
| Loading indicator (Button `loading` prop) | `loader-spinner`, `spinner-beside-mark` |
| Status tone system, domain tone maps, status badge | `status-map-resurrect`, `inline-dark-tone-map`, `per-screen-enum-badge`, `status-badge-enlarged` |
| A domain's editor primitives (edge handle and shared constants) | `cursor-col-resize`, `drag-threshold-copy` |
| System field exclusion | `system-field-exposure`, `soft-delete-field-drawn` |
| ID/UUID exposure prevention | `header-id-title`, `delete-confirm-id`, `hand-typed-id` |
| Empty state | `empty-slot-returns-nothing`, `scope-filter-empty-state` |
| DetailListRow / LabeledField (fixed-height label and value rows) | `wrapping-value-in-fixed-row`, `long-value-in-a-label-row` |
| FilterBar count prop (the one total badge) | `filterbar-total-badge-in-leading` |
| Peek label and peek host | `peek-label-takes-onpeek` |
| Row action standardization | `row-action-that-reads-as-text`, `row-action-type-fixed-under-a-varying-label`, `row-action-that-only-some-rows-draw`, `row-actions-as-nameless-column` |
| Layout primitive variants (Stack / Grid) | `raw-layout-div`, `wrap-string-prop`, `split-row-without-a-width` |

### Rules owned by an invariant

These rules guard a convention that has no shared component to register; the invariant (SKILL.md, full form in `invariants.md`) holds the reason, and the rule's description holds the defect.

| Invariant (the first one the rule cites) | Rule ids |
| --- | --- |
| #2 | `mutator-does-not-unwrap-the-boot-envelope` |
| #3 | `list-adapter-spreads-a-filters-property-that-is-not-there`, `unfrozen-now-in-a-request`, `comma-in-sort-token` |
| #4 | `schemas-file-exports-a-type` |
| #5 | `package-export-without-source`, `package-types-not-source` |
| #8 | `dead-dialog-width` |
| #10 | `unknown-enum-name`, `unresolved-boot-enum-label`, `boot-enum-read-through-a-cast`, `boot-enum-stringified-with-a-nullish-default`, `lowercase-enum-label`, `enum-default-unresolved` |
| #12 | `callback-prop-names`, `callback-done-name` |
| #13 | `filterbar-maxbadges` |
| #14 | `boolean-faceted` |
| #15 | `chip-filter-equality-field` |
| #16 | `filter-category-order` |
| #21 | `card-drops-status` |
| #22 | `hand-written-empty-placeholder` |
| #27 | `markdown-code-fence-without-language` |
| #30 | `hand-written-endpoint-url`, `mock-seed-missing` |
| #31 | `hand-rolled-detail-footer`, `list-detail-page-root-hands-down-no-height` |
| #31a | `local-page-heading` |
| #31c | `page-root-padding` |
| #32 | `unpaged-table-without-reason`, `list-search-mapped-by-hand`, `paged-list-in-a-page-not-generated-as-a-list`, `forced-list-keeps-a-stale-page`, `capped-embedded-list`, `forced-narrowing-in-transform-filters` |
| #33 | `read-failure-reads-as-loading`, `read-failure-falls-through-loading-guard`, `read-failure-reads-as-empty`, `form-seeded-from-read-without-error-branch`, `link-acts-before-it-reads`, `silent-mutation-outcome` |
| #34 | `batch-update-built-from-a-list-read`, `optional-select-cannot-be-emptied`, `write-only-form-field`, `create-and-update-share-one-body`, `update-body-enumerated` |
| #36 | `instant-formatted-by-hand`, `enum-label-empty-fallback`, `stringified-boot-enum`, `unitless-rate-field`, `panel-record-from-list-page` |
| #37 | `native-time-input`, `local-time-helper-copy` |
| #38 | `full-enum-options`, `two-state-branching` |
| #39 | `deleted-toggle-filter`, `uuid-audit-filters` |
| #40 | `a-form-reports-a-refusal-as-a-toast`, `silent-clipboard-copy`, `refusal-told-twice` |
| #42 | `browser-zone-offset-math` |
| #44 | `translator-options-arg` |
| #46 | `outward-action-without-confirmation` |
| #52 | `ungated-create-button`, `inline-permission-group`, `unsubscribed-access-policy-read`, `ungated-entity-action`, `gated-callback-wrapped-in-an-always-truthy-arrow` |
| #55 | `one-message-for-several-states` |
| #58 | `unbounded-overlay-panel`, `second-viewport-ceiling-inside-a-dialog` |
| #61 | `permission-blanked-tab` |
| #63 | `tab-panel-repeats-its-tab-name` |
| #67 | `screen-picks-action-variant` |
| #69 | `screen-picks-detail-presentation` |
| #70 | `translation-frozen-at-mount` |
| #71 | `paged-panel-collection-is-not-a-list`, `bounded-table-without-its-border` |
| #72 | `audit-strip-outside-the-first-tab` |
| #77 | `session-token-read-from-the-query-string` |
| #79 | `blocks-file-imports-a-value-from-its-generated-widget`, `important-outline-removal` |
| Scaffold and catalogue wording (locale rules) | `missing-translation-key`, `dropped-interpolation`, `counted-string-without-number-format`, `number-format-on-a-value-that-is-not-a-number`, `translation-key-prefix-table-has-a-dead-entry`, `empty-locale-value`, `locale-missing-sections`, `locale-untranslated`, `ko-particle-after-placeholder`, `scaffold-header-placeholder` |
| Other defects named by the rule itself | `unguarded-route`, `internal-address-as-a-bare-anchor`, `phantom-projection-read`, `unnamed-icon-button`, `jsx-child-line-comment`, `size-shorthand`, `description-as-filter`, `visible-native-file-input`, `single-line-free-text` |

## Adding a new pattern

A pattern the project commonizes is registered where the project can edit it - its own reference under `.claude/`, in the same index-plus-detail shape used here. A pattern that holds for any simplix-react project is contributed upstream to this skill instead of copied per project.

Either way, the shape of an entry is the same:

1. The full section (usage, props, migration recipe, detection greps) in the matching detail file - a new detail file only for a genuinely new category.
2. Its one-line entry in the index under that category.
3. If the pattern is regex-detectable, a rule in the audit script (`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`), a recipe section in `audit-checklist.md`, and the rule's id in the Machine-checked rules section above.
