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

## Reference filter and picker (user-account references as the example)

| Field | Value |
|-------|-------|
| **Filter loader** | `createEntityFacet` (server-searched, a directory that outgrows one page) or `createEntityOptions` (the whole set once, a bounded catalogue), both from `@simplix-react/ui` |
| **Form loader** | `createEntitySearch` from `@simplix-react/ui`, rendered by the kit's `EntitySearchCombobox` (console-core `entity`) |
| **Wiring** | `scaffold.referencePickers` in `simplix.config.ts` (`{ hook, from, facet }` per referenced entity, `framework/configuration.md`); the project's identity package exports the user hooks it names |

### Rule

Every list filter over a user-account reference field (`userAccountId`, `delegatorId`, actor ids, …) is a `faceted` filter fed by the user options hook (`useUserOptions()` below stands for the project's hook built on `createEntityOptions` or `createEntityFacet`) with `display: "dropdown"`, the same loader that resolves display names, exposed as `{ label: displayName, value: userId }` options. NEVER a raw-id `text` filter, and NEVER a module-local re-implementation of the options mapping. The backend SearchDTO field allows `EQUALS, IN` (faceted serializes to `field.in`).

**Form-side selection of a reference is a server-searched picker, never a client-filtered option dump.** A `createEntitySearch` hook debounce-searches the entity's lookup endpoint and always resolves the selected id's label, and `EntitySearchCombobox` draws it and says so when the server holds more matches than the page shows. NEVER feed a directory that outgrows one page into the eager `EntityCombobox`/`ComboboxField`, and NEVER re-build a module-local search dialog. A required reference whose entity has no `scaffold.referencePickers` entry is reported by `simplix check-screen`.

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

## Figure strip placement (page-level strip only)

| Field | Value |
|-------|-------|
| **Part** | the page's figure row (`spec.tiles` on a console page; `StatCard` from `@simplix-react/ui` for a card drawn on a page the shell does not own) |
| **Scope** | Tabbed report/dashboard pages |

### Rule

On a page with an always-visible figure strip (summary tiles under the page header), tab bodies must NOT render their own tiles or stat cards - two rows of identical card shapes read as a broken layout, and a half-filled card row leaves dead space. A screen on the console kit hands its figures to the page as data and never draws the strip or its fold itself (the kit's fence refuses `SettingsTiles`). Tab-level aggregates live in the FilterBar toolbar line instead: totals as `leading` text/badges next to the `count` badge. Strip tiles may take a press action to drill into a tab with the matching filter committed.
