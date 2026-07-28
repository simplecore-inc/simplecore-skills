# Audit Checklist

Grep patterns to detect violations of commonized patterns. Run these against the frontend modules directory to find regressions or missed migrations.

**Run the automated subset FIRST**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs"` (from the frontend project root) executes the machine-checkable rules — error-level rules must be 0, review-level candidates are judged against each rule's stated exceptions. This document then covers what the script cannot: context-dependent patterns, multiline/judgment sections, and the Usability Audit. When a NEW defect type proves regex-detectable, add it as a rule in the script (not only here) — a recipe that only lives in prose gets run less often than one wired into the script.

## Page Chrome Violations (local page titles / ad-hoc page padding)

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Local Heading used as a page title (high confidence)**
```bash
# Page components must delegate the title to usePageHeader; a level-1/2 Heading in a pages/ file is a page title
grep -rnE "<Heading level=\{[12]\}" --include="*.tsx" modules/*/src/pages/
```
Expected: 0 results
Exception: Headings inside a detail/form header slot (e.g. `header={<Heading …>}`) are panel chrome, not page titles; level ≥3 headings are in-content section titles

**Pattern 2 — Page missing usePageHeader (high confidence)**
```bash
# Every routed page component registers its title with the layout
grep -rLn "usePageHeader" --include="*-page.tsx" modules/*/src/pages/*/
```
Expected: 0 results (every page file registers a header)
Exceptions: standalone screens outside the app layout (login); thin wrapper pages that delegate to a view/crud component which itself calls `usePageHeader` (verify the delegate before marking a violation)

**Pattern 3 — Ad-hoc page padding wrapper (medium confidence)**
```bash
# The app layout owns page padding; pages must not add their own
grep -rn 'className="[^"]*p-4' --include="*.tsx" modules/*/src/pages/
```
Expected: 0 results
Exception: Padding on inner cards/sections (verify the class is not on the page root)

**Pattern 4 — Create button outside the header actions slot (medium confidence)**
```bash
# The primary "add/new" button belongs in usePageHeader({ actions }); a local button row above a list is a violation
grep -rn "PlusIcon" --include="*.tsx" modules/*/src/pages/ modules/*/src/widgets/ | grep "Button"
```
Expected: every match is a constant passed into `usePageHeader`'s `actions` (or a row-level action)
Exception: secondary in-content actions that are not the page's primary create action

**Pattern 5 — Detail panel without a scroll container (high confidence, silent defect)**
```bash
# Every component rendered inside <ListDetail.Detail> must own the scroll (invariant #31e):
# CrudDetail / CrudForm, or a custom editor built as `Stack fill` + `Stack flex overflow="auto"`.
# ListDetail.Detail is overflow-hidden, so a bare Stack/Card/Section root is clipped with NO scrollbar.

# 1. list the panel components rendered inside ListDetail.Detail
grep -rn -A6 "<ListDetail.Detail>" --include="*.tsx" modules/ | grep -oE "<[A-Z][A-Za-z0-9]*"

# 2. for each, confirm its definition supplies a scroll chain
grep -rln "CrudDetail\|CrudForm" --include="*.tsx" modules/<module>/src/widgets/<slice>/
grep -rn 'Stack fill\|overflow="auto"' --include="*.tsx" modules/<module>/src/widgets/<slice>/
```
Expected: every panel component matches one of the two skeletons.
Violation smell (and what the operator sees): a hand-rolled `<Flex>` title row with its own `XIcon` close button instead of `CrudDetail`'s header/close, content cut off at the panel's bottom edge, and a primary action (submit, check-in) below the fold that cannot be reached by scrolling.
Verify in the browser — a bare panel reports `scrollHeight > clientHeight` while `overflowY: hidden`:
```js
const d = document.querySelector('article.md\\:order-3');  // ListDetail.Detail
({ clipped: d.scrollHeight > d.clientHeight, overflowY: getComputedStyle(d).overflowY,
   innerScrollable: [...d.querySelectorAll('*')].some(e => ['auto','scroll'].includes(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight) })
// clipped:true + innerScrollable:false → defect
```
Note: passing today proves nothing — short seed data fits the panel. Judge by structure, not by whether it currently overflows.

### Verification After Audit

For each violation found:
1. Move the title (and a description key) into `usePageHeader({ title, description })`
2. Remove the local `Heading` and any page-root padding wrapper
3. Move the primary create button into `usePageHeader`'s `actions`; for tabbed pages, drive the active tab's create dialog through props
4. Rebuild a bare detail panel on `CrudDetail` (`header` = title + status badge, `CrudDetail.Section` per group, `footer` = `CrudDetail.DefaultActions`) — drop the hand-rolled title row and close button, since `CrudDetail` renders the close affordance from `onClose`
4. Confirm the page renders the standard level-1 header from the layout
5. For panel-style list-detail pages, confirm the root is `Stack flex` with no extra `Container`

## EmptyState Violations

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Custom icon-in-circle empty state (high confidence)**
```bash
# Detects the rounded-full bg-muted icon wrapper pattern
grep -rn "rounded-full bg-muted p-4 text-muted-foreground" --include="*.tsx" modules/
```
Expected: 0 results (all should use EmptyState now)
Exception: None — this pattern should only exist inside EmptyState component itself

