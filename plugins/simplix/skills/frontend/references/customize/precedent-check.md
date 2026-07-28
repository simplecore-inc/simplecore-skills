> **CUSTOMIZE** category reference inside this skill. Loaded via the Task Router whenever a task creates a NEW screen (routed page, tab body, board, report, dashboard section, custom editor, dialog flow) or structurally reshapes an existing one. Sibling files: `overview.md`, `framework-components.md`, `recipes.md`.

# Precedent Check — New Screens Are Cloned, Not Invented

Every screen in the project is an instance of a small set of screen shapes. Two screens of the same shape must be structurally indistinguishable — chrome, filters, columns, mutations, delete wiring, empty states — so an operator (and a reviewer) experiences one product, not a collection of one-off pages. This procedure enforces that: **no screen is designed from memory. A new screen starts from two precedent screens read end to end, and ends with a row-by-row parity pass against them.**

## When this procedure is MANDATORY

1. Creating a new routed page (any variant: panel, page, dialog)
2. Creating a new surface inside an existing page — a new tab body, report view, operator board, dashboard section, custom editor
3. Structurally reshaping an existing screen — plain list → tabbed status list, panel crud → always-open board, adding a detail panel to a bare list

Not required for: single-field edits, label / i18n changes, bug fixes that keep the screen's shape. (Local pattern reading per `overview.md` Rule 5 still applies to those.)

## Step 1 — Classify the shape

Assign the new screen to exactly one shape. "None of these" is almost never true — decompose a hybrid into its dominant shape plus additions.

