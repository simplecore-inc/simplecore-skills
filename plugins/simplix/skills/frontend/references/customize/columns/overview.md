> **CUSTOMIZE · Columns** specialization inside this skill. Loaded when the task improves `CrudList.Table` column rendering, badges, icons, formatting, alignment, ordering, drag-drop, or i18n. Sibling files: `cell-components.md`, `drag-drop.md`, `i18n.md`. Parent: `../overview.md`.

# List Column Design (CUSTOMIZE · Columns overview)

Design patterns for improving `CrudList.Table` column styling with badges, icons, formatting props, and inline render patterns in the `@simplix-react/ui` framework.

---

## MANDATORY (enforced by parent skill invariants 18–21)

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

- Improving existing `CrudList.Table` column presentation
- Adding badges, icons, colors to columns
- Formatting date/boolean/enum fields
- Displaying FK relation data
- Adding custom render children to `CrudList.Column`
- **Reordering columns** in source code
- **Setting default column visibility**

---

## User Confirmation Workflow (MANDATORY)

**Before making any changes**, Claude MUST present the analysis results and get user confirmation.

### Step 0: Analyze and Present Changes

1. **Read the target file** and analyze current state
2. **Present findings** to the user with the following categories:
   - Column Order: Current vs. Recommended order
   - Cell Alignment: Fields with incorrect alignment
   - Default Visibility: Fields that should be hidden
   - Cell Rendering: Fields that could use better rendering (Badge, format prop, custom children)

3. **Ask user for each category**:

```
Question: "Column Order - the current order differs from the SKILL-recommended order. How should this be handled?"
Options:
- "Apply SKILL rules" - reorder according to SKILL rules
- "Keep current order" - keep the current order (UX priority)
- "Custom order" - specify manually
```

```
Question: "Cell Rendering - improve the rendering of the following fields? [recommendations]"
Options:
- "Apply all" - apply to all
- "Keep current" - keep current
- "Select specific" - choose individually
```

```
Question: "Default Visibility - hide the following fields by default? [field list]"
Options:
- "Apply all" - hide all
- "Keep visible" - keep current
- "Select specific" - choose individually
```

4. **Proceed based on user decisions**

### Why User Confirmation is Required

- Column order may be intentionally arranged for UX purposes
- Some fields may have specific business requirements
- Prevents unwanted changes to working implementations

---

## What This Skill Does (MANDATORY)

When applying column design rules, Claude **MUST** perform the following steps:

### Step 1: Reorder Columns

