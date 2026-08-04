> **CUSTOMIZE · Filters** specialization inside this skill. Loaded when the task adds or modifies `CrudList.FilterBar`. Sibling files: `filter-types.md`, `real-examples.md`. Parent: `../overview.md`.

# Data Table Filter Design (CUSTOMIZE · Filters overview)

Comprehensive patterns for implementing data table filters using `CrudList.FilterBar` from `@simplix-react/ui`. Covers text search, faceted filters, toggle filters, date range, timezone, country, chip filters, FK injection, and external filter sync.

---

## MANDATORY (enforced by parent skill invariants 13–17)

**All procedures below are MANDATORY requirements, NOT recommendations.**

You MUST:
- Follow ALL steps in the exact order specified
- Apply ALL required patterns and structures as specified
- Complete ALL checklist items before finishing

**DO NOT:**
- Skip any step or rule
- Treat any rule as optional
- Modify the workflow order

---

## When to Use

- Adding search/filter functionality to data tables via `CrudList.FilterBar`
- Creating faceted filters with enum or FK options
- Adding toggle filters for boolean fields
- Adding date range, timezone, or country filters
- Implementing `CrudList.ChipFilter` for special cases (bitmask, visual distinction)
- Injecting FK filters at the API level (master-detail)
- Syncing external state into filter state

---

## Filter Types Overview

| Type | Filter Def | Use Case | Example |
| ---- | ---------- | -------- | ------- |
| `text` | `TextFilterDef` | Single field text search | Search by name, email |
| `number` | `NumberFilterDef` | Numeric exact/comparison | Filter by price, quantity |
| `faceted` | `FacetedFilterDef` | Dropdown with predefined options | Filter by status, category |
| `toggle` | `ToggleFilterDef` | Boolean on/off | isEnabled, isFeatured |
| `dateRange` | `DateRangeFilterDef` | Date range filtering | createdAt, updatedAt |
| `timezone` | `TimezoneFilterDef` | Timezone picker | timezone field |
| `country` | `CountryFilterDef` | Country picker | country field |

See [filter-types.md](filter-types.md) for full type definitions.

---

## Confirmed Rules (MANDATORY)

### ★ Boolean Filter: ALWAYS Toggle Type

Boolean fields MUST use `type: "toggle"`, NEVER `type: "faceted"` with true/false options.

```tsx
// ✔ CORRECT
{ type: "toggle", field: "isEnabled", label: fieldLabel("isEnabled") }

// ✖ FORBIDDEN
{ type: "faceted", field: "isEnabled", label: fieldLabel("isEnabled"), options: [...] }
```

### ★ maxBadges: ALWAYS 3

Every `CrudList.FilterBar` you create or touch MUST set `maxBadges={3}` — active-filter badges beyond 3 collapse to `+N`, keeping the badge bar scannable. This is a prescriptive standard: apply it whenever you add or modify a FilterBar, even if neighbouring lists predate the rule and lack it.

```tsx
<CrudList.FilterBar maxBadges={3} filters={[...]} state={list.filters} />
```

### ★ Entity/User Reference Filter: Faceted Dropdown, Never Raw-ID Text

A filter on an entity-reference field (user account, FK id) MUST be a `faceted` filter with `display: "dropdown"`, built from a batch-loaded option list — NEVER a `text` filter over the raw id. Raw-id text search cannot match what the column displays (the resolved name), so it reads as broken to the user. This presentation is system-wide: every entity/user picker filter uses the same collapsed dropdown.

```tsx
// Options come from the project's shared option hook (label = display name, value = id)
const { options: userOptions } = useUserOptions();

{ type: "faceted", field: "userAccountId", label: fieldLabel("userAccountId"), options: userOptions, display: "dropdown" }
```

The backend SearchDTO field must allow `EQUALS, IN` (faceted serializes to `field.in`); drop `CONTAINS` from id fields — partial match on an opaque id is meaningless. This is a full-stack pre-condition, not a suggestion: a `faceted` filter over a SearchDTO field whose `@SearchableField(operators = {...})` OMITS `IN` sends `field.in=` to a field that rejects the operator, and the searchable layer returns an EMPTY result set with no error — the filter looks functional but silently shows nothing. Before wiring any faceted filter, confirm the backend field lists `IN`; if it does not, add `IN` to that field's operators (backend change + OpenAPI regen) as part of the same task.

### ★ ChipFilter: Special Cases Only

`CrudList.ChipFilter` is for special cases only:
- Bitmask fields requiring visual distinction
- Cases where chip-style selection provides meaningfully better UX