| # | Shape | Signature composition |
| --- | --- | --- |
| 1 | Standard CRUD list (panel) | `ListDetail` + `CrudList` + `CrudForm` / `CrudDetail`, `variant="panel"` |
| 2 | Standard CRUD list (page) | Same widgets, `variant="page"`, view-driven `usePageHeader` titles |
| 3 | Tabbed status list | Status `Tabs` over one shared searchable list, tab counts from `totalElements` |
| 4 | Always-open master-detail board | `ListDetail` with constant `activePanel="detail"` + `listWidth`, auto-select (invariant #49) |
| 5 | Report / aggregation | Standalone `useFilterBarState` FilterBar + aggregate tables / charts (invariant #41) |
| 6 | Dashboard | Status-card strip + summary widgets, no per-tab aggregates |
| 7 | Custom editor | Loading-guard outer + stateful inner + `EditorFooter` (`overview.md` §3b) |
| 8 | Tree CRUD | `CrudTree` + move / reorder dialogs + form/detail panel |
| 9 | Map page | `MapProvider` + markers + optional sidebar list |
| 10 | Calendar board | Calendar composition + legends + fixed header / inner scroll |
| 11 | Wizard / dialog flow | Multi-step dialog driven from a header action or row action |

## Step 2 — Locate TWO precedents

1. **Nearest sibling** — same module (or the closest domain module), same shape.
2. **Best repo-wide match** — the same shape anywhere under `modules/`, preferring the most recently modified implementation (`git log -1 --format="%ci" -- <file>`). The newest screen embodies the most current conventions.

Generate the candidate list first — the screen inventory (`node "${CLAUDE_PLUGIN_ROOT}/scripts/screen-inventory.mjs"`, from the frontend project root) classifies every screen-bearing file into this taxonomy with its last-commit date, newest first per shape (`--shape=<id>` / `--module=<name>` to narrow). Pick the nearest same-module row and the newest same-shape row repo-wide from its output.

Fallback discovery recipes when the script is unavailable (convention-based, no screen names to memorize):

```bash
# Standard CRUD list screens (shapes 1-2)
grep -rln --include="*.tsx" "useCrudList" modules/*/src/widgets/

# Always-open master-detail boards / pinned-detail pages (shape 4)
grep -rln --include="*.tsx" 'activePanel="detail"' modules/*/src/pages/

# Tabbed status lists (shape 3) — tabs and list composed in the same widget file
grep -rln --include="*.tsx" "<Tabs" modules/*/src/ | xargs grep -ln "useCrudList"

# Reports / aggregation surfaces (shape 5)
grep -rln --include="*.tsx" "useFilterBarState" modules/*/src/

# Custom editors (shape 7)
grep -rln --include="*.tsx" "EditorFooter" modules/*/src/widgets/

# Tree / map / calendar (shapes 8-10)
grep -rln --include="*.tsx" "CrudTree\|MapProvider\|@simplix-react/calendar" modules/*/src/
```

If the two precedents disagree with each other, the newer one that also passes the invariants wins. The older one is a drift candidate: fix it in the same session when in scope, otherwise report it to the user. Never average the two into a third variant.

## Step 3 — Read the precedents END TO END, extract the comparison sheet

Read the full widget set of BOTH precedents: `crud-page.tsx`, `list.tsx`, `form.tsx`, `detail.tsx` (or the editor files), the route file, and the module locales. Skimming one file is not reading a precedent. Extract the sheet below into working notes; the new screen must match every row unless a real domain difference justifies otherwise.

| Dimension | What must match |
| --- | --- |
| Page chrome | `usePageHeader` title / description / actions wiring, view-dependent titles (#31) |
| Root layout | `Stack flex` root, scroll-ownership chain, no extra `Container` (#31d–e) |
| Filters | Types, ordering, pruning of UUID / audit filters, `maxBadges={3}`, popover columns (#13–17, #39) |
| Columns | Order, hidden set, alignment, badge / cell components, i18n labels (#18–21) |
| Detail | Section layout, `Detail*Field` kinds, block fields, badge size, audit footer |
| Form | Single `FormValues` state, field kinds (Time / Date / Select / Switch), pickers for ids (#34, #37) |
| Mutations | `useCrudFormSubmit` / `adaptOrval*` wiring, invalidation, unsaved-changes guard |
| Delete | `useCrudDeleteWired` clone on every variant, human-named dialog (#46) |
| Empty / loading / error | Registry shared components only (#22) |
| Badges & tones | Shared tone maps, `StatusBadge` wrappers, red-badge semantics (#43, #48) |
| Enums & dates | `resolveBootEnum` in all four contexts (#10), semantic-kind date handling (#42) |
| i18n | Key naming shape, en / ko / ja parity |
| Navigation | Route file pattern, sidebar entry, nav / tab count wiring (`../scaffold/patterns.md`) |

## Step 4 — Implement by cloning

1. Start from the precedent's file structure — copy the skeleton and adapt. Invariant #31 already forbids blank-file pages; this extends it to the whole widget set.
2. Every deliberate divergence is justified by a domain difference (different entity semantics, different persona), never by preference. "I would structure it differently" is not a justification — propose the improvement to the user separately, and if accepted, apply it to the precedents too.
3. A precedent that violates an invariant is never copied: build the new screen to the invariant, and fix the precedent (touch-and-fix) or report it.

## Step 5 — Parity pass and completion report

1. After implementation, walk the Step 3 sheet row by row against both precedents.
2. In the browser, put the new screen next to the nearest-sibling precedent (side by side or sequential screenshots). A reviewer must not be able to tell which screen is older.
3. The completion report — in conversation, never recorded in code or docs — names: (a) the shape classification, (b) both precedent files, (c) each justified divergence with its domain reason. **A completion report that cannot name its precedents means the procedure was skipped — return to Step 1.**

## Rationalizations (each one means: go back to Step 1)

| Rationalization | Reality |
| --- | --- |
| "This screen is unique — no precedent applies" | Shapes are few. At minimum chrome, filters, columns, mutations, delete, and empty states have precedents. Classify, don't exempt. |
| "The scaffold already generated the structure" | Scaffold output is generic. Project decisions — pruned filters, badge tones, panel wiring — live in customized precedents. |
| "I remember how the sibling screens look" | Memory drifts across sessions, and conventions move with every promoted learning. Read the files. |
| "I'll align it with the siblings once it works" | Post-hoc alignment happens after the structure is sunk and shows up as review churn. Precedents come first. |
| "Reading two full screens is too slow" | Divergent screens get reworked screen by screen; the reading amortizes across every screen that follows. |