**Pattern 2 — Flex column centered with py-16 (medium confidence)**
```bash
# Detects centered column layout with large vertical padding (common empty state pattern)
grep -rn 'direction="column" align="center".*py-16' --include="*.tsx" modules/
```
Expected: 0 results
Exception: Non-empty-state centered layouts (verify context)

**Pattern 3 — Font-semibold + text-muted-foreground pair (low confidence, verify context)**
```bash
# Detects title + description text pattern used in old empty states
grep -rn 'text-base font-semibold' --include="*.tsx" modules/ | grep -v "EmptyState"
```
Expected: 0 results in empty state context
Exception: May match legitimate non-empty-state headings — verify each match

### Verification After Audit

For each violation found:
1. Confirm it is an empty/no-data state (not a regular heading or layout)
2. Check if `EmptyState` is already imported in the file
3. If not imported, add import and replace the inline JSX
4. Ensure icon, title, and description props match the original i18n keys
5. Verify no unused imports remain after replacement

## DetailFields Fallback Violations

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Inline ternary fallback for detail fields (high confidence)**
```bash
# Detects custom null checks wrapping DetailFields instead of using built-in fallback
grep -rn 'value.*?.*DetailFields\|DetailFields.*value.*?' --include="*.tsx" modules/
```
Expected: 0 results
Exception: Legitimate conditional rendering not related to fallback

**Pattern 2 — Manual String() conversion hiding null values (medium confidence)**
```bash
# Detects String(value ?? "") which converts null to empty string, bypassing fallback
grep -rn 'String(.*??\s*"")' --include="*.tsx" modules/
```
Expected: 0 results in DetailFields context
Exception: May match legitimate string conversions in non-detail contexts

**Pattern 3 — Hardcoded em-dash outside framework (medium confidence)**
```bash
# Detects hardcoded em-dash fallback that should use DetailFields built-in fallback
grep -rn '??\s*"\\u2014"\|??\s*"—"\|??\s*"—"' --include="*.tsx" modules/
```
Expected: 0 results in detail view context
Exception: Non-detail display locations

### Verification After Audit

For each violation found:
1. Confirm it is in a detail/read-only display context (not a form or list column)
2. Check if the field already uses a DetailFields component
3. If wrapping with custom fallback logic, remove the wrapper and let DetailFields handle it
4. If using `String(value ?? "")`, change to pass `value` directly
5. Verify the em-dash displays correctly after fix

## ID/UUID Exposure Violations

### Detection Patterns

Run from: `modules/`

**Pattern 1 — UUID in detail/form header via translation key (high confidence)**
```bash
# Detects t("xxx.detailHeader", { id: ... }) or t("xxx.editHeader", { id: ... }) pattern
grep -rn 'detailHeader.*id:\|editHeader.*id:' --include="*.tsx" modules/
```
Expected: 0 results
Exception: detail/form widgets of not-yet-implemented modules

**Pattern 2 — Delete confirm using row.id for display name (high confidence)**
```bash
# Detects requestDelete with name: String(row.id) or name: row.id
grep -rn 'requestDelete.*name.*row\.id' --include="*.tsx" modules/
```
Expected: 0 results

**Pattern 2-1 — Delete confirm with UUID fallback when name is null (high confidence)**
```bash
# Detects requestDelete where name falls back to row.id or any .id when display field is null
grep -rn 'requestDelete.*?? row\.id\|requestDelete.*?? .*\.id)' --include="*.tsx" modules/
```
Expected: 0 results
Exception: None — name fallback must be empty string `""`, never UUID

**Pattern 3 — FK field displaying raw UUID instead of nested object name (medium confidence)**
```bash
# Detects String(displayData.xxxId) in detail views (potential UUID exposure)
grep -rn 'String(displayData\.\w*Id)' --include="*.tsx" modules/
```
Expected: 0 results in user-facing display context
Exception: Internal API call parameters (not displayed to user)

**Pattern 4 — ID fallback in displayName/header variables (medium confidence)**
```bash
# Detects patterns like ?? String(entityId) used as display name fallback
grep -rn 'displayName.*String.*Id)\|levelName.*String.*Id)\|areaName.*String.*Id)' --include="*.tsx" modules/
```
Expected: 0 results

**Pattern 5 — Form header with ReactNode prop instead of isEdit (medium confidence)**
```bash
# Detects FormInner interfaces still using header?: ReactNode pattern
grep -rn 'header?: ReactNode' --include="*.tsx" modules/
```
Expected: 0 results (all forms should use isEdit pattern for live title)
Exception: Components that are NOT Outer/Inner form pattern

**Pattern 6 — Fallback to UUID when nested object is unavailable (medium confidence)**
```bash
# Detects ?? data.xxx.xxxId or ?? data.xxxId patterns used as fallback display
grep -rn '?? data\.\w*\.\w*Id\|?? root\.\w*Id' --include="*.tsx" modules/
```
Expected: 0 results in user-facing display context
Exception: Internal logic, form value processing

### Verification After Audit

For each violation found:
1. Confirm the UUID is displayed to the user (not just used internally)
2. Check if a nested object with `.name` is available in the DTO
3. If nested object exists, use `nestedObj?.name ?? "—"` pattern
4. If no nested object, pass name from parent component as a separate prop
5. For delete confirm, use `row.name` or appropriate display field
6. For form headers, move header to inner component with `isEdit` prop
7. Verify no raw UUID strings appear in the rendered UI