For standard enum/FK filtering, use `type: "faceted"` inside `FilterBar`.

### ★ Leading Badge: Total Count Only When Data Exists

The `leading` prop shows total count. Only render when data is available:

```tsx
<CrudList.FilterBar
  leading={
    <Badge variant="outline" className="gap-1.5 font-normal">
      <ListIcon className="size-3.5 text-muted-foreground" />
      {t("list.totalCount", { count: list.pagination.total })}
    </Badge>
  }
  maxBadges={3}
  filters={[...]}
  state={list.filters}
/>
```

### ★ Boolean Display in Columns

- Existing boolean column code: preserve as-is (do not refactor)
- NEW boolean columns: use `Badge` rendering

---

## FilterBar Layout Architecture

`CrudList.FilterBar` uses a completely different structure from the inline filter layout of older admin frameworks.

### Structure

```
┌─────────────────────────────────────────────────────────┐
│ [Total 42] [Status: Active] [Name: John] [+2] [Filter] [Columns] │  ← Badge Bar (horizontal)
└─────────────────────────────────────────────────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │  Filter Popover    │
                                    │ (w-320px, vertical)│
                                    │                    │
                                    │  [Name      ___]   │
                                    │  [Status    ▽  ]   │
                                    │  [Enabled   ○  ]   │
                                    │  [Created   ___]   │
                                    │                    │
                                    │  [Reset] [Apply]   │
                                    └────────────────────┘
```

### How It Works

| Element | Description |
| --- | --- |
| **Badge Bar** | Laid out horizontally above the table. Summarizes active filters as Badges |
| **maxBadges** | Collapses to `+N` when there are more than 3 Badges |
| **Filter Popover** | Opens when the "Filter" button is clicked. 320px-wide vertical stack by default; widens to multi-column when configured or on overflow (see below) |
| **leading** | Shows extra info such as the total count on the left of the Badge Bar |
| **popoverColumns** | Column layout of the popover form: `"auto"` (default), `1`, `2` (560px), `3` (800px) |
| **columnBreak** | Per-filter flag that starts a new popover column at that filter |

### ※ No Separator / Row-Placement Rules Needed

Older frameworks required `insertFilterSeparators()` (distributing 4 per row) for an inline filter UI. The current design is Popover-based, so **row-placement rules are not needed**. The framework arranges filters automatically in a vertical Stack.

### Popover Columns (`popoverColumns` + `columnBreak`)

When a list has many filters, the popover form can lay them out in multiple **fully independent columns** (each column is its own vertical stack — a tall field such as a calendar never stretches or fragments its neighbors). A vertical divider line renders between columns automatically.

| Setting | Behavior |
| --- | --- |
| `popoverColumns="auto"` (default) | One column; switches to two columns when the form would overflow its max height (vertical scrollbar) |
| `popoverColumns={1}` | Always a single 320px column |
| `popoverColumns={2}` | Always two columns in a 560px popover |
| `popoverColumns={3}` | Always three columns in an 800px popover |

Column boundaries follow `columnBreak: true` flags on the filter definitions (up to columns − 1 flags, in order); without flags the filters split evenly, column-major. Group by control kind for scannability — e.g. text inputs and toggles on the left, calendars (`dateRange`) in their own right-hand column:

```tsx
<CrudList.FilterBar
  maxBadges={3}
  popoverColumns={3}
  filters={[
    { type: "text", field: "code", label: fieldLabel("code"), ... },
    { type: "faceted", field: "type", label: fieldLabel("type"), options },
    { type: "toggle", field: "active", label: fieldLabel("active"), columnBreak: true }, // column 2
    { type: "toggle", field: "useCreate", label: fieldLabel("useCreate") },
    { type: "dateRange", field: "createdAt", label: fieldLabel("createdAt"), columnBreak: true }, // column 3
    { type: "dateRange", field: "updatedAt", label: fieldLabel("updatedAt") },
  ]}
  state={list.filters}
/>
```

`dateRange` filters also accept `dateOnly: true` to serialize plain `yyyy-MM-dd` values for backend calendar-date (LocalDate) fields instead of ISO instants.

---

## Filter Classification (4 Categories)

| Category | Data Type | Filter Types |
| -------- | --------- | ------------ |
| **String** | Code/ID, Name/Title, Email | `text` |
| **Date** | CreatedAt, UpdatedAt, Period | `dateRange` |
| **Number** | Quantity, Amount, Order, Code | `number` |
| **Attribute** | Enum, FK Relation, Boolean, Timezone, Country | `faceted`, `toggle`, `timezone`, `country` |

