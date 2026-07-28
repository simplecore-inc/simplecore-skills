# Cell Render Recipes

Inline render pattern catalog for `CrudList.Column` children in the `@simplix-react` framework.

In `@simplix-react`, there are no standalone cell components (UuidCell, EnumBadgeCell, etc.). Instead, use inline render patterns via the `CrudList.Column` children prop: `{({ row, value }) => ...}`.

---

## Recipe Index

| Recipe | Use When | Key Imports |

|--------|----------|-------------|
| [Enum Badge](#enum-badge) | Boot enum fields (status, type) | `resolveBootEnum`, `Badge` (built-in `display="badge"`+`variants` also exists, no i18n) |
| [FK Relation](#fk-relation) | Foreign key fields showing related name | (none extra) |
| [Boolean Badge](#boolean-badge-new-columns) | NEW boolean columns | `Badge` |
| [Boolean Display Prop](#boolean-display-prop-existing) | Existing boolean columns | (built-in prop) |
| [Icon + Text](#icon--text) | Enum with icon decoration | `Flex`, `Text`, icon component |
| [Date format Prop](#date-format-prop) | Simple date display | (built-in prop) |
| [Date/Time Custom](#date--time-cells--custom-inline-components) | Custom date/time cell | `InstantText` / `CalendarDateText` |
| [Flag Badges](#flag-badges) | Multiple boolean flags in one column | `Badge` or shared component |
| [Truncation](#truncation) | Long text fields | (inline styles) |
| [Country](#country-formatting) | Country code display | `formatCountry` |
| [Custom Component](#custom-shared-component) | Complex rendering extracted to component | (varies) |

---

## Enum Badge

For boot enum fields that need color-coded badge display.

```tsx
import { resolveBootEnum } from "@simplix-react-ext/simplix-boot-utils";
import { Badge } from "@simplix-react/ui";

// Define color map outside component
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  ARCHIVED: "destructive",
};

// In JSX
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

**Key points:**
- Always use `resolveBootEnum()` to extract the string value from boot enum objects
- Use `enumLabel("<EnumType>", value)` from `useEntityTranslation()` for i18n display
- Define color maps as module-level constants, not inline
- The inline render is the convention here because it lets you run `enumLabel()` for the displayed text. `CrudList.Column` also exposes a built-in `display="badge"` + `variants={{ <value>: "<variant>" }}` prop pair (`variants` is typed `Record<string, BadgeVariants["variant"]>`), but it renders the raw value without `enumLabel()`, so prefer the inline children render whenever the badge text needs i18n.

---

## FK Relation

For foreign key fields where the related entity name should be displayed instead of the raw ID.

```tsx
<CrudList.Column<ProductListDTO> field="categoryId" header={fieldLabel("categoryId")}>
  {({ row }) => row.category?.name ?? ""}
</CrudList.Column>
```

**Key points:**
- The `field` is the FK ID field (e.g., `categoryId`) for sorting/filtering
- Access the nested relation object via `row` (e.g., `row.category?.name`)
- Use `?? ""` for null safety

---

## Boolean Badge (NEW Columns)

★ **CONFIRMED RULE**: New boolean columns MUST use Badge rendering, not the `display="boolean"` prop.

```tsx
<CrudList.Column<ProductListDTO> field="isVip" header={fieldLabel("isVip")}>
  {({ value }) => (
    <Badge variant={value ? "default" : "secondary"}>
      {value ? t("common.yes") : t("common.no")}
    </Badge>
  )}
</CrudList.Column>
```

---

## Boolean Display Prop (Existing)

Existing boolean columns that already use `display="boolean"` should be preserved as-is.

```tsx
<CrudList.Column<ProductListDTO>
  field="isEnabled"
  header={fieldLabel("isEnabled")}
  display="boolean"
/>
```

---

## Icon + Text

For enum fields with icon decoration alongside text.

```tsx
import { Flex, Text } from "@simplix-react/ui";
import { PackageIcon } from "lucide-react";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PHYSICAL: PackageIcon,
  DIGITAL: DownloadIcon,
  SERVICE: WrenchIcon,
};

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

**Key points:**
- Use `Flex` from `@simplix-react/ui` for layout (never raw `<div>`)
- Use `Text` for text content
- Define icon maps as module-level constants

---

## Date format Prop

For simple date display, use the built-in `format` prop.

```tsx
{/* Date only */}
<CrudList.Column<ProductListDTO>
  field="date"
  header={fieldLabel("date")}
  format="date"
/>

{/* Date + time — an Instant needs displayZone (site or app zone) */}
<CrudList.Column<ProductListDTO>
  field="createdAt"
  header={fieldLabel("createdAt")}
  format="datetime"
  displayZone={zone}
/>

{/* Relative time (e.g., "3 hours ago") */}
<CrudList.Column<ProductListDTO>
  field="lastSeen"
  header={fieldLabel("lastSeen")}
  format="relative"
/>
```

`format="date"` is zone-neutral (for a `LocalDate`); `format="datetime"` renders an `Instant` and needs `displayZone` (a string, or `(row) => zone` for a per-row site zone). An `Instant` shown date-only cannot use `format="date"` (zone-neutral) — use `InstantText` (below).

---

## Date / Time Cells — custom (inline components)

When a date cell needs custom empty text, a per-row zone, or an `Instant` shown as its zone-local date, drop to a cell render with a framework inline component instead of the `format` prop:

```tsx
<CrudList.Column<ProductListDTO> field="expiresAt" header={fieldLabel("expiresAt")}>
  {({ row }) => <InstantText value={row.expiresAt} displayZone={zone} format="date" fallback="—" />}
</CrudList.Column>
```

**Key points:**
- NEVER call `formatDateTime` / `formatDateMedium` (or wrap a value in `new Date(...)`) inline in a cell — `InstantText` / `CalendarDateText` / `WallClockText` (from `@simplix-react/ui`) own the parsing and zone math.
- Read the typed value from `row.<field>`, not the untyped `value` argument.
- Full kind → component matrix (detail row · inline text · list column) → `customize/datetime-fields.md`.

---

## Flag Badges

For displaying multiple boolean flags in a single column.

```tsx
{/* Option A: Inline rendering */}
<CrudList.Column<ProductListDTO> field="isVip" header={t("product.specialFlags")}>
  {({ row }) => (
    <Flex gap="xs">
      {row.isVip && <Badge variant="default">VIP</Badge>}
      {row.isBlacklisted && <Badge variant="destructive">Blocked</Badge>}
    </Flex>
  )}
</CrudList.Column>

{/* Option B: Extract to shared component when 3+ flags */}
<CrudList.Column<ProductListDTO> field="isVip" header={t("product.specialFlags")}>
  {({ row }) => <FlagBadges row={row} />}
</CrudList.Column>
```

**Key points:**
- Use one column for related boolean flags to avoid column bloat
- Extract to a shared component when the logic involves 3+ flags

---

## Truncation

For long text fields that need width constraints.

```tsx
<CrudList.Column<ProductListDTO> field="description" header={fieldLabel("description")}>
  {({ row }) => (
    <span className="max-w-[200px] block truncate">
      {row.description ?? ""}
    </span>
  )}
</CrudList.Column>
```

---

## Country Formatting

For displaying country codes as localized country names.

```tsx
<CrudList.Column<ProductListDTO> field="country" header={fieldLabel("country")}>
  {({ row }) => formatCountry(row.country, locale)}
</CrudList.Column>
```

---

## Custom Shared Component

For complex rendering that should be extracted into a reusable component.

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

### When to Extract

Extract to a shared component when:
- The render logic exceeds ~10 lines
- The same pattern is used in 2+ list files
- The rendering involves complex state or interactions
- The component has its own props interface

### Extraction Guidelines

- Place shared column render components in the entity's widget directory (e.g., `modules/<domain>/src/widgets/<entity>/flag-badges.tsx`)
- Keep the component focused on display only (no data fetching)
- Accept the minimum props needed (typically just the row or specific fields)
