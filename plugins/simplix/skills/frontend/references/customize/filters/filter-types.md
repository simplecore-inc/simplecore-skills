# Filter Types Reference

Full type definitions for `CrudList.FilterBar` filters from `@simplix-react/ui`.

---

## FilterDef Union Type

```tsx
type FilterDef =
  | TextFilterDef
  | NumberFilterDef
  | FacetedFilterDef
  | ToggleFilterDef
  | DateRangeFilterDef
  | CountryFilterDef
  | TimezoneFilterDef;
```

---

## Individual Filter Definitions

### TextFilterDef

```tsx
interface TextFilterDef {
  type: "text";
  field: string;
  label: string;
  operators: SearchOperator[];
  defaultOperator: SearchOperator;
  placeholder?: string;
}
```

Typical usage:

```tsx
{
  type: "text",
  field: "name",
  label: fieldLabel("name"),
  operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
  defaultOperator: SearchOperator.CONTAINS,
}
```

### NumberFilterDef

```tsx
interface NumberFilterDef {
  type: "number";
  field: string;
  label: string;
  operators: SearchOperator[];
  defaultOperator: SearchOperator;
  placeholder?: string;
}
```

Typical usage:

```tsx
{
  type: "number",
  field: "price",
  label: fieldLabel("price"),
  operators: [SearchOperator.EQUALS],
  defaultOperator: SearchOperator.EQUALS,
}
```

### FacetedFilterDef

```tsx
interface FacetedFilterDef {
  type: "faceted";
  field: string;
  label: string;
  options: {
    value: string;
    label: string;
    icon?: ComponentType<{ className?: string }>;
  }[];
  /** Allow selecting multiple options. */
  multiSelect?: boolean;
  /**
   * Presentation of the option list. "list" (default) renders the searchable
   * checkbox list inline; "dropdown" collapses it behind a combobox-style
   * trigger — use for long option sets such as entity/user pickers.
   */
  display?: "list" | "dropdown";
}
```

Typical usage:

```tsx
{
  type: "faceted",
  field: "status",
  label: fieldLabel("status"),
  options: statusOptions,
}

// Long option set (entity/user picker): collapse behind a dropdown trigger
{
  type: "faceted",
  field: "userAccountId",
  label: fieldLabel("userAccountId"),
  options: userOptions,
  display: "dropdown",
}
```

### ToggleFilterDef

```tsx
interface ToggleFilterDef {
  type: "toggle";
  field: string;
  label: string;
}
```

Typical usage:

```tsx
{
  type: "toggle",
  field: "isEnabled",
  label: fieldLabel("isEnabled"),
}
```

※ Boolean fields MUST always use toggle type. NEVER use faceted with true/false options.

### DateRangeFilterDef

```tsx
interface DateRangeFilterDef {
  type: "dateRange";
  field: string;
  label: string;
  /** Serialize as plain yyyy-MM-dd (backend LocalDate fields) instead of ISO instants. */
  dateOnly?: boolean;
}
```

Typical usage:

```tsx
{
  type: "dateRange",
  field: "createdAt",
  label: fieldLabel("createdAt"),
}

// Calendar-date backend field (LocalDate): send plain dates, not instants
{
  type: "dateRange",
  field: "date",
  label: fieldLabel("date"),
  dateOnly: true,
}
```

※ Every filter def also accepts `columnBreak: true` - in a multi-column popover
(`popoverColumns` on the FilterBar), the flagged filter starts the next column.
See `overview.md` § Popover Columns.

### CountryFilterDef

```tsx
interface CountryFilterDef {
  type: "country";
  field: string;
  label: string;
}
```

### TimezoneFilterDef

```tsx
interface TimezoneFilterDef {
  type: "timezone";
  field: string;
  label: string;
}
```

---

## SearchOperator Enum