---

## Filter Ordering Rules

### Primary Sort: Category Order

```
String → Date → Number → Attribute
```

### Secondary Sort: Table Column Order

Within each category, filters follow the column order in the table header.

### Example

**Table column order:** `name`, `sku`, `email`, `createdAt`, `updatedAt`, `price`, `quantity`, `status`, `category`, `isEnabled`, `isFeatured`

```tsx
filters={[
  // String (column order: name → sku → email)
  { type: "text", field: "name", label: fieldLabel("name"), ... },
  { type: "text", field: "sku", label: fieldLabel("sku"), ... },
  { type: "text", field: "email", label: fieldLabel("email"), ... },

  // Date (column order: createdAt → updatedAt)
  { type: "dateRange", field: "createdAt", label: fieldLabel("createdAt") },
  { type: "dateRange", field: "updatedAt", label: fieldLabel("updatedAt") },

  // Number (column order: price → quantity)
  { type: "number", field: "price", label: fieldLabel("price"), ... },
  { type: "number", field: "quantity", label: fieldLabel("quantity"), ... },

  // Attribute (column order: status → category → isEnabled → isFeatured)
  { type: "faceted", field: "status", label: fieldLabel("status"), options: statusOptions },
  { type: "faceted", field: "category", label: fieldLabel("category"), options: categoryOptions },
  { type: "toggle", field: "isEnabled", label: fieldLabel("isEnabled") },
  { type: "toggle", field: "isFeatured", label: fieldLabel("isFeatured") },
]}
```

---

## Basic Pattern

### Standard Filter Implementation

```tsx
import { CrudList, SearchOperator } from "@simplix-react/ui";
import { Badge } from "@simplix-react/ui";
import { ListIcon } from "lucide-react";

export function EntityList() {
  const { fieldLabel } = useEntityTranslation("entity");
  // `list.totalCount` is a framework string → the framework "simplix/ui" namespace.
  // Module-specific widget strings use useTranslation("<module>/widgets").
  const { t } = useTranslation("simplix/ui");

  const list = useCrudList(adaptOrvalList(useListEntities), {
    // ... options
  });

  return (
    <CrudList.FilterBar
      leading={
        <Badge variant="outline" className="gap-1.5 font-normal">
          <ListIcon className="size-3.5 text-muted-foreground" />
          {t("list.totalCount", { count: list.pagination.total })}
        </Badge>
      }
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
          field: "createdAt",
          label: fieldLabel("createdAt"),
        },
        {
          type: "number",
          field: "sortOrder",
          label: fieldLabel("sortOrder"),
          operators: [SearchOperator.EQUALS],
          defaultOperator: SearchOperator.EQUALS,
        },
        {
          type: "faceted",
          field: "status",
          label: fieldLabel("status"),
          options: statusOptions,
        },
        {
          type: "toggle",
          field: "isActive",
          label: fieldLabel("isActive"),
        },
      ]}
      state={list.filters}
    />
  );
}
```

### Filter Type to Operator Mapping

| Filter Type | Typical Operators | Default Operator |
| ----------- | ----------------- | ---------------- |
| `text` | CONTAINS, EQUALS | CONTAINS |
| `number` | EQUALS | EQUALS |
| `faceted` | (none needed — uses IN internally) | — |
| `toggle` | (none needed — uses IS_TRUE/IS_FALSE) | — |
| `dateRange` | (none needed — uses BETWEEN internally) | — |
| `timezone` | (none needed) | — |
| `country` | (none needed) | — |

---

## Advanced Patterns

### 1. ChipFilter (Special Cases Only)

Use only for bitmask fields or cases requiring visual chip-style distinction:

```tsx
<CrudList.ChipFilter
  field="status.equals"
  options={statusChipOptions}
  state={list.filters}
/>
```

※ For standard enum filtering, always prefer `type: "faceted"` inside `FilterBar`.

### 2. FK Filter Injection at API Level

For master-detail patterns where a parent ID must always be applied:

```tsx
const useFilteredList = (params?: any, options?: any) => {
  const mergedParams = { ...params, "categoryId.equals": categoryId };
  return (useListProducts as any)(mergedParams, options);
};

const list = useCrudList(adaptOrvalList(useFilteredList), { ... });
```

### 3. External Filter Sync

Sync external state (e.g., sidebar selection) into filter state:

```tsx
useEffect(() => {
  if (categoryId) {
    list.filters.commitValue("categoryId.equals", categoryId);
  }
}, [categoryId]);
```