Rearrange `CrudList.Column` elements according to [Column Order Guidelines](#column-order-guidelines):
1. Drag Handle → Selection → Identifier → Relations → Type → Primary Text → Description → Attributes → Metrics → Schedule → Audit → Actions

### Step 2: Apply Intra-Group Sorting

Within each group, sort fields according to the intra-group rules (e.g., `title` before `name`, `active` before `*Enabled`).

### Step 3: Set Default Visibility

Identify fields that should be hidden by default (see Column Order Guidelines). Visibility is typically managed at the `CrudList.Table` level or via framework configuration.

### Step 4: Apply Rendering Patterns

Select appropriate rendering for each column based on field type:
- For **enum** columns, PREFER children render `{({ value }) => <Badge variant={COLORMAP[resolveBootEnum(value)] ?? "outline"}>{enumLabel(...)}</Badge>}` — this is the project convention (it unwraps the boot enum and applies `enumLabel` i18n)
- Use children render `{({ row, value }) => ...}` for any complex / relational / i18n rendering
- `display` prop is the simple built-in for the no-i18n case (`"boolean"` for booleans; `"badge"` ALSO available, optionally with the `variants` color map, but it skips `resolveBootEnum`/`enumLabel`)
- Use `format` prop for date formatting (`"date"`, `"datetime"`, `"relative"`)

### Step 5: Apply Alignment Rules

Apply alignment according to [Alignment Guidelines](#alignment-guidelines-mandatory).

### Step 6: Verify

- Run `pnpm typecheck` to ensure no TypeScript errors
- Confirm column order and rendering match the guidelines

---

## How Many Columns — Which Fields Earn One (MANDATORY)

The ordering rules below say where a column goes. They do not say whether it exists, and a list
that never asks that question comes out at the two or three columns a wireframe had room to
sketch while its DTO offers twenty-six fields and the reader is sent into the detail panel for
every one of them.

**A wireframe's column count is a floor, never a ceiling.** A board is drawn on a page far
narrower than a screen: what it draws is what must be there, not all that may be. A list-detail
page lays no grid at all while the detail is closed, so the list has the whole page — read the
frame as a ceiling and every list in the product stops at the width of a sketch.

**A field earns a column when all five hold.** Anything failing one waits in the detail panel.

1. **A reader uses it to pick a row or to scan the list** — the name they search by, the status
   they act on, the date they are chasing. Not a value somebody reads once they have already
   decided which record to open.
2. **The value differs across rows.** A tab strip or a forced scope that pins a field makes that
   field a constant inside the tab; a column of one repeated value is furniture.
3. **It reads at a glance** — a badge, a bounded number, a date, a short name. A paragraph is a
   panel field, not a column.
4. **Most rows have a value.** A field set on three rows in fourteen is an annotation on the
   identity cell (a badge beside the name), not a column blank eleven times.
5. **The reader is allowed to see it.** A value behind a different permission group renders as
   nothing for half the audience — gate the column, or leave it out.

**Always out, whatever the five say**: the UUID primary key, `deleted` / `deletedTimestamp`, the
audit quartet (`CrudDetail`'s `auditData` already carries it — invariant #54), and raw FK ids
(render the related name instead).

**Calibrate against sibling lists in the same product, not against the DTO.** A mature console
runs about five to seven columns a table; one at two has stopped early and one at fifteen has
copied the DTO. Count the columns on two lists a reviewer already accepted before choosing.

### A list that is sometimes narrow declares two sets, not one

A list-detail screen loses most of its width the moment a row opens. `CrudList.Column`'s
`minTableWidth` is the framework's answer: below that many pixels **of the table's own width** the
column is not rendered at all — no header, no cells, no entry in the columns dropdown.

- **Only a value the detail panel also shows may carry one.** A column that disappears takes its
  value with it and there is no "show anyway"; the arrangement works because the thing that took
  the width is the panel carrying the value. A value that lives nowhere else stays in the table
  however narrow it gets.
- **One threshold for the product, declared once.** A per-list threshold answers per screen a
  question the reader asks once — "is this list wide enough to read across".
- **The threshold has three bounds**: above the widest pinned list pane, at or below the narrowest
  full-page list container the product targets, and **at or above what each wide set actually
  measures**. Miss the third and the set switches on inside a table that then scrolls sideways
  with the row actions past the right edge — the failure the prop exists to prevent, caused by the
  prop. Sum each wide set's declared `width` / `minWidth`, add the cell padding per column and the
  row-action column, and keep the total under the threshold.
- **The secondary line under a row's name is the narrow form of those columns.** Where a board
  stacks 「code · rank · source」 into a caption, those become columns when there is room — and the
  caption has to drop what the columns took, or every row prints its values twice. Measure the
  list root (`<CrudList ref={…}>` + `useContainerWidth`) to decide what the caption still carries.

## Column Order Guidelines

This section defines the standard column order and default visibility for data tables.

### Column Group Order

| Order | Group | Description | Example Fields | Default Visible |

|-------|-------|-------------|----------------|-----------------|
| 1 | **Drag Handle** | Drag reorder handle | `displayOrder` | ✔ (when used) |
| 2 | **Selection** | Row selection checkbox | (built-in) | ✔ |
| 3 | **Identifier** | PK, unique identifiers | `entityId`, `code`, `slug` | ✖ Hidden |
| 4 | **Relations** | FK relation fields | `categoryId`, `ownerId` | ✖ Hidden |
| 5 | **Type/Category** | Enum types, classification | `type`, `status`, `category` | ✔ |
| 6 | **Primary Text** | Main text (clickable) | `title`, `name`, `label` | ✔ |
| 7 | **Description** | Description, summary text | `description`, `summary`, `content` | ✔ |
| 8 | **Attributes** | Boolean attributes | `active`, `enabled`, `isVip`, `isEnabled` | ✔ |
| 9 | **Metrics** | Numbers, order, statistics | `sortOrder`, `count`, `viewCount`, `level` | ✔ |
| 10 | **Price/Amount** | Currency, quantity | `*Price`, `*Amount`, `quantity`, `total*` | ✔ |
| 11 | **Schedule** | Date/time fields | `publishAt`, `expireAt`, `dueDate`, `*At` | △ Partial |
| 12 | **Audit** | Audit fields | `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | ✖ Hidden |
| 13 | **Actions** | Action buttons | `actions` | ✔ |

**The action column is never a declared `CrudList.Column`.** Row actions reach the table through
its `actions` prop (`RowActionDef[]`) or, for custom buttons, its `slots.rowActions` render —
either way the framework emits its own `_actions` column and keeps it out of the column-visibility
menu. A hand-declared column standing in for it (`<CrudList.Column field="…" header="">`) is
registered in that menu by its header, so an empty header lands there as a **nameless checkbox
that silently removes every action on the list**. Size it with `actionColumnWidth`, not `width`.
The audit script fails on this shape (`row-actions-as-nameless-column`).

### Intra-Group Sorting Rules

#### Identifier

```
1. entityId (PK)
2. code (unique code)
3. slug (URL slug)
```

#### Relations

```
1. parentId / parent (parent relation)
2. categoryId / category (primary category)
3. ownerId / owner (owner)
4. Other FKs (alphabetical)
```

#### Type/Category

```
1. type / *Type (main type)
2. status (status)
3. category / *Category (classification)
4. Other enums (alphabetical)
```

#### Primary Text

```
1. title (title)
2. name (name)
3. label (label)
4. displayName (display name)
```

#### Description

```
1. description (description)
2. summary (summary)
3. content (content)
```

#### Attributes

```
1. active (active status)
2. enabled / visible (general attributes)
3. is* (boolean flags - alphabetical: isEnabled, isVip)
4. show* (display settings - alphabetical)
```

#### Metrics

```
1. sortOrder / displayOrder (order)
2. level / depth (hierarchy)
3. *Count (counts - alphabetical)
4. *Size (sizes)
```

#### Price/Amount

```
1. regularPrice / originalPrice (regular price)
2. discountedPrice / salePrice (discounted price)
3. actualPrice / finalPrice (actual/final price)
4. *Amount (amounts - alphabetical)
5. quantity / qty (quantity)
6. total* (totals - alphabetical)
```

#### Schedule

Schedule fields are organized into 4 sub-groups, with **visible fields prioritized** within each sub-group.

```
[1] Publishing (visible first)
    1. publishAt           ✔ Visible

[2] Period (visible first)
    2. startAt             ✔ Visible
    3. endAt               ✔ Visible

[3] Deadline (visible first)
    4. expireAt            ✔ Visible
    5. dueDate             ✔ Visible
    6. pinnedExpireAt      ✖ Hidden

[4] Milestone (visible first)
    7. answeredAt          ✔ Visible
    8. assignedAt          ✖ Hidden
    9. resolvedAt          ✖ Hidden
    10. acceptedAt         ✖ Hidden
    11. completedAt        ✖ Hidden
```

**Sub-group Priority**:
1. Publishing → Period → Deadline → Milestone
2. Within each sub-group: Visible fields first, then hidden fields

#### Audit

```
1. createdAt
2. createdBy
3. updatedAt
4. updatedBy
```

---

## Basic Pattern (CrudList.Column)

This section documents the standard column structure using the `CrudList.Column` component.

### Standard Column Structure

```tsx
import { CrudList } from "@simplix-react/ui";
import { useEntityTranslation } from "@simplix-react/i18n/react";

function MyList() {
  const { fieldLabel, enumLabel } = useEntityTranslation("myEntity");

  return (
    <CrudList.Table>
      {/* Simple text column */}
      <CrudList.Column<MyEntityListDTO>
        field="name"
        header={fieldLabel("name")}
        sortable
      />

      {/* Boolean column (existing code: display prop) */}
      <CrudList.Column<MyEntityListDTO>
        field="isEnabled"
        header={fieldLabel("isEnabled")}
        display="boolean"
      />

      {/* Date column with format prop */}
      <CrudList.Column<MyEntityListDTO>
        field="date"
        header={fieldLabel("date")}
        format="date"
      />

      {/* Enum badge — PROJECT CONVENTION is the children-render below
          (resolveBootEnum + COLORMAP + enumLabel); see "Enum Badge with
          resolveBootEnum" in Advanced Pattern. The built-in display="badge"
          + variants is ALSO AVAILABLE but cannot unwrap the boot enum or
          apply enumLabel i18n, so prefer children-render for real enums. */}
      <CrudList.Column<MyEntityListDTO>
        field="status"
        header={fieldLabel("status")}
        display="badge"
        variants={{ ACTIVE: "success", INACTIVE: "secondary" }}
      />

      {/* Fixed width column */}
      <CrudList.Column<MyEntityListDTO>
        field="code"
        header={fieldLabel("code")}
        width={120}
      />
    </CrudList.Table>
  );
}
```

### Column Props Reference

| Prop | Type | Description |

|------|------|-------------|
| `field` | `keyof T` | Entity field name (required) |
| `header` | `string` | Column header text (use `fieldLabel()`) |
| `sortable` | `boolean` | Enable column sorting |
| `width` | `number` | Fixed column width in pixels |
| `minWidth` | `number` | The column's floor rather than its allowance — free text ellipsizes and the table spends leftover width here. Ignored when `width` is set |
| `minTableWidth` | `number` | The narrowest table worth drawing this column in. Below it the column is not rendered at all. Only for a value the detail panel also shows |
| `display` | `"badge" \| "boolean"` | Built-in display mode |
| `format` | `"date" \| "datetime" \| "relative"` | Date formatting mode |
| `variants` | `Record<string, string>` | Badge variant color map (with `display="badge"`) |
| `children` | `({ row, value }) => ReactNode` | Custom render function |

### Boolean Field Rendering (CONFIRMED RULE)

- **Existing code**: Preserve current rendering (typically `display="boolean"`)
- **NEW boolean columns**: Use Badge rendering pattern

```tsx
{/* Existing boolean column - keep as-is */}
<CrudList.Column<EntityListDTO>
  field="isEnabled"
  header={fieldLabel("isEnabled")}
  display="boolean"
/>

{/* NEW boolean column - use Badge rendering */}
<CrudList.Column<EntityListDTO> field="isVip" header={fieldLabel("isVip")}>
  {({ value }) => (
    <Badge variant={value ? "default" : "secondary"}>
      {value ? t("common.yes") : t("common.no")}
    </Badge>
  )}
</CrudList.Column>
```

---

## Advanced Pattern (Inline Render Recipes)

This section documents inline render patterns using `CrudList.Column` children for complex column rendering.

See [Cell Render Recipes](cell-components.md) for the complete recipe catalog.

### Enum Badge with resolveBootEnum

```tsx
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  ARCHIVED: "destructive",
};

<CrudList.Column<ProductListDTO> field="status" header={fieldLabel("status")}>
  {({ value }) => {
    const v = resolveBootEnum(value) as string;
    return (
      <Badge variant={STATUS_COLORS[v] ?? "secondary"}>
        {enumLabel("ProductStatus", v)}
      </Badge>
    );
  }}
</CrudList.Column>
```

### FK Relation Display

```tsx
<CrudList.Column<ProductListDTO> field="categoryId" header={fieldLabel("categoryId")}>
  {({ row }) => row.category?.name ?? ""}
</CrudList.Column>
```

### Icon + Text

```tsx
<CrudList.Column<ProductListDTO> field="type" header={t("product.productType")}>
  {({ value }) => {
    const v = resolveBootEnum(value) as string;
    const TypeIcon = TYPE_ICONS[v] ?? PackageIcon;
    return (
      <Flex gap="xs" align="center">
        <TypeIcon className="size-4 text-muted-foreground" />
        <Text size="sm">{enumLabel("ProductType", v)}</Text>
      </Flex>
    );
  }}
</CrudList.Column>
```

### Date / Time (custom cell)

Prefer the declarative `format` prop (`format="datetime" displayZone={zone}`). Drop to a cell render with an inline component (`InstantText` / `CalendarDateText` / `WallClockText` from `@simplix-react/ui`) only for custom empty text, a per-row zone, or an `Instant` shown as its zone-local date. Never format inline with `formatDateMedium(new Date(...))` — the component owns the parsing and zone math.

```tsx
<CrudList.Column<ProductListDTO> field="expiresAt" header={fieldLabel("expiresAt")}>
  {({ row }) => <InstantText value={row.expiresAt} displayZone={zone} format="date" fallback="—" />}
</CrudList.Column>
```

### Flag Badges (Multiple Boolean Flags)

```tsx
<CrudList.Column<ProductListDTO> field="isVip" header={t("product.specialFlags")}>
  {({ row }) => <FlagBadges row={row} />}
</CrudList.Column>
```

### Text Truncation

```tsx
<CrudList.Column<ProductListDTO> field="description" header={fieldLabel("description")}>
  {({ row }) => (
    <span className="max-w-[200px] block truncate">{row.description ?? ""}</span>
  )}
</CrudList.Column>
```

### Custom Shared Component

```tsx
<CrudList.Column<ProductListDTO> field="intervals" header={t("product.weeklyPreview")}>
  {({ row }) => (
    <MiniWeeklyGrid
      intervals={row.intervals}
      mode={resolveBootEnum(row.mode) as string}
      width={120}
    />
  )}
</CrudList.Column>
```

### Country Formatting

```tsx
<CrudList.Column<ProductListDTO> field="country" header={fieldLabel("country")}>
  {({ row }) => formatCountry(row.country, locale)}
</CrudList.Column>
```

---

## Alignment Guidelines (MANDATORY)

### Cell Alignment Rules

| Category | Example Fields | Alignment | Reason |

|----------|----------------|-----------|--------|
| **Fixed-length fields** | name, label, email, code, slug, date | `center` | Predictable width, visual balance |
| **Long text/sentences** | title, description, summary, content | `left` | Natural reading direction |
| **Bounded-range numbers** | bitCount, level, priority (known min~max, short digits) | `center` | Narrow value range, visual balance over decimal alignment |
| **Unbounded/large numbers** | totalAmount, fileSize, revenue (variable length, decimals) | `right` | Decimal point alignment, digit comparison |
| **Action buttons** | actions | `center` or `right` | Visual balance / prevent layout shift |
| **All other fields** | badges, status, enum, boolean, UUID | `center` | Visual balance |

### Empty Value Display (MANDATORY)

**Rule**: Empty or null values MUST be displayed as `-` (or empty string), with consistent alignment per column type.

---

## i18n Requirements (MANDATORY)

```tsx
import { useEntityTranslation } from "@simplix-react/i18n/react";
import { resolveBootEnum } from "@simplix-react-ext/simplix-boot-utils";

const { fieldLabel, enumLabel } = useEntityTranslation("product");

// Column header
<CrudList.Column field="status" header={fieldLabel("status")} />

// Enum label in render
{({ value }) => {
  const v = resolveBootEnum(value) as string;
  return <Badge>{enumLabel("ProductStatus", v)}</Badge>;
}}

// Custom strings — useTranslation REQUIRES a namespace argument
// (module widget strings live under "<module>/widgets")
const { t } = useTranslation("product/widgets");
<CrudList.Column field="isVip" header={t("product.specialFlags")} />
```

See [i18n Reference](i18n.md) for complete i18n guide.

---

## Quick Troubleshooting

| Issue | Cause | Solution |

|-------|-------|----------|
| Column not showing | `field` typo | Match DTO field name exactly |
| Badge color missing | colorMap not set | Add an inline `COLORMAP[resolveBootEnum(value)]` in the children render (convention); the built-in `variants` prop also works for the no-i18n case |
| Enum shows raw value | Missing `resolveBootEnum` | Use `resolveBootEnum(value)` before display |
| Date not formatted | No `format` prop | Add `format="date"` or use manual formatting |
| FK shows ID not name | Using `field` directly | Use children render to access `row.category?.name` |
| No sort icon | `sortable` not set | Add `sortable` prop to column |

---

## Checklist

**For Which Columns Exist (MANDATORY):**
- [ ] Every field on the row passed the five tests; the ones that failed are named in the panel
- [ ] The list is not stopped at its wireframe's count — the frame is a floor
- [ ] Column count is calibrated against two accepted sibling lists, not against the DTO
- [ ] PK, `deleted`, the audit quartet and raw FK ids are out
- [ ] Any `minTableWidth` column's value is also in the detail panel, and the wide set's declared
      widths sum under the threshold
- [ ] Where columns drop, the row's secondary caption line takes the dropped values back and drops
      them again when the columns return

**For Column Order (MANDATORY):**
- [ ] Columns follow group order (Drag > Select > Identifier > Relations > Type > Text > Desc > Attr > Metrics > Schedule > Audit > Actions)
- [ ] Intra-group sorting follows rules (e.g., title before name)
- [ ] Schedule fields follow sub-group order (Publishing > Period > Deadline > Milestone)
- [ ] Within Schedule sub-groups, visible fields come before hidden fields

**For Visibility (MANDATORY):**
- [ ] **Identifier** group hidden: `entityId`, `code`, `slug`
- [ ] **Relations** group hidden: FK IDs (show relation name via children render instead)
- [ ] **Schedule** group partial hidden: `pinnedExpireAt`, `assignedAt`, `resolvedAt`, `acceptedAt`, `completedAt`
- [ ] **Audit** group hidden: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`

**For Rendering (MANDATORY):**
- [ ] Enum fields use `resolveBootEnum()` + `Badge` with `enumLabel()`
- [ ] FK relation fields show related entity name (not raw ID)
- [ ] Date/time fields use the `format` prop or an inline component (`InstantText` / `CalendarDateText` / `WallClockText`) — never inline `formatDateMedium(new Date(...))`
- [ ] Existing boolean fields keep current rendering (typically `display="boolean"`)
- [ ] NEW boolean fields use Badge rendering pattern
- [ ] Column headers use `fieldLabel()` or `t()` for i18n
- [ ] Long text fields have truncation when appropriate

**For Alignment (MANDATORY):**
- [ ] Fixed-length fields (name, label, email, code, date) are center-aligned
- [ ] Long text fields (title, description, summary) are left-aligned
- [ ] Bounded-range numbers (bitCount, level, priority — known min~max, short digits) are center-aligned
- [ ] Unbounded/large numbers (totalAmount, fileSize, revenue — variable length, decimals) are right-aligned
- [ ] All other fields (badges, status, enum, boolean) are center-aligned

**For Verification:**
- [ ] `pnpm typecheck` passes
- [ ] Column order and rendering match the guidelines

---

## Related references within this skill

1. Filter specialization → `../filters/overview.md`
2. CUSTOMIZE parent (framework components, recipes, mutations) → `../overview.md`
3. AUDIT (MANDATORY after completing column work on existing modules) → `../../audit/overview.md`

## Sibling references in this directory

1. Cell render recipes (Badge, Icon, FK, enum, date, boolean) → `cell-components.md`
2. Drag-drop reordering with `adaptOrvalOrder` → `drag-drop.md`
3. Column i18n integration → `i18n.md`
