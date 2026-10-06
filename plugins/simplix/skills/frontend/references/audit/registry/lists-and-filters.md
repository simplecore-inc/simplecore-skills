> Commonization registry - **List toolbars, filters & counts**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry - List toolbars, filters & counts

## ListTotalBadge (the "Total N" badge the FilterBar draws)

| Field | Value |
|-------|-------|
| **Component** | `ListTotalBadge` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/shared/list-total-badge.tsx` |

### Rule

A list's total badge is drawn by the FilterBar's `count` prop, which renders `ListTotalBadge` internally ([[FilterBar count prop (the one total badge)]] below; SKILL.md invariant #41). It never goes through `leading`, and it is never the inline `Badge variant="outline"` + `ListIcon` + `t("list.totalCount")` triple: the component owns the icon and the framework translation. A scaffolded list that carries the badge in `leading` is moved to `count` at customization time. Render `ListTotalBadge` directly only on a surface where no FilterBar draws the total. EXCEPTION: a badge with a DIFFERENT label semantics (e.g. a floors-count badge with its own i18n key) is extra summary content and keeps its bespoke `Badge` in `leading`.

```tsx
// FORBIDDEN - a hand-built total, or the shared one handed through leading
<CrudList.FilterBar leading={<Badge variant="outline">{t("list.totalCount", { count: list.pagination.total })}</Badge>} ... />
<CrudList.FilterBar leading={<ListTotalBadge count={list.pagination.total} />} ... />
// REQUIRED
<CrudList.FilterBar count={list.pagination.total} ... />
```

## User-select filter (useUserOptions + faceted dropdown)

| Field | Value |
|-------|-------|
| **Hook** | `useUserOptions()` |
| **Package** | `@<scope>/<ui-package>` (subpath `./identity`) |
| **Export** | `import { useUserOptions } from "@<scope>/<ui-package>/identity"` |

### Rule

Every list filter over a user-account reference field (`userAccountId`, `delegatorId`, actor ids, …) is a `faceted` filter fed by `useUserOptions()` with `display: "dropdown"` - the same batch user list that `useUserNames()` resolves display names from, exposed as `{ label: displayName, value: userId }` options. NEVER a raw-id `text` filter, and NEVER a module-local re-implementation of the options mapping. The backend SearchDTO field allows `EQUALS, IN` (faceted serializes to `field.in`).

**Form-side user selection is `UserCombobox` (server search + full-search dialog), never a client-filtered option dump.** `UserCombobox` debounce-searches the dedicated case-insensitive lookup endpoint (`useUserSearch`), always resolves the selected id's label, and its expand affordance opens `UserPickerDialog` - the standard paged searchable list with per-row select actions. NEVER feed a user list into a plain `EntityCombobox`/`ComboboxField`, and NEVER re-build a module-local user search dialog.

### Standard Usage

```tsx
const { options: userOptions } = useUserOptions();

{ type: "faceted", field: "userAccountId", label: fieldLabel("userAccountId"), options: userOptions, display: "dropdown" }
```

### Anti-Pattern

```tsx
// FORBIDDEN - raw-id text search over a field the column renders as a name
{ type: "text", field: "userAccountId", label: fieldLabel("userAccountId"), operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS], defaultOperator: SearchOperator.CONTAINS }
// FORBIDDEN - inline duplicate of the option mapping inside a module
const options = users.map((u) => ({ label: u.nativeName ?? u.username, value: u.userId }));
```

## useFilterBarState (FilterBar on non-CrudList surfaces)

| Field | Value |
|-------|-------|
| **Hook** | `useFilterBarState` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/filters/use-filter-bar-state.ts` |

### Rule

A surface whose query is NOT a `useCrudList` list (an aggregation report, a dashboard section, a custom endpoint with required params) still renders its conditions through the standard `CrudList.FilterBar` - driven by this standalone hook, which implements the same deferred-apply `CrudListFilters` contract. Derive the query params from `committedValues` (faceted single-select values may arrive as a one-element array). NEVER render query params as an inline `FormFields.*` row next to the content.

```tsx
const filters = useFilterBarState({ defaultFilters: { "checkedInAt.greaterThanOrEqualTo": from } });
const companyId = String((filters.committedValues["companyId.in"] as string[] | undefined)?.[0] ?? "");
<CrudList>
  <CrudList.FilterBar count={rows.length} filters={defs} state={filters} maxBadges={3} />
</CrudList>
```

### Anti-Pattern

```tsx
// FORBIDDEN - hand-rolled param row beside the standard list tabs
<Flex justify="between"><ListTotalBadge .../><FormFields.SelectField .../><FormFields.DateField .../></Flex>

// REQUIRED - the same search popover as every list screen
<CrudList.FilterBar count={rows.length} filters={[...]} state={useFilterBarState(...)} />
```

## FilterBar count prop (the one total badge)

| Field | Value |
|-------|-------|
| **Prop** | `CrudList.FilterBar` `count` |
| **Package** | `@simplix-react/ui` |

### Rule

The "전체 N건" badge comes from the FilterBar's `count` prop, which renders the shared `ListTotalBadge` internally - one shape everywhere. Do not pass `<ListTotalBadge>` through `leading` (reserve `leading` for extra summary content: aggregate text, a pending-count `Badge`).

## StatusCard placement (page-level status strip only)

| Field | Value |
|-------|-------|
| **Component** | `StatusCard` (`@<scope>/<ui-package>/status`) |
| **Scope** | Tabbed report/dashboard pages |

### Rule

On a page with an always-visible status strip (summary `StatusCard`s under the page header), tab bodies must NOT render their own `StatusCard`s - two rows of identical card shapes read as a broken layout, and a half-filled card row leaves dead space. Tab-level aggregates live in the FilterBar toolbar line instead: totals as `leading` text/badges next to the `count` badge. Strip cards may take `onClick` to drill into a tab with the matching filter committed.
