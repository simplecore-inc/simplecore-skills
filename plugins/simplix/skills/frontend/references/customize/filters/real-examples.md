# Filter Examples by Pattern

Representative `CrudList.FilterBar` implementations, organized by the pattern each one demonstrates. The neutral `inventory`/`product` vocabulary is used throughout; substitute your own domain's entities and fields.

---

## 1. Example: List with Diverse Filter Types

Demonstrates: text, number, faceted, toggle, and dateRange filters together in one FilterBar.

```tsx
<CrudList.FilterBar
  leading={
    <Badge variant="outline" className="gap-1.5 font-normal">
      <ListIcon className="size-3.5 text-muted-foreground" />
      {t("list.totalCount", { count: list.pagination.total })}
    </Badge>
  }
  maxBadges={3}
  filters={[
    // Number
    {
      type: "number",
      field: "price",
      label: fieldLabel("price"),
      operators: [SearchOperator.EQUALS],
      defaultOperator: SearchOperator.EQUALS,
    },
    // Faceted (enum)
    {
      type: "faceted",
      field: "status",
      label: fieldLabel("status"),
      options: statusOptions,
    },
    // Text
    {
      type: "text",
      field: "name",
      label: fieldLabel("name"),
      operators: [SearchOperator.CONTAINS, SearchOperator.EQUALS],
      defaultOperator: SearchOperator.CONTAINS,
    },
    // Faceted (enum)
    {
      type: "faceted",
      field: "category",
      label: fieldLabel("category"),
      options: categoryOptions,
    },
    // Number
    {
      type: "number",
      field: "quantity",
      label: fieldLabel("quantity"),
      operators: [SearchOperator.EQUALS],
      defaultOperator: SearchOperator.EQUALS,
    },
    // Toggle (boolean)
    {
      type: "toggle",
      field: "isEnabled",
      label: fieldLabel("isEnabled"),
    },
    // Toggle (boolean)
    {
      type: "toggle",
      field: "isFeatured",
      label: fieldLabel("isFeatured"),
    },
    // Number
    {
      type: "number",
      field: "weight",
      label: fieldLabel("weight"),
      operators: [SearchOperator.EQUALS],
      defaultOperator: SearchOperator.EQUALS,
    },
    // DateRange
    {
      type: "dateRange",
      field: "createdAt",
      label: fieldLabel("createdAt"),
    },
    // DateRange
    {
      type: "dateRange",
      field: "updatedAt",
      label: fieldLabel("updatedAt"),
    },
  ]}
  state={list.filters}
/>
```

### Key Observations

- ★ `maxBadges={3}` always set
- ★ Leading badge with total count
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
      type: "timezone",
      field: "timezone",
      label: fieldLabel("timezone"),
    },
    {
      type: "country",
      field: "country",
      label: fieldLabel("country"),
    },
    {
      type: "dateRange",
      field: "createdAt",
      label: fieldLabel("createdAt"),
    },
  ]}
  state={list.filters}
/>
```

### Key Observations

- ★ `timezone` and `country` types need only `field` and `label`
- ★ No operators or options needed — the component handles selection internally

---

## 4. Example: FK Filter Injection at API Level

Demonstrates: injecting a parent FK filter at the API hook level for master-detail patterns, so the constraint is always applied.

```tsx
// Create a filtered version of the list hook that always includes categoryId
const useFilteredList = (params?: any, options?: any) => {
  const mergedParams = { ...params, "categoryId.equals": categoryId };
  return (useListProducts as any)(mergedParams, options);
};

// Use the filtered hook with useCrudList
const list = useCrudList(adaptOrvalList(useFilteredList), {
  defaultSort: { field: "name", direction: "asc" },
});
```

### Key Observations

- ★ FK filter is NOT added to FilterBar — it is injected at the API level
- ★ This ensures the parent FK filter is always applied regardless of user interaction
- ★ The `mergedParams` pattern spreads user params and adds the FK constraint
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
- ★ Faceted filter with empty options array — options populated dynamically or from the generated enum
