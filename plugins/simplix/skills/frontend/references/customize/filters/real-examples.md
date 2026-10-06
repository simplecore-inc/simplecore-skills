# Filter Examples by Pattern

Representative `CrudList.FilterBar` implementations, organized by the pattern each one demonstrates. The neutral `inventory`/`product` vocabulary is used throughout; substitute your own domain's entities and fields.

---

## 1. Example: List with Diverse Filter Types

Demonstrates: text, dateRange, number, faceted, and toggle filters together in one FilterBar, in the mandatory category order (invariant #16: String → Date → Number → Attribute, then table column order).

```tsx
<CrudList.FilterBar
  count={list.pagination.total}
  maxBadges={3}
  filters={[
    // String
    {
      type: "text",
      field: "name",
      label: fieldLabel("name"),
      operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
      defaultOperator: SearchOperator.CONTAINS,
    },
    // Date
    {
      type: "dateRange",
      field: "releasedAt",
      label: fieldLabel("releasedAt"),
    },
    {
      type: "dateRange",
      field: "restockedAt",
      label: fieldLabel("restockedAt"),
    },
    // Number
    {
      type: "number",
      field: "price",
      label: fieldLabel("price"),
      operators: [SearchOperator.EQUALS],
      defaultOperator: SearchOperator.EQUALS,
    },
    {
      type: "number",
      field: "quantity",
      label: fieldLabel("quantity"),
      operators: [SearchOperator.EQUALS],
      defaultOperator: SearchOperator.EQUALS,
    },
    {
      type: "number",
      field: "weight",
      label: fieldLabel("weight"),
      operators: [SearchOperator.EQUALS],
      defaultOperator: SearchOperator.EQUALS,
    },
    // Attribute: faceted (enum)
    {
      type: "faceted",
      field: "status",
      label: fieldLabel("status"),
      options: statusOptions,
    },
    {
      type: "faceted",
      field: "category",
      label: fieldLabel("category"),
      options: categoryOptions,
    },
    // Attribute: toggle (boolean)
    {
      type: "toggle",
      field: "isEnabled",
      label: fieldLabel("isEnabled"),
    },
    {
      type: "toggle",
      field: "isFeatured",
      label: fieldLabel("isFeatured"),
    },
  ]}
  state={list.filters}
/>
```

### Key Observations

- ★ `maxBadges={3}` always set
- ★ The total comes from the `count` prop, never a badge in `leading` (invariant #41)
- ★ Filters in category order, then table column order (invariant #16)
- ★ No filter on an audit stamp (`createdAt` / `updatedAt`) - nobody searches by those (invariant #39)
- ★ Boolean fields (`isEnabled`, `isFeatured`) use `type: "toggle"`
- ★ Number filters use `SearchOperator.EQUALS` as default
- ★ Text filter supports both CONTAINS and EQUALS

---

## 2. Example: ChipFilter for a Bitmask / Visual Field

Demonstrates: `CrudList.ChipFilter` for a field that benefits from prominent chip-style selection (bitmask or visual distinction).

```tsx
const statusChipOptions = [
  { label: enumLabel("ProductStatus", "ACTIVE"), value: "ACTIVE" },
  { label: enumLabel("ProductStatus", "INACTIVE"), value: "INACTIVE" },
  { label: enumLabel("ProductStatus", "ARCHIVED"), value: "ARCHIVED" },
];

// Rendered above or alongside FilterBar
<CrudList.ChipFilter
  field="status.equals"
  options={statusChipOptions}
  state={list.filters}
/>
```

### Key Observations

- ★ ChipFilter uses `"field.operator"` format for `field` prop
- ★ Options use `enumLabel()` for i18n
- ★ Used only because the field needs prominent visual chip selection
- ※ For standard enum filtering, `type: "faceted"` in FilterBar is preferred

---

## 3. Example: Timezone + Country Filters

Demonstrates: the timezone and country custom filter types alongside text and dateRange.

```tsx
<CrudList.FilterBar
  maxBadges={3}
  filters={[
    {
      type: "text",
      field: "name",
      label: fieldLabel("name"),
      operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
      defaultOperator: SearchOperator.CONTAINS,
    },
    {
      type: "dateRange",
      field: "openedAt",
      label: fieldLabel("openedAt"),
    },
    {
      type: "timezone",
      field: "timezone",
      label: fieldLabel("timezone"),
    },
    {
      type: "country",
      field: "country",
      label: fieldLabel("country"),
    },
  ]}
  state={list.filters}
/>
```

### Key Observations

- ★ `timezone` and `country` types need only `field` and `label`, and sort with the Attribute category (invariant #16)
- ★ No operators or options needed - the component handles selection internally

---

## 4. Example: FK Filter Injection at API Level

Demonstrates: binding a list to its parent with a forced request parameter for master-detail patterns, so the constraint is always applied (invariant #71).

```tsx
const list = useCrudList(
  adaptForcedList(useListProducts, { "categoryId.equals": categoryId }),
  { stateMode: "server", defaultSort: { field: "name", direction: "asc" } },
);
```

### Key Observations

- ★ FK filter is NOT added to FilterBar - it is forced into the request
- ★ `adaptForcedList` puts the parent id into the request and the query key, outside the filter state, so the first view is already narrowed; `transformFilters` would not be, because it runs only once the reader commits a filter
- ★ Used when a list is always scoped to a parent entity (master-detail)

---

## 5. Example: External Filter Sync

Demonstrates: syncing an external state value (e.g., sidebar tree selection) into filter state.

```tsx
// When categoryId changes (e.g., from sidebar tree selection), sync to filter state
useEffect(() => {
  if (categoryId) {
    list.filters.commitValue("categoryId.equals", categoryId);
  }
}, [categoryId]);
```

### Key Observations

- ★ `commitValue` uses `"field.operator"` key format
- ★ The `useEffect` ensures the filter updates whenever the external state changes
- ★ This pattern is used when a filter value comes from outside the FilterBar (e.g., tree selection, URL param, parent component state)
- ⚠ Ensure the dependency array is correct to avoid stale or infinite updates

---

## 6. Example: Multiple Text Filters

Demonstrates: multiple individual text filters (no unified-text), each scoped to a separate field.

```tsx
<CrudList.FilterBar
  maxBadges={3}
  filters={[
    {
      type: "text",
      field: "name",
      label: fieldLabel("name"),
      operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
      defaultOperator: SearchOperator.CONTAINS,
    },
    {
      type: "text",
      field: "sku",
      label: fieldLabel("sku"),
      operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
      defaultOperator: SearchOperator.CONTAINS,
    },
    {
      type: "text",
      field: "email",
      label: fieldLabel("email"),
      operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
      defaultOperator: SearchOperator.CONTAINS,
    },
    {
      type: "faceted",
      field: "status",
      label: fieldLabel("status"),
      options: [],
    },
  ]}
  state={list.filters}
/>
```

### Key Observations

- ★ Each text field is a separate `type: "text"` filter (not unified-text)
- ★ All text filters support both CONTAINS and EQUALS operators
- ★ CONTAINS is the default operator for text search
- ★ Faceted filter with empty options array - options populated dynamically or from the generated enum