```tsx
enum SearchOperator {
  EQUALS = "equals",
  NOT_EQUALS = "notEquals",
  CONTAINS = "contains",
  NOT_CONTAINS = "notContains",
  STARTS_WITH = "startsWith",
  ENDS_WITH = "endsWith",
  GREATER_THAN = "greaterThan",
  LESS_THAN = "lessThan",
  GREATER_THAN_OR_EQUAL = "greaterThanOrEqual",
  LESS_THAN_OR_EQUAL = "lessThanOrEqual",
  IN = "in",
  NOT_IN = "notIn",
  BETWEEN = "between",
  NOT_BETWEEN = "notBetween",
  IS_NULL = "isNull",
  IS_NOT_NULL = "isNotNull",
  IS_TRUE = "isTrue",
  IS_FALSE = "isFalse",
}
```

Import:

```tsx
import { SearchOperator } from "@simplix-react/ui";
```

---

## CrudList.FilterBar Props

```tsx
interface FilterBarProps {
  /** Array of filter definitions */
  filters: FilterDef[];
  /** Filter state from useCrudList (or useFilterBarState off-list) */
  state: CrudListFilters;
  /** The list total, drawn as the shared ListTotalBadge - the one place the total goes (invariant #41) */
  count?: number;
  /** Extra summary content beside the total (an aggregate total, a pending-count badge) - never the total itself */
  leading?: React.ReactNode;
  /** Maximum number of filter badges to show before collapsing */
  maxBadges?: number;
  /** Popover form layout: "auto" (default), 1, 2 or 3 columns - `columnBreak` on a filter starts a column (invariant #39) */
  popoverColumns?: "auto" | 1 | 2 | 3;
}
```

This lists the props this handbook's rules use; read the component source for the rest before working around a prop that seems missing (invariant #44).

Usage:

```tsx
<CrudList.FilterBar
  count={list.pagination.total}
  maxBadges={3}
  filters={[...]}
  state={list.filters}
/>
```

---

## CrudList.ChipFilter Props

`@simplix-react/ui` 0.3.9 and later (`crud/filters/chip-filter.tsx`) - multi-select:

```tsx
interface ChipFilterProps<T extends string | number = string> {
  /** Field key in "field.operator" format, with the membership operator ("status.in") */
  field: string;
  /** Chip options; `icon` replaces the on/off mark, so pass one only where the colour says it */
  options: { value: T; label: string; icon?: ReactNode; disabled?: boolean }[];
  /** Filter state from useCrudList or useFilterBarState */
  state: CrudListFilters;
  /** Space between chips (default "xs") */
  gap?: "none" | "xs" | "sm" | "md" | "lg";
}
```

The row writes an array under `field` and nothing with every chip off. A consumer that reads the
narrowing outside the list reads it with `chipFilterValues(state, field)`, never as a scalar.

Usage:

```tsx
<CrudList.ChipFilter
  field="status.in"
  options={statusChipOptions}
  state={list.filters}
/>
```

0.3.8 and earlier - single-select: the same props plus `columns?: 1 | 2 | 3 | 4 | 5 | 6`
(default 4, a grid), and `field` takes the equality operator (`"status.equals"`) because the row
writes one value. Invariant #15 holds the table of both modes.

---

## makeFilterKey Utility

Builds a filter key string in `"field.operator"` format for use with `commitValue`.

```tsx
import { makeFilterKey } from "@simplix-react/ui";

const key = makeFilterKey("status", SearchOperator.EQUALS);
// Result: "status.equals"

// Used with filter state
list.filters.commitValue(makeFilterKey("categoryId", SearchOperator.EQUALS), categoryId);
```

---

## CrudListFilters State Interface

The `list.filters` object returned by `useCrudList` provides:

```tsx
interface CrudListFilters {
  /** Commit a filter value programmatically */
  commitValue(key: string, value: unknown): void;
  /** Current filter values */
  values: Record<string, unknown>;
  /** Reset all filters */
  reset(): void;
}
```

Key patterns:

```tsx
// Programmatic filter update
list.filters.commitValue("categoryId.equals", categoryId);

// Read current value
const currentStatus = list.filters.values["status.in"];

// Reset all filters
list.filters.reset();
```