## System Field Exposure Violations

### Detection Patterns

Run from: `modules/`

**Pattern 1 — System field rendered in detail view (high confidence)**
```bash
# Detects DetailFields displaying id, sortOrder, or displayOrder
grep -rn 'fieldLabel("id")\|fieldLabel("sortOrder")\|fieldLabel("displayOrder")' --include="*.tsx" modules/ | grep -i "detail"
```
Expected: 0 results
Exception: None — these fields should only exist in `auditData`, never as visible `DetailFields`

**Pattern 2 — System field rendered as editable form field (high confidence)**
```bash
# Detects FormFields for system fields (id, sortOrder, displayOrder)
grep -rn 'fieldLabel("id")\|fieldLabel("sortOrder")\|fieldLabel("displayOrder")' --include="*.tsx" modules/ | grep -i "form"
```
Expected: 0 results
Exception: None — system fields must never be editable

**Pattern 3 — Commented-out system field JSX (medium confidence)**
```bash
# Detects commented-out system field form inputs (dead code)
grep -rn '{/\*.*fieldLabel("id")\|{/\*.*fieldLabel("sortOrder")\|{/\*.*fieldLabel("displayOrder")' --include="*.tsx" modules/
```
Expected: 0 results
Exception: None — commented-out code should be removed, not left as dead code

### Verification After Audit

For each violation found:
1. Confirm the field is `id`, `sortOrder`, or `displayOrder` (system-managed)
2. In detail views: remove the `DetailFields.*` component entirely
3. In form views: remove the `FormFields.*` component but keep the field in `FormValues`, state, and `handleSubmit`
4. Change state to read-only pattern: `const [field] = useState(...)` (no setter)
5. Remove any commented-out JSX for these fields
6. Verify the form still submits the field values to the server

## SearchPopover Violations (Custom Popover+Command / DropdownMenu for searchable lists)

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Custom Popover+Command inline (high confidence)**
```bash
# Detects direct imports of Command primitives in module widgets (should use SearchPopover)
grep -rn "import.*CommandInput\|import.*CommandItem\|import.*CommandList" --include="*.tsx" modules/
```
Expected: 0 results (all should use SearchPopover now)
Exception: None — modules should never import Command primitives for assignment patterns

**Pattern 2 — DropdownMenu for item assignment (high confidence)**
```bash
# Detects DropdownMenu paired with PlusIcon or "assign" pattern
grep -rn "DropdownMenuTrigger" --include="*.tsx" modules/ | grep -i "assign\|add\|<assignment-target>"
```
Expected: 0 results
Exception: DropdownMenu used for non-search context menus (right-click, action menus)

**Pattern 3 — Manual Popover+Command open state management (medium confidence)**
```bash
# Detects manual Popover open/close state for search popovers
grep -rn "PopoverTrigger.*Button.*PlusIcon\|PopoverTrigger.*Button.*Plus" --include="*.tsx" modules/
```
Expected: 0 results
Exception: None — SearchPopover manages its own open state

### Verification After Audit

For each violation found:
1. Confirm it is a searchable assignment pattern (not a context menu or other dropdown)
2. Replace with `SearchPopover` — use `items` for flat lists, `groups` for grouped lists
3. Ensure `onSelect` receives the full item object
4. Remove all Popover/Command/DropdownMenu primitive imports that become unused
5. Verify trigger button text matches the original via i18n key

## SelectField Compact Violations (Raw Select in table cells)

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Raw Select with compact styling (high confidence)**
```bash
# Detects raw SelectTrigger with h-8 compact class (should use SelectField compact)
grep -rn "SelectTrigger.*h-8\|SelectTrigger.*w-40\|SelectTrigger.*text-sm" --include="*.tsx" modules/
```
Expected: 0 results
Exception: None — all compact selects should use FormFields.SelectField compact

**Pattern 2 — Direct Select import for non-form usage (medium confidence)**
```bash
# Detects direct import of Select primitives (SelectTrigger, SelectContent, etc.)
grep -rn "import.*SelectTrigger\|import.*SelectContent\|import.*SelectItem" --include="*.tsx" modules/
```
Expected: 0 results (modules should use FormFields.SelectField)
Exception: None in modules — raw Select is only for framework internals

**Pattern 3 — Fixed width on compact selects (medium confidence)**
```bash
# Detects fixed width class applied to SelectField for table cells
grep -rn 'SelectField.*className.*w-\d\|SelectField.*w-40\|SelectField.*w-48' --include="*.tsx" modules/
```
Expected: 0 results (compact mode uses auto-width)

### Verification After Audit

For each violation found:
1. Confirm it is a compact/inline select (no label, used in table or toolbar)
2. Replace with `FormFields.SelectField compact`
3. Convert options to `{ label, value }` format if needed
4. Remove raw Select/SelectTrigger/SelectContent/SelectItem imports
5. Do NOT apply fixed width — let `w-auto` handle sizing

