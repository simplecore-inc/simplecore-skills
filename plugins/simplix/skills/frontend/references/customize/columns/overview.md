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
- **Deciding which fields are columns at all** (the framework has no hidden-by-default state - invariant #54)

---

## User Confirmation Workflow (MANDATORY)

**Before making any changes**, Claude MUST present the analysis results and get user confirmation.

### Step 0: Analyze and Present Changes

1. **Read the target file** and analyze current state
2. **Present findings** to the user with the following categories:
   - Column Order: Current vs. Recommended order
   - Cell Alignment: Fields with incorrect alignment
   - Columns to Remove: Fields that earn no column ([How Many Columns](#how-many-columns---which-fields-earn-one-mandatory)) - removed from source, since nothing is hidden by default
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
Question: "Columns to Remove - remove the following fields from the list? [field list]"
Options:
- "Apply all" - remove all
- "Keep" - keep current
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

### Step 3: Remove What Earns No Column

The framework has no declarative hidden-by-default: `hiddenColumns` is a runtime toggle the operator opens, so a field that should not be a column is removed from source, and the imports it leaves unused go with it (invariant #54). Which fields earn a column is [How Many Columns](#how-many-columns---which-fields-earn-one-mandatory) - the PK, raw FK ids and the audit quartet never do.

### Step 4: Apply Rendering Patterns

Select appropriate rendering for each column based on field type:
- For **enum** columns, use a children render that resolves the boot enum and draws `StatusBadge` with the enum's ONE shared tone map from the project UI package and the `enumLabel` text (`../../audit/registry/tones-and-badges.md`). A module-local status color map is a defect: the audit's `status-map-resurrect` fails a map under a name the project declares retired (`audit.statusMapResurrect` in `.claude/simplix.json`), and `inline-dark-tone-map` lists the other status maps for review; only a categorical palette stays local
- Use children render `{({ row, value }) => ...}` for any complex / relational / i18n rendering
- `display` prop is the simple built-in for the no-i18n case (`"boolean"` for booleans; `"badge"` ALSO available, optionally with the `variants` map, but it skips `resolveBootEnum`/`enumLabel`)
- Use `format` prop for date formatting (`"date"`, `"datetime"`, `"relative"`)

### Step 5: Apply Alignment Rules

Apply alignment according to [Alignment Guidelines](#alignment-guidelines-mandatory).

### Step 6: Verify

- Run `pnpm typecheck` to ensure no TypeScript errors
- Confirm column order and rendering match the guidelines

---

## How Many Columns - Which Fields Earn One (MANDATORY)

The ordering rules below say where a column goes. They do not say whether it exists, and a list
that never asks that question comes out at the two or three columns a wireframe had room to
sketch while its DTO offers twenty-six fields and the reader is sent into the detail panel for
every one of them.

**A wireframe's column count is a floor, never a ceiling.** A board is drawn on a page far
narrower than a screen: what it draws is what must be there, not all that may be. A list-detail
page lays no grid at all while the detail is closed, so the list has the whole page - read the
frame as a ceiling and every list in the product stops at the width of a sketch.

**A field earns a column when all five hold.** Anything failing one waits in the detail panel.

1. **A reader uses it to pick a row or to scan the list** - the name they search by, the status
   they act on, the date they are chasing. Not a value somebody reads once they have already
   decided which record to open.
2. **The value differs across rows.** A tab strip or a forced scope that pins a field makes that
   field a constant inside the tab; a column of one repeated value is furniture.
3. **It reads at a glance** - a badge, a bounded number, a date, a short name. A paragraph is a
   panel field, not a column.
4. **Most rows have a value.** A field set on three rows in fourteen is an annotation on the
   identity cell (a badge beside the name), not a column blank eleven times.
5. **The reader is allowed to see it.** A value behind a different permission group renders as
   nothing for half the audience - gate the column, or leave it out.

**Always out, whatever the five say**: the UUID primary key, `deleted` / `deletedTimestamp`, the
audit quartet (`CrudDetail`'s `auditData` already carries it - invariant #54), and raw FK ids
(render the related name instead).

**Calibrate against sibling lists in the same product, not against the DTO.** A mature console
runs about five to seven columns a table; one at two has stopped early and one at fifteen has
copied the DTO. Count the columns on two lists a reviewer already accepted before choosing.

### A list that is sometimes narrow declares two sets, not one

A list-detail screen loses most of its width the moment a row opens. `CrudList.Column`'s
`minTableWidth` is the framework's answer: below that many pixels **of the table's own width** the
column is not rendered at all - no header, no cells, no entry in the columns dropdown.

- **Only a value the detail panel also shows may carry one.** A column that disappears takes its
  value with it and there is no "show anyway"; the arrangement works because the thing that took
  the width is the panel carrying the value. A value that lives nowhere else stays in the table
  however narrow it gets.
- **One threshold for the product, declared once.** A per-list threshold answers per screen a
  question the reader asks once - "is this list wide enough to read across".
- **The threshold has three bounds**: above the widest pinned list pane, at or below the narrowest
  full-page list container the product targets, and **at or above what each wide set actually
  measures**. Miss the third and the set switches on inside a table that then scrolls sideways
  with the row actions past the right edge - the failure the prop exists to prevent, caused by the
  prop. Sum each wide set's declared `width` / `minWidth`, add the cell padding per column and the
  row-action column, and keep the total under the threshold.
- **A column whose absence makes another drawn column read wrong never drops.** A record's
  answer and its withdrawal, a status and the date that ended it: drop the second and the first
  states something untrue ("granted" on a withdrawn consent). Mark it kept (the kit's `keep`), so
  the narrow table holds it beside the leading and the sorted column, and lead with it in a list
  that lives in a drawer. Everything kept adds to the narrowest table, and a list whose kept set
  outgrows its narrowest pane falls to cards against a table design. Where two such columns do
  not both fit, keep the one whose absence makes the row say something false, and let the one
  whose absence only leaves the row silent drop; measure the narrowest pane before deciding.
- **Keeping a column at the design's window moves another column out of it, so read that window before
  and after.** A table holds as many columns as its pane has width for (a fluid column asks 200 px, so
  about six fit a 1440 window), and a kept column takes its width from the columns before it. A kept release
  size pushed the platform out of the window, and a kept audit category pushed the details out and, at 1024, the
  record. Keep a column only where the column it displaces matters less and the table still holds at the
  narrowest width in both languages. A design entry that lists the columns the list draws at its window, apart
  from the columns only the columns menu offers, lets a rendered check compare the entry with the painted headers
  (the table's `th` labels) and name each declared column that is not drawn; one that lists every column cannot be
  compared, since the ladder drops the tail on purpose.
- **A column the screen adds after the generated ones takes a tier like them.** A derived marker
  appended without `minTableWidth` draws at every width and silently joins the always-drawn set;
  with the leading and the sorted columns that set can outgrow a tablet pane, and the list falls
  to cards at 1024 with no width it was designed for. Give it the running width of the table up to
  it, or use a kit that tiers every column after the leading ones (console-core `ladderColumns`).
- **A fixed block of leading columns is an always-drawn set too, and a scrollbar is enough to break
  it.** A list that drew its first four columns, the sorted one and the row actions at every width
  held a 1024 pane by one pixel (886 of 887) and fell to cards where a classic scrollbar takes 15px
  of layout width. Widths trimmed to fit are not the fix, since the next screen meets the same
  margin. Let every column after the naming one ladder, the leading block last and from its end
  (console-core `tableColumnsOf`), so the table narrows before it overflows and cards are left to a
  pane that cannot hold the naming, sorted and kept columns with the actions. Read a table list at
  its pane width and 15px less (a viewport of 1009 for 1024) before calling it a table at 1024.
- **The secondary line under a row's name is the narrow form of those columns.** Where a board
  stacks 「code · rank · source」 into a caption, those become columns when there is room - and the
  caption has to drop what the columns took, or every row prints its values twice. Measure the
  list root (`<CrudList ref={…}>` + `useContainerWidth`) to decide what the caption still carries.

## Column Order Guidelines

This section defines the standard column order for data tables (invariant #18). Whether a field is a column at all is [How Many Columns](#how-many-columns---which-fields-earn-one-mandatory); nothing is hidden by default, because the framework has no such state (invariant #54).

### Column Group Order

| Order | Group | Description | Example Fields |
|-------|-------|-------------|----------------|
| 1 | **Drag Handle** | Drag reorder handle | `displayOrder` (when used) |
| 2 | **Selection** | Row selection checkbox | (built-in) |
| 3 | **Identifier** | The human identifier the row is known by - the PK is never a column | `code`, `slug` |
| 4 | **Relations** | The referenced record's name - never the raw FK id | `category?.name`, `owner?.name` |
| 5 | **Type/Category** | Enum types, classification | `type`, `status`, `category` |
| 6 | **Primary Text** | Main text (clickable) | `title`, `name`, `label` |
| 7 | **Description** | Description, summary text | `description`, `summary`, `content` |
| 8 | **Attributes** | Boolean attributes | `active`, `enabled`, `isVip`, `isEnabled` |
| 9 | **Metrics** | Numbers, order, statistics, amounts | `sortOrder`, `count`, `viewCount`, `level`, `*Price`, `*Amount`, `quantity`, `total*` |
| 10 | **Schedule** | Date/time fields | `publishAt`, `expireAt`, `dueDate`, `*At` |
| 11 | **Audit** | Only under the domain exception of invariant #18 - otherwise removed, since `auditData` carries it | `createdAt`, `createdBy`, `updatedAt`, `updatedBy` |
| 12 | **Actions** | Action buttons | `actions` |

**The action column is never a declared `CrudList.Column`.** Row actions reach the table through
its `actions` prop (`RowActionDef[]`) or, for custom buttons, its `slots.rowActions` render -
either way the framework emits its own `_actions` column and keeps it out of the column-visibility
menu. A hand-declared column standing in for it (`<CrudList.Column field="…" header="">`) is
registered in that menu by its header, so an empty header lands there as a **nameless checkbox
that silently removes every action on the list**. Size it with `actionColumnWidth`, not `width`.
The audit script fails on this shape (`row-actions-as-nameless-column`).

### Intra-Group Sorting Rules

#### Identifier

```
1. code (unique code)
2. slug (URL slug)
```

#### Relations

```
1. parent (parent relation)
2. category (primary category)
3. owner (owner)
4. Other references (alphabetical)
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
5. regularPrice / originalPrice (regular price)
6. discountedPrice / salePrice (discounted price)
7. actualPrice / finalPrice (actual/final price)
8. *Amount (amounts - alphabetical)
9. quantity / qty (quantity)
10. total* (totals - alphabetical)
```

#### Schedule

Schedule fields are organized into sub-groups. Which of them earn a column is [How Many Columns](#how-many-columns---which-fields-earn-one-mandatory); the ones that do are ordered:

```
[1] Publishing
    1. publishAt

[2] Period
    2. startAt
    3. endAt

[3] Deadline
    4. expireAt
    5. dueDate
    6. pinnedExpireAt

[4] Milestone
    7. answeredAt
    8. assignedAt
    9. resolvedAt
    10. acceptedAt
    11. completedAt
```

**Sub-group Priority**: Publishing → Period → Deadline → Milestone

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

      {/* Enum badge - a real boot enum takes the children render in
          "Enum Badge with resolveBootEnum" (Advanced Pattern): resolveBootEnum
          + StatusBadge with the shared tone map + enumLabel. The built-in
          display="badge" + variants cannot unwrap the boot enum or apply
          enumLabel i18n, so it is for a plain string value only. */}
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
| `minWidth` | `number` | The column's floor rather than its allowance - free text ellipsizes and the table spends leftover width here. Ignored when `width` is set |
| `fitContent` | `boolean` | The cells draw their content whole (a badge, a chip): the declared `width` becomes a floor a longer value widens, the cell never truncates, and a table that outgrows its pane drops a tier or scrolls. On by default for `display="badge"` and `display="boolean"`; the console kit sets it for a fixed column whose rows draw badges |
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

The enum's ONE tone map lives in the project UI package (`../../audit/registry/tones-and-badges.md`); a module-local status color map is a defect, and the audit's `status-map-resurrect` fails a map under a name the project declares retired (`audit.statusMapResurrect` in `.claude/simplix.json`), and `inline-dark-tone-map` lists the other status maps for review.

The column itself is [Cell Render Recipes § Enum Badge](cell-components.md#enum-badge).

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

Prefer the declarative `format` prop (`format="datetime" displayZone={zone}`). Drop to a cell render with an inline component (`InstantText` / `CalendarDateText` / `WallClockText` from `@simplix-react/ui`) only for custom empty text, a per-row zone, or an `Instant` shown as its zone-local date. Never format inline with `formatDateMedium(new Date(...))` - the component owns the parsing and zone math.

```tsx
<CrudList.Column<ProductListDTO> field="expiresAt" header={fieldLabel("expiresAt")}>
  {({ row }) => <InstantText value={row.expiresAt} displayZone={zone} format="date" fallback={t("<module>.noExpiry")} />}
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
| **Fixed-length fields** | code, slug, date | `center` | Predictable width, visual balance |
| **Variable-length text** | name, label, email, title, description, summary, content | `left` | Natural reading direction |
| **Bounded-range numbers** | bitCount, level, priority (known min~max, short digits) | `center` | Narrow value range, visual balance over decimal alignment |
| **Unbounded/large numbers** | totalAmount, fileSize, revenue (variable length, decimals) | `right` | Decimal point alignment, digit comparison |
| **Action buttons** | actions | `center` or `right` | Visual balance / prevent layout shift |
| **All other fields** | badges, status, enum, boolean, UUID | `center` | Visual balance |

### Column Width

**A badge is drawn whole or not at all.** A fixed `width` column truncates its cells and keeps them out of the table's width, so a badge longer than the column in one language (a channel name in Korean) is cut mid-word inside its cell, the table keeps its width, and the drop-a-tier check never sees an overflow. A column of badges carries `fitContent`, which makes its width a floor; a table that then scrolls sideways is a named, focusable region with its hidden edge faded (the framework `Table` does this). `badgeCutByItsBox` in `audit-rendered.mjs` reads the painted page for a badge cut by a box that does not scroll, or by its own label.

A column is as wide as its header, its face and its longest option label, in both languages. The kit gives each contract kind a width (an enum column is 120px whatever its option labels are), so a column whose header, code face or longest label is wider declares its own `width` in the list and in the board frame, or the text is clipped with an ellipsis. The heads a list draws at its default width are read from the page, and a column the entry lists that the page does not draw is a finding.

A column set written by hand has no width ladder: `contract.columns` gives every column after the fourth a `minTableWidth`, and a list whose columns carry none falls to cards below the sum of their widths, a width a laptop's pane can fall under. Pass the drawn fields to `contract.columns` (`../../screen-workflow.md` rule 33).

Enforcement: review - a clipped header shows only in a painted list, in each language, and no source scan reads it.

### Empty Value Display (MANDATORY)

**Rule**: An empty or null cell renders the shared `EmptyValue` (`../../audit/registry/states-and-fallbacks.md`), with consistent alignment per column type - never a hand-written dash literal.

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

// Custom strings - useTranslation REQUIRES a namespace argument
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
| Badge color missing | No tone for the resolved value | Render `StatusBadge` with the enum's shared tone map over `resolveBootEnum(value)` in the children render; the built-in `variants` prop is for a plain string value only |
| Enum shows raw value | Missing `resolveBootEnum` | Use `resolveBootEnum(value)` before display |
| Date not formatted | No `format` prop | Add `format="date"` or use manual formatting |
| FK shows ID not name | Using `field` directly | Use children render to access `row.category?.name` |
| No sort icon | `sortable` not set | Add `sortable` prop to column |

---

## Checklist

**For Which Columns Exist (MANDATORY):**
- [ ] Every field on the row passed the five tests; the ones that failed are named in the panel
- [ ] The list is not stopped at its wireframe's count - the frame is a floor
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

**For Removed Fields (MANDATORY):**
- [ ] The PK is not a column; the row's human identifier (`code` / `slug`) is, where it passes the five tests
- [ ] No raw FK id is a column; the relation shows the referenced record's name instead
- [ ] The audit quartet is not a column, except under invariant #18's domain exception
- [ ] Every field removed from the list is removed from source with its now-unused imports - nothing is "hidden by default" (invariant #54)

**For Rendering (MANDATORY):**
- [ ] Enum fields use `resolveBootEnum()` + `StatusBadge` with the shared tone map and `enumLabel()`
- [ ] FK relation fields show related entity name (not raw ID)
- [ ] Date/time fields use the `format` prop or an inline component (`InstantText` / `CalendarDateText` / `WallClockText`) - never inline `formatDateMedium(new Date(...))`
- [ ] Existing boolean fields keep current rendering (typically `display="boolean"`)
- [ ] NEW boolean fields use Badge rendering pattern
- [ ] Column headers use `fieldLabel()` or `t()` for i18n
- [ ] Long text fields have truncation when appropriate

**For Alignment (MANDATORY):**
- [ ] Fixed-length fields (code, slug, date) are center-aligned
- [ ] Variable-length text (name, label, email, title, description, summary) is left-aligned
- [ ] Bounded-range numbers (bitCount, level, priority - known min~max, short digits) are center-aligned
- [ ] Unbounded/large numbers (totalAmount, fileSize, revenue - variable length, decimals) are right-aligned
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