### 4. Custom Filter Types

Timezone and country filters require only `field` and `label`:

```tsx
filters={[
  { type: "timezone", field: "timezone", label: fieldLabel("timezone") },
  { type: "country", field: "country", label: fieldLabel("country") },
]}
```

### 5. Faceted Filter with Enum Options

Build options from the generated enum object. `enumLabel` resolves the i18n label for each value:

```tsx
// ProductStatus comes from the domain package's generated model
const statusOptions = Object.values(ProductStatus).map((v) => ({
  label: enumLabel("ProductStatus", v),
  value: v,
}));

// In filters array
{ type: "faceted", field: "status", label: fieldLabel("status"), options: statusOptions }
```

Note: `resolveBootEnum(value)` normalizes a SINGLE enum value to a string — it does NOT return an options array, so it cannot build the `options` list. A project may wrap the `Object.values(...).map(...)` pattern in a local helper, but that helper is not a framework API.

---

## Search Operators Reference

| Operator | Use Case | API Parameter |
| -------- | -------- | ------------- |
| `EQUALS` | Exact match | `field.equals=value` |
| `CONTAINS` | Substring match | `field.contains=value` |
| `STARTS_WITH` | Prefix match | `field.startsWith=value` |
| `ENDS_WITH` | Suffix match | `field.endsWith=value` |
| `GREATER_THAN` | Numeric comparison | `field.greaterThan=value` |
| `LESS_THAN` | Numeric comparison | `field.lessThan=value` |
| `IN` | Multiple values | `field.in=val1,val2` |
| `NOT_IN` | Exclude values | `field.notIn=val1,val2` |
| `BETWEEN` | Date/number range | `field.greaterThanOrEqual=start&field.lessThanOrEqual=end` |
| `IS_TRUE` | Boolean true | `field.equals=true` |
| `IS_FALSE` | Boolean false | `field.equals=false` |
| `IS_NULL` | Null check | `field.specified=false` |
| `IS_NOT_NULL` | Not null check | `field.specified=true` |

---

## i18n Pattern

All filter labels MUST use i18n functions:

```tsx
const { fieldLabel, enumLabel } = useEntityTranslation("entityName");
const { t } = useTranslation("simplix/ui");          // framework UI strings (e.g. list.totalCount)
// module-specific widget strings: useTranslation("<module>/widgets")

// Field labels
label: fieldLabel("name")

// Leading badge text (framework key in the "simplix/ui" namespace)
t("list.totalCount", { count: list.pagination.total })
```

---

## Backend DTO Verification (MANDATORY)

**CRITICAL**: After completing filter design, you MUST verify that frontend filters match backend SearchDTO capabilities.

### When to Use

- **ALWAYS** after filter design is complete
- To ensure frontend filters match backend SearchDTO
- When adding new search fields or modifying operators

### Verification Flow

```
[Filter Design Complete]
        ↓
┌─────────────────────────────────────────┐
│ Step 1: Ask if user wants DTO verify    │
│ - Proceed (Recommended)                │
│ - Skip                                  │
└─────────────────────────────────────────┘
        ↓ (Proceed)
┌─────────────────────────────────────────┐
│ Step 2: Confirm backend path            │
│ - Show detected paths if available      │
│ - Allow manual input                    │
│ - MUST verify folder exists             │
│ - If not exists, ask again              │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Step 3: Find SearchDTO file             │
│ - Read generated endpoints for API path │
│ - Map to backend controller/DTO path    │
│ - Verify file exists                    │
│ - Show path and ask confirmation        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Step 4: Execute full comparison         │
│ - Compare ALL items automatically       │
│   (field names, types, operators)       │
│ - No user selection at this stage       │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Step 5: Show comparison results         │
│ - Frontend only fields                  │
│ - Backend only fields                   │
│ - Type mismatches                       │
│ - Operator mismatches                   │
│ - Display in table format               │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Step 6: Select items to fix             │
│ - Field names (add/remove fields)       │
│ - Types (fix type mismatches)           │
│ - Operators (fix operator mismatches)   │
│ - User decides based on comparison      │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Step 7: Select sync direction           │
│ - Frontend-based (modify backend)       │
│ - Backend-based (modify frontend)       │
│ - Skip                                  │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Step 8: Execute sync and report         │
│ - Directly modify selected files        │
│ - Report modified files and changes     │
└─────────────────────────────────────────┘
```

### Operator Mapping (Backend ↔ Frontend)