## Awaitable Cache Invalidation Violations (Inline Editor Stale Flash)

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Fire-and-forget invalidate before state reset (high confidence)**
```bash
# Detects invalidate() followed by reset() without await
grep -rn "invalidate();" --include="*.tsx" modules/ | grep -v "await invalidate"
```
Expected: Only matches in `.mutate()` callbacks (fire-and-forget is OK there)
Exception: `onSuccess`/`onError` callbacks in `.mutate()` options — these are fire-and-forget by design

**Pattern 2 — Non-awaited invalidate after mutateAsync in try block (high confidence)**
```bash
# Detects await mutateAsync followed by non-awaited invalidate in same block
grep -B2 "invalidate();" --include="*.tsx" modules/ | grep "mutateAsync"
```
Expected: 0 results (all mutateAsync + invalidate combos should use await)

**Pattern 3 — Non-async .then callback with invalidate (medium confidence)**
```bash
# Detects .then(() => { invalidate() }) without async
grep -rn "\.then((" --include="*.tsx" modules/ | grep -v "async"
```
Expected: Review each match — if invalidate() is called inside, callback should be async

### Verification After Audit

For each violation found:
1. Confirm it is an inline editor (component stays mounted after save, no navigation)
2. If `await mutateAsync` + `invalidate()`: add `await` before `invalidate()`
3. If `.then(() => invalidate())`: change to `.then(async () => await invalidate())`
4. If `.mutate()` callback: no change needed (fire-and-forget is correct)
5. Verify no stale data flash after save

## SaveButton Violations (Manual save button instead of SaveButton component)

### Detection Patterns

Run from: `modules/`

**Pattern 1 -- Save button without SaveButton component (high confidence)**
```bash
# Detects Button with variant="primary" + loading prop (should use SaveButton)
grep -rn 'variant="primary".*loading=' --include="*.tsx" modules/ | grep -v "SaveButton"
```
Expected: 0 results for save/submit buttons
Exception: Non-save primary buttons (e.g., navigation, action buttons)

**Pattern 2 -- Missing isDirty on save button (high confidence)**
```bash
# Detects SaveButton without isDirty prop in edit contexts
grep -rn "SaveButton" --include="*.tsx" modules/ | grep -v "isDirty"
```
Expected: Only creator files (where isDirty is intentionally omitted)
Exception: Create-only forms

**Pattern 3 -- Manual isDirty comparison without useIsDirty hook (medium confidence)**
```bash
# Detects manual JSON.stringify or deep comparison for form dirty state
grep -rn "JSON.stringify.*initial\|JSON.stringify.*default" --include="*.tsx" modules/
```
Expected: 0 results (use useIsDirty hook instead)

### Verification After Audit

For each violation found:
1. Replace Button with SaveButton, passing isDirty/isSaving/validationCount
2. For CrudForm files: add useIsDirty(values, initialValues) hook
3. For Editor files: pass existing isDirty computation to SaveButton
4. For Creator files: omit isDirty (default=true)
5. Remove manual disabled/loading/loadingText props

---

## Loading Indicator Violations (Manual disabled + ternary instead of Button loading)

### Detection Patterns

Run from: `modules/`

**Pattern 1 -- Manual disabled with isPending/isSaving (high confidence)**
```bash
# Detects buttons with manual disabled={...isPending} or disabled={...isSaving} pattern
grep -rn "disabled={.*isPending\|disabled={.*isSaving\|disabled={.*\.isPending}" --include="*.tsx" modules/ | grep -i "button"
```
Expected: 0 results (all should use Button `loading` prop)
Exception: Non-Button elements (e.g., form fields, SearchPopover) that legitimately use disabled

**Pattern 2 -- Ternary text swap for loading state (high confidence)**
```bash
# Detects isPending/isSaving ternary for button text
grep -rn "isPending ? t(\|isSaving ? t(\|\.isPending ? t(" --include="*.tsx" modules/
```
Expected: 0 results (all should use Button `loadingText` prop)
Exception: Non-button contexts (status text, badges)

**Pattern 3 -- Manual Loader2/spinner icon in button (high confidence)**
```bash
# Detects manual spinner icons inside buttons
grep -rn "Loader2\|animate-spin" --include="*.tsx" modules/ | grep -v "node_modules"
```
Expected: 0 results in module code (Button component handles spinner internally)
Exception: Standalone spinners not inside buttons (e.g., loading overlays)

**Pattern 4 -- Missing isPending on DefaultActions (high confidence)**
```bash
# Detects DefaultActions without isPending prop
grep -rn "DefaultActions" --include="*.tsx" modules/ | grep -v "isPending"
```
Expected: Only matches where no delete mutation exists (read-only detail views)
Exception: read-only detail views without a delete mutation

### Verification After Audit

For each violation found:
1. Identify the isPending/isSaving source (mutation.isPending, useCrudFormSubmit, custom state)
2. Replace `disabled={isPending}` + ternary text with `loading={isPending} loadingText={t("...")}`
3. Keep non-loading `disabled` conditions separate (e.g., `disabled={!isDirty}`)
4. For DefaultActions, add `isPending={deleteMutation.isPending}`
5. Remove unused Loader2/spinner imports
6. Verify loading state visually in the UI

---

## Status Tone Violations (inline enum→color maps instead of STATUS_TONES / project UI-package tone maps)

### Detection Patterns

Run from: `modules/`

**Pattern 1 — Inline enum→Tailwind-color map with dark: classes (high confidence)**
```bash
# A Record<...> literal in a widget that hand-writes dark: status colors -> should be a project UI-package tone map + StatusBadge/StatusDot
grep -rlnE "Record<[^>]*>\s*=\s*\{" --include="*.tsx" modules/ | xargs grep -lE "dark:bg-(red|green|emerald|amber|blue|orange|slate)-[0-9]" 2>/dev/null
```
Expected: 0 (status maps live in the project-local UI package, e.g. `@<scope>/<ui-package>/{status,...}`)
Exception: categorical (non-status) palettes — `CATEGORY_COLORS`, `<ENTITY>_TYPE_COLORS`, `TYPE_ICONS`, page-level entity icon-color maps. Verify the map encodes STATUS/SEVERITY, not arbitrary category hues.

**Pattern 2 — Resurrected named status maps (high confidence)**
```bash
# Replace the alternation with the project's actual resurrected status/severity map names
grep -rnE "STATUS_COLORS|SEVERITY_COLORS|severityConfig|<status-map-name>" --include="*.tsx" modules/
```
Expected: 0 (all replaced by the project-local shared tone maps)

**Pattern 3 — Raw status dot span (medium confidence)**
```bash
grep -rnE "rounded-full (bg-(emerald|red|amber|blue|slate)-[0-9])" --include="*.tsx" modules/
```
Expected: 0 — use `<StatusDot tone=... />`. Exception: documented `{/* raw layout: ... */}` bitmap chips.

## AlertBanner Violations (inline tone notice boxes)

```bash
# rounded tone box with dark: border/bg -> should be AlertBanner
grep -rnE 'rounded-md border.*(border-(red|amber|blue|emerald|orange)-200).*(bg-(red|amber|blue|emerald|orange)-50)' --include="*.tsx" modules/
```
Expected: 0 — use `<AlertBanner tone=... density=... />`. Also: `grep -rn "AlarmCallout\|InfoHint\|WarningHint" modules/` should be 0 (promoted to AlertBanner).

## StatCard Tint Violations

```bash
# conditional className tint ternary on a StatCard -> should be tone + highlighted
grep -rnE "StatCard" --include="*.tsx" modules/ -A6 | grep -E "className=\{.*\?.*(border-|bg-).*(50|950)"
```
Expected: 0 — use `tone=... highlighted={cond}`.

## Project Layout Composition Violations (SectionHeaderBar / PanelList / SelectableListItem / IndentedSubsection)

```bash
# Raw section header strip
grep -rnE '(border-b|className=)[^>]*bg-muted/(30|40|50|60)[^>]*px-' --include="*.tsx" modules/ | grep -iE "justify-between|font-semibold"
# Raw selectable row
grep -rnE 'bg-primary/10 (text-primary|font-medium)' --include="*.tsx" modules/
# Raw indented sub-section
grep -rnE 'border-l-2 border-border/50 pl-4' --include="*.tsx" modules/
# Hand-rolled side-panel state machine (inline <Skeleton> loading list under a panel header) -> PanelList
grep -rnE '(Array\.from\([^)]*\)|\.map\([^)]*\))[^;]*<Skeleton' --include="*.tsx" modules/
```
Expected: 0 — adopt the project-local layout primitives (e.g. `SectionHeaderBar` / `PanelList` / `SelectableListItem` / `IndentedSubsection`) from the project UI package's `layout` entry (`@<scope>/<ui-package>/layout`). Exception: documented raw-layout exemptions (e.g. a `PanelList` whose loading/empty branches are not a header + list state machine).

## LabeledField Violations (re-inlined label + control settings row)

```bash
# Flex justify-between settings rows that LabeledField / SettingSwitch commonizes
grep -rnE 'justify="between"|justify-between' --include="*.tsx" modules/ | grep -iE "settings|preset|advanced|switch|toggle"
# Manual label + <p text-xs muted> + control idiom (the row LabeledField replaces)
grep -rnE 'text-xs text-muted-foreground' --include="*.tsx" modules/ | grep -iE "switch|select|toggle|setting"
```
Expected: 0 settings rows hand-building `Flex justify-between` + `Label` + `<p text-xs muted>` + a single control. Use `LabeledField` (or `SettingSwitch` for the switch case) from `@simplix-react/ui`. Exception: rows whose right side is a multi-control toolbar, not a single control.

## DetailList Violations (re-inlined bordered icon + primary + trailing rows)

```bash
# Bordered rounded list container that DetailList commonizes
grep -rnE 'overflow-hidden rounded-lg border' --include="*.tsx" modules/
# Hand-written fixed-height bordered rows (the DetailListRow idiom)
grep -rnE 'h-10[^"]*border-b[^"]*px-4|border-b[^"]*last:border-b-0' --include="*.tsx" modules/
```
Expected: 0 — use `DetailList` / `DetailListRow` from `@simplix-react/ui`. Exception: `CrudList` tables / form field groups (different primitive).

## ActivityList Violations (hand-rolled recent-activity / event-feed lists)