| Backend (Java) | Frontend (TypeScript) |
| -------------- | --------------------- |
| `EQUALS` | `SearchOperator.EQUALS` |
| `CONTAINS` | `SearchOperator.CONTAINS` |
| `GREATER_THAN` | `SearchOperator.GREATER_THAN` |
| `LESS_THAN` | `SearchOperator.LESS_THAN` |
| `BETWEEN` | `SearchOperator.BETWEEN` |
| `IN` | `SearchOperator.IN` |

### Type Mapping (Backend ↔ Frontend)

| Backend (Java) | Frontend Filter Type |
| -------------- | -------------------- |
| `String` | `text` |
| `LocalDate`, `Instant` | `dateRange` |
| `Long`, `Integer`, `Double` | `number` |
| `Boolean` | `toggle` |
| `Enum` | `faceted` |

### Comparison Result Format

```markdown
## Filter vs SearchDTO Comparison

### Summary

- Total frontend fields: 6
- Total backend fields: 8
- Matched: 5
- Frontend only: 1
- Backend only: 3
- Type mismatch: 0
- Operator mismatch: 1

### Detailed Results

| Field | Frontend | Backend | Status |
| ----- | -------- | ------- | ------ |
| name | text / CONTAINS | String / EQUALS,CONTAINS | ✔ Match |
| email | text / CONTAINS | String / EQUALS,CONTAINS | ✔ Match |
| createdAt | dateRange | LocalDate / BETWEEN | ✔ Match |
| status | faceted | StatusEnum / EQUALS,IN | ✔ Match |
| isEnabled | toggle | Boolean / EQUALS | ✔ Match |
| amount | - | Long / EQUALS,GT,LT | ⚠ Backend only |
| customField | text / CONTAINS | - | ⚠ Frontend only |
```

### Verification Checklist

- ☐ User prompted for verification
- ☐ Backend path verified (folder exists, re-ask if not)
- ☐ SearchDTO file path confirmed by user
- ☐ Full comparison executed (field names, types, operators)
- ☐ Comparison results displayed in table format
- ☐ Items to fix selected by user (after viewing results)
- ☐ Sync direction selected or skipped
- ☐ Changes applied and reported (if sync selected)

---

## Quick Troubleshooting

| Issue | Cause | Solution |
| ----- | ----- | -------- |
| Faceted filter shows no options | Empty options array | Build options from boot enum or API data |
| Filter not applying | Wrong field name | Verify field matches API query parameter name |
| Toggle filter not working | Used faceted instead of toggle | Use `type: "toggle"` for boolean fields |
| ChipFilter not syncing | Wrong field format | Use `"field.operator"` format (e.g., `"status.equals"`) |
| FK filter always applied | Direct param injection | Use API-level injection pattern, not FilterBar |
| External filter not updating | Missing useEffect dependency | Ensure `commitValue` runs when external state changes |

---

## Checklist

**For All FilterBar Implementations:**

- ☐ `maxBadges={3}` set on FilterBar
- ☐ `leading` badge shows total count
- ☐ All labels use `fieldLabel()` from `useEntityTranslation`
- ☐ Boolean fields use `type: "toggle"` (NEVER faceted)
- ☐ Filters sorted by category: String → Date → Number → Attribute
- ☐ Within categories, filters sorted by table column order
- ☐ `state={list.filters}` connected to `useCrudList` result

**For Faceted Filters:**

- ☐ Options built from boot enum or API data
- ☐ Option format: `{ label: string, value: string }`

**For ChipFilter (Special Cases Only):**

- ☐ Verified that ChipFilter is justified (bitmask or visual distinction)
- ☐ Field uses `"field.operator"` format
- ☐ `state` connected to `list.filters`

**For FK / External Filters:**

- ☐ FK injection done at API level (merged params)
- ☐ External sync uses `commitValue` in `useEffect`

**For Backend DTO Verification (MANDATORY):**

- ☐ User prompted for verification
- ☐ Backend path verified (folder exists, re-ask if not)
- ☐ SearchDTO file path confirmed by user
- ☐ Full comparison executed (field names, types, operators)
- ☐ Comparison results displayed in table format
- ☐ Items to fix selected by user (after viewing results)
- ☐ Sync direction selected or skipped
- ☐ Changes applied and reported (if sync selected)

---

## Related references within this skill

1. Column specialization → `../columns/overview.md`
2. CUSTOMIZE parent (framework components, recipes, mutations) → `../overview.md`
3. AUDIT (MANDATORY after completing filter work on existing modules) → `../../audit/overview.md`

---