```bash
# Duplicated relative/absolute time helpers that ActivityList owns internally
grep -rnE '(function|const) format(Relative|Absolute)Time' --include="*.tsx" --include="*.ts" modules/
# Hand-rolled recent-events / recent-activity / entity-feed markup
grep -rnE 'recent-?events|recent-?activity|activity-feed|EntityFeed' --include="*.tsx" modules/
```
Expected: 0 — use the project-local activity-list primitive (e.g. `ActivityList` from `@<scope>/<ui-package>/activity`), which owns its relative-time formatter and empty state and renders rows from a shared row model. Exception: feeds with bespoke per-row interaction not expressible via that shared row model.

## ContextBreadcrumb Violations (inline site/building/floor location strips)

```bash
# Inline hierarchy chain (replace <Level1|Level2|Level3> with the project's location/category segment labels) using a raw '/' or non-standard separator
grep -rnE '(<Level1>|<Level2>|<Level3>)[^<]*</[^>]*>[^<]*[/›»·]' --include="*.tsx" modules/
# Manual separator literal between hierarchy segments
grep -rnE 'className="[^"]*text-border[^"]*">\s*[/·›»]\s*</span>' --include="*.tsx" modules/
```
Expected: 0 — use the project-local breadcrumb primitive and its segment builder (e.g. `ContextBreadcrumb` + `buildSpatialSegments` from `@<scope>/<ui-package>/spatial`), with a standardized separator (e.g. `ChevronRight`). Exception: non-hierarchy breadcrumbs (router path, category trees).

## Raw Layout Div Violations (#8)

```bash
# Raw layout div without a justification comment on the 2 preceding lines
grep -rnE '<div className="[^"]*(flex|grid|space-y|space-x|mx-auto|items-|justify-)' --include="*.tsx" modules/ --exclude-dir=node_modules --exclude-dir=dist
```
Expected: every hit either uses `Flex`/`Stack`/`Grid` (+ the `overflow`/`shrink`/`minSize`/`gap="px"`/`template` variants) OR carries a `{/* raw layout: <reason> */}` justification comment (absolute drag/resize handles, konva/canvas hosts, custom time-grid cells, bitmap chips, container-query responsive rows, arbitrary grid templates).

## ResizeHandle Violations (inline edge resize handle on draggable bars)

```bash
# Inline edge resize handle wrapper (should be the project-local ResizeHandle from @<scope>/<ui-package>)
grep -rn "cursor-col-resize" --include="*.tsx" modules/
```
Expected: only documented parity-coverage handle exceptions (e.g. a single grid file with centered arrow icons). Every left/right edge grip on a draggable bar (e.g. range bars, time blocks) MUST use `<ResizeHandle side=... onPointerDown=... />`. Exception: canvas/konva vertex handles are not edge resize grips.

```bash
# Local DRAG_THRESHOLD_PX redefinition (should import from the project-local UI package)
grep -rn "const DRAG_THRESHOLD_PX" --include="*.tsx" modules/
```
Expected: 0 — import `DRAG_THRESHOLD_PX` from `@<scope>/<ui-package>` so the tap-vs-drag boundary stays unified.

---

## Usability Audit — the screen must be usable, not merely render

These checks catch the class of defect a compiler cannot: a screen that renders perfectly and still cannot be used. Run them after any CUSTOMIZE task, and whenever a module's backend contract changed.

### 1. Unreachable lifecycle actions (invariant #33)

```bash
# Every entity-scoped action the backend exposes …
grep -rhoE '@(Post|Put|Patch|Delete)Mapping\("/\{[a-zA-Z]+\}/[^"]*"\)' ../<backend>/modules/<m>/src/main/java --include='*.java' | sort -u
# … and the hooks the frontend actually calls
grep -rhoE "use[A-Z][A-Za-z]+" packages/domain-<m>/src/generated/endpoints/*/*.ts | sort -u
```
For each action hook, `grep -rl "<hook>" modules/ apps/`. Expected: every action reachable from a screen. A hit of 0 is either a defect (attach it) or dead backend surface (say which, and why).

State-exit check: for each status an entity can hold, name the affordance that leaves it. A status with no exit (an assigned card, a stuck submission, a settled week) is a defect even when nothing is broken on screen.

### 2. Form fields the DTO accepts but the form never writes (invariant #34)

```bash
# Fields of the create DTO …
grep -oE "^  [a-zA-Z]+\??:" packages/domain-<m>/src/generated/model/<entity>CreateDTO.ts
# … versus the form's value shape
grep -A 20 "interface .*FormValues" modules/<m>/src/widgets/<entity>/form.tsx
```
Expected: every DTO field is edited, deliberately server-owned, or deliberately out of scope. A collection field (participants, items, members) that the form cannot write usually means the record is unusable downstream.

```bash
# An id the user cannot possibly know, typed by hand
grep -rn 'FormFields.TextField' -B 2 modules/*/src/widgets/*/form.tsx | grep -iE 'fileId|attachmentId|[a-z]+Id"'
```
Expected: 0 — ids come from a picker; files come from the framework file field (`FormFields.FileField` + `createFileFieldApi`).

### 3. Edit offered on frozen content (invariant #35)

```bash
grep -rn '{ type: "edit"' modules/*/src/pages/*/crud-page.tsx | grep -v "when:"
grep -rn "onEdit={onEdit}" modules/*/src/widgets/*/detail.tsx
```
Expected: for any entity with an approval or closing lifecycle, both are gated (`when: (row) => resolveBootEnum(row.requestStatus) === "DRAFT"`). Then prove the server agrees: `PUT` the entity after approval and expect 409, not 200.

### 4. Server values echoed instead of rendered (invariant #36)

```bash
# boot enum handed straight to a select — renders blank, submits an object
grep -rn 'defaultValues?\.[a-zA-Z]*\(Status\|Type\|Kind\|Unit\|Mode\) ??' modules/*/src/widgets/*/form.tsx | grep -v resolveBootEnum
# an Instant rendered as a date — the time is silently dropped
grep -rn -A 3 "DetailFields.DetailDateField" modules/*/src/widgets/*/detail.tsx | grep -E 'value=\{[^}]*(At|Time)\b' | grep -v 'format='
# a panel titled with an id
grep -rn "isEdit ? (values.[a-zA-Z]*Id as string)" modules/*/src/widgets/*/form.tsx
```
Expected: 0 each. Enum defaults go through `resolveBootEnum(x) || "DEFAULT"`; instants render with `format="datetime"`; panel titles carry a name (`useUserNames().nameOf`).

### 5. Failure messages (invariant #37)

```bash
# a literal English message thrown from a service reaches the user's dialog verbatim
grep -rnoE '(conflict|badRequest|notFound|forbidden)\("[^{][^"]*"\)' ../<backend>/modules/*/src/main/java
```
Expected: 0 — every user-facing throw carries `"{error.<module>.<case>}"` with ko/en/ja filled. Then trigger one failure per screen and confirm the dialog's primary line is the server's reason, not a generic per-code sentence.

### 6. Time-of-day inputs (invariant #37)

```bash
# a native time input or a free-text HH:mm stands in for FormFields.TimeField
grep -rn 'type: "time"' --include="*.tsx" modules/ apps/
grep -rn 'placeholder="HH:mm"' --include="*.tsx" modules/ apps/

# a per-module copy of the LocalTime <-> TimeValue conversion
grep -rn "function .*[Ll]ocalTime\|function timeString" --include="*.tsx" modules/ apps/
```
Expected: 0 each. Every wall-clock field uses `FormFields.TimeField` with the shared `parseLocalTime` / `formatLocalTime` (detail rows: `displayLocalTime`) from the project's shared UI package. Then open each form and confirm an OPTIONAL time has a gate (mode select or `SwitchField`) — a picker showing `12:00 AM` while the DTO carries nothing is the defect this catches.

---

## Adding New Audit Patterns

When a new component is commonized:
1. Add a new section with the component name as heading
2. Provide 2-3 grep patterns at varying confidence levels
3. Note expected results and exceptions
4. Include verification steps specific to the pattern

### 7. Server-constrained choices and dead-end states (invariant #38)

```bash
# the full enum offered as options where the server narrows the set per record
rg -n 'Object\.values\([A-Z][a-zA-Z]+\)\.map' modules apps --glob '*.tsx'

# two-state presence/status branching — the third state falls into the wrong arm
rg -n 'presence === "|status === "' modules apps --glob '*.tsx' | rg -v '\?\?|switch'
```
Review each hit against the server's guard: if a service rejects a value for this record (`visitType.getCheckInChannels().contains(...)`, `if (status == CHECKED_OUT) throw`), the DTO must publish the allowed set / the terminal flag and the UI must respect it. Then drive one rejection per screen in the browser: a desk operator who is refused twice on the default option is the defect this catches.

### 8. Filter hygiene (invariant #39)

```bash
# UUID and audit-stamp filters the scaffold emitted and nobody searches by
rg -n 'field: "[a-zA-Z]+Id", label: fieldLabel\("[a-zA-Z]+Id"\), operators: \[SearchOperator\.EQUALS\]' modules --glob '*/list.tsx'
rg -n 'field: "(createdAt|updatedAt)"' modules --glob '*/list.tsx'

# the scaffold's soft-delete toggle — an implementation flag, not an operator axis
rg -n 'type: "toggle", field: "deleted"' modules --glob '*/list.tsx'

# a long filter form still rendered as one column
rg -L 'popoverColumns' modules --glob '*/list.tsx' | xargs rg -c '\{ type: "' | rg ':[6-9]|:[0-9]{2}'
```
Expected: 0, 0, 0, and no long-form single-column lists. Then open the popover and read it as the persona — the axis they search by every day must be the first field. When pruning leaves a screen without its natural axis (the work date, the leave type), ADD that axis (dateRange on the domain date, faceted over the reference's names) — pruning alone is half the fix.

### 9. Ungated admin API calls in shared hooks (permission-blind fetches)

A shared name-resolver / options hook that unconditionally calls an admin batch list (`/admin/**` search) turns every non-admin screen that embeds it into a 403 error dialog for ordinary users — even though the DTOs already carry server-enriched names.

```bash
# shared hooks calling an admin list without a permission gate
rg -n 'useList[A-Za-z]+\(\{ page: 0, size: 1000 \}\)' packages/*/src modules/*/src --glob '*.ts*' | rg -v 'enabled'
```
Review each hit: if the endpoint is `@PreAuthorize hasPermission(...)`-gated and the hook is consumed from a self-service surface, gate the query with `useCan(<action>, <GROUP>)` → `{ query: { enabled } }` and let the display fall back to the DTO's enriched name. Verify in the browser as the least-privileged persona: open the embedding screen and confirm zero denied requests in the network log.

### 10. Calendar-board legend / empty-state / editor-guard violations

A board offering both month and gantt views draws two different color vocabularies (day-status colors vs the gantt bar language), so one static legend misreads in the other family — a late worker's blue work bar decodes as "present" against the status legend. And a grid editor whose default tool is destructive, or whose unsaved edits vanish on navigation, destroys work silently.

```bash
# a board with gantt views whose legend never switches to the bar legend
rg -l 'views=\{?\[[^\]]*"gantt-' modules --glob '*.tsx' | xargs rg -L 'BarLegend'

# a gantt without the explanatory empty state
rg -l 'views=\{?\[[^\]]*"gantt-' modules --glob '*.tsx' | xargs rg -L 'timelineEmptyState'

# grid editors with dirty state but no navigation guard
rg -ln 'dirtyKeys|dirtyCells|unsaved' modules --glob '*.tsx' | xargs rg -L 'ConfirmDialog'
```
Expected: 0 hits each. Then drive the board in the browser: switch month → gantt and read the legend against a bar whose status you know (a late day must not decode as "present"); open a gantt day that has only absences and confirm the empty state explains where they are; paint one editor cell and navigate away, expecting a confirm dialog.

### 11. Search-form uniformity violations (hand-rolled params, filter order, count badge)

Every screen-level query condition — a list's filters AND an aggregation report's parameters (a company + period, an as-of preset) — renders through the ONE search form: `CrudList.FilterBar`. Non-CrudList surfaces drive it with the standalone `useFilterBarState` hook; the total badge comes from the FilterBar `count` prop (which renders the shared `ListTotalBadge`), never a hand-placed badge or a bespoke box.

```bash
# aggregation/report surfaces still rendering query params as inline form fields
rg -l 'FormFields\.(SelectField|DateField)' modules --glob '*report*.tsx' | xargs rg -L 'FilterBar'

# total badge passed via leading instead of the count prop
rg -Un '<CrudList\.FilterBar[^>]{0,200}?leading=\{<ListTotalBadge' --type-add 'tsx:*.tsx' -t tsx modules apps

# filter category-order violations (String/Number -> Date -> Attribute) — heuristic sweep
python3 - << 'PY'
import re, glob
CAT = {"text": 0, "number": 0, "dateRange": 1, "faceted": 2, "toggle": 2, "country": 2, "timezone": 2}
for path in glob.glob("modules/*/src/**/*.tsx", recursive=True):
    for m in re.finditer(r"filters=\{\[(.*?)\]\}", open(path).read(), re.S):
        types = re.findall(r'type:\s*"(\w+)"', m.group(1))
        cats = [CAT.get(t, 9) for t in types]
        if cats != sorted(cats):
            print(path, types)
PY
```
Expected: 0 hits for the first two. The order sweep lists candidates — review each against invariant #16 before reordering (some option-first layouts were user-approved; do not bulk-rewrite without confirmation). Then verify in the browser: every tab of the audited page opens its conditions behind the same 검색 button, applied conditions appear as removable chips, and the total badge is the same pill on every tab.

## Scaffold Locale Default Violations (untranslated widget locale sections)

The scaffold CLI seeds every locale (`modules/<m>/src/locales/widgets/{ko,ja}.json`) with English default strings ("Add New EntityName", "No entityNames found"). A section left untranslated renders an English page title, header action, and empty state on a localized screen — and a `git checkout` of a locale file can silently drop a scaffold-added section entirely, making the app fall back to English.

### Detection Patterns

Run from: the frontend subproject root

```bash
python3 - <<'PY'
import json, glob, re
hits = 0
def walk(obj, path, p):
    global hits
    if isinstance(obj, dict):
        for k, v in obj.items():
            walk(v, f'{path}.{k}', p)
    elif isinstance(obj, str):
        # identifier-style camelCase glued into UI copy with no local-script characters
        if re.search(r'\b[a-z]+[A-Z][a-zA-Z]*s?\b', obj) and not re.search(r'[가-힣ぁ-んァ-ヶ一-龯]', obj):
            print(f'{p}: {path} = {obj}'); hits += 1
for p in glob.glob('modules/*/src/locales/widgets/ko.json') + glob.glob('modules/*/src/locales/widgets/ja.json'):
    walk(json.load(open(p)), '', p)
print('untranslated scaffold defaults:', hits)
PY
```

Also diff section presence across locales — a section existing in `en.json` but missing from `ko.json`/`ja.json` is the git-restore variant of this defect:

```bash
python3 - <<'PY'
import json, glob
for m in glob.glob('modules/*/src/locales/widgets'):
    keys = {}
    for loc in ('en', 'ko', 'ja'):
        keys[loc] = set(json.load(open(f'{m}/{loc}.json')).keys())
    for loc in ('ko', 'ja'):
        missing = keys['en'] - keys[loc]
        if missing:
            print(m, loc, 'missing sections:', sorted(missing))
PY
```

### Verification After Audit

Expected: 0 untranslated defaults, 0 missing sections. Then open each scaffolded screen in the browser and confirm the page title, header action, and empty state read in the active locale (sidebar label and page title must agree).
