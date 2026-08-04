> **CUSTOMIZE** category reference inside this skill. Loaded via the Task Router when the task modifies scaffolded widgets, composes `CrudList` / `CrudForm` / `CrudDetail`, or adds layout primitives, custom editors, map / tree views. Sibling files: `framework-components.md`, `recipes.md`, `consistency-checklist.md`. Specializations: `filters/` and `columns/` subdirectories.

# Widget Customization Guide (CUSTOMIZE overview)

Rules and patterns for customizing scaffolded code and composing framework components.

## Related references within this skill

1. Precedent check — MANDATORY before building a new or reshaped screen (invariant #51) → `precedent-check.md`
2. Framework components catalog → `framework-components.md`
3. Customization recipes (step-by-step) → `recipes.md`
4. CRUD page consistency checklist (list/detail/card/cross-cutting layout standard) → `consistency-checklist.md`
5. Props / callback conventions → `../scaffold/props-conventions.md`
6. Filter specialization → `filters/overview.md`
7. Column specialization → `columns/overview.md`
8. DESIGN (framework contracts that this customization builds on) → `../framework/overview.md`
9. SCAFFOLD (what this customization modifies) → `../scaffold/overview.md`
10. AUDIT (MANDATORY after modifying existing widgets) → `../audit/overview.md`

---

## 1. Cardinal Rules

### Rule 1: Never Use Raw HTML for Layout

```tsx
// FORBIDDEN
<div className="flex items-center gap-2">...</div>
<div className="space-y-4">...</div>

// REQUIRED
<Flex align="center" gap="sm">...</Flex>
<Stack gap="md">...</Stack>
```

Layout primitives: `Flex`, `Stack`, `Grid`, `Container`, `Section`, `Card`.

### Rule 2: Always Use Framework Components First

Before writing custom UI, check if a framework component exists. If a needed variant/feature is missing, propose adding it to `@simplix-react/ui` rather than building a one-off.

### Rule 3: All Strings Must Be i18n Keys

No hardcoded user-visible strings. Use `useTranslation()` or `useEntityTranslation()`.

```tsx
// FORBIDDEN
<Button>Save</Button>
<p>No data found</p>

// REQUIRED
<Button>{t("common.save")}</Button>
<p>{t("entity.emptyTitle")}</p>
```

### Rule 4: Boot Enum Fields Need resolveBootEnum

Boot API returns enums as `{ type, value, label }` objects. Always use `resolveBootEnum()` when reading enum values from API responses.

**This applies to ALL contexts where enum values are consumed:**
- List column rendering
- Form initial values
- Detail field display
- **Update DTO assembly (for-edit → update conversion)** — failing to resolve causes `HttpMessageNotReadableException: Cannot deserialize value from Object value` server error

```tsx
import { resolveBootEnum } from "@simplix-react-ext/simplix-boot-utils";

// In list columns
const v = resolveBootEnum(value);
return <Badge>{enumLabel("entityField", v)}</Badge>;

// In form defaults
const initialType = resolveBootEnum(data?.fieldType) || "DEFAULT";

// In update DTO assembly (CRITICAL — for-edit response has enum objects)
const dto: UpdateDTO = {
  ...form,
  enumField: (resolveBootEnum(form.enumField) ?? form.enumField) as UpdateDTO["enumField"],
};
```

### Rule 5: Check Existing Patterns Before Implementing

When adding UI elements (action buttons, footers, headers, toolbars, etc.), **always read the framework's existing component source** before writing custom layout. Specifically:

- **Action button layout** → Read `CrudDetail.DefaultActions` source for the standard `[Left] ... [Delete icon] [Primary]` pattern
- **Editor footer** → Read `EditorFooter` source (it uses `justify-between`)
- **Panel header** → Read `PanelHeader` source for `children` slot usage
- **Delete confirmation** → Read `CrudDelete` + `useCrudDeleteDetail` for the standard wiring

Never guess at button placement or layout — the framework defines the pattern, and all pages must be consistent.

This rule scales with scope: for a single UI element, read the framework component source (above); for a whole NEW screen or a structural reshape, run the full precedent check — classify the screen's shape, read TWO same-shape precedent screens end to end, and clone their structure (`precedent-check.md`, invariant #51).

### Rule 6: SelectField with Async-Loaded Options — MUST Gate on Loading

※ **CRITICAL** — when a Radix Select has a `value` set but no matching option exists at that moment, it shows an empty trigger, and **even after the options load later, it does not refresh the trigger text while closed.**

This problem occurs in the pattern where **multiple independent queries** load data in parallel and feed the SelectField's `value` and `options` separately:

```
Timeline:
  Query A (value source)    ──loaded──┐
  Query B (options source)  ─────────loading────loaded──
                                      ↑
                            SelectField renders: value="uuid-123", options=[{—, NONE}]
                            → Radix: no matching option → empty trigger
                            → trigger text not refreshed even after options load ✖
```

**Required pattern: render only after ALL data sources finish loading**

```tsx
// ✖ WRONG — only checks the value source
{itemQuery.isLoading ? (
  <Loading />
) : (
  <SelectCard options={categoryOptions} value={assignment.fromCategoryId} />
)}

// ✔ CORRECT — check BOTH the value source AND the options source
{itemQuery.isLoading || categoryQuery.isLoading ? (
  <Loading />
) : (
  <SelectCard options={categoryOptions} value={assignment.fromCategoryId} />
)}
```

**Supplementary pattern: provide a direct fallback instead of useEffect synchronization**

When the SelectField's value is synchronized via `useEffect` → `setState`, the state is empty on the first render, so `undefined` is passed. Provide a fallback directly from the source data:

```tsx
// ✖ WRONG — assignment = undefined until useEffect runs → empty Select
<SelectCard assignment={localAssignments[item.id!]} />

// ✔ CORRECT — direct fallback from the source data
<SelectCard
  assignment={localAssignments[item.id!] ?? {
    fromId: item.policy?.fromId || NONE_VALUE,
    toId: item.policy?.toId || NONE_VALUE,
  }}
/>
```

**Checklist (SelectField + async data):**

- ☐ Always include the `isLoading` of the query that supplies the SelectField's `options` in the gate condition
- ☐ If the state that supplies the SelectField's `value` is useEffect-based, provide a fallback
- ☐ Because other components on the same screen (Detail, etc.) that display the value as text hide the problem, **always re-verify when displaying it as a Select in a form**

### Rule 7: Consistent Callback Prop Names

| Prop | When to Use |
| --- | --- |
| `onSuccess` | After successful create/update/save (NOT `onSaved`, `onDone`) |
| `onClose` | Panel/dialog dismiss (panel variant) |
| `onBack` | Navigation return (page variant) |
| `onCancel` | Form abandonment without save |
| `onEdit` | Detail → edit mode transition |
| `onDeleted` | After successful deletion |

---

## 2. Post-Scaffold Customization Checklist

After running `npx simplix scaffold <entity> --module <domain>`, the generated code is functional but generic. Customize in this order:

### Step 1: List Widget (`list.tsx`)

- [ ] Remove unnecessary columns (comment out, don't delete — easier to restore)
- [ ] Add enum badge rendering for enum columns (replace `display="badge"`)
- [ ] Add card view content (`cardTitle`, `cardContent` props)
- [ ] Tune filter types (`faceted` for enums, `number` for numeric, `dateRange` for dates)
- [ ] Set appropriate `defaultSort` and `defaultPageSize`

### Step 2: Form Widget (`form.tsx`)

- [ ] Remove read-only fields from form (id, createdAt, updatedAt)
- [ ] Set correct field order (most important first)
- [ ] Add field validation hints (placeholder, min/max, required indicator)
- [ ] Wire enum fields to `SelectField` with proper options
- [ ] Handle optional vs required fields

### Step 3: Detail Widget (`detail.tsx`)

- [ ] Set field display order
- [ ] Use appropriate detail field types (`DetailBadgeField` for enums, `DetailBooleanField` for booleans)
- [ ] Add `layout="inline"` for compact display
- [ ] Wire delete action with i18n confirmation messages

### Step 4: CrudPage (`crud-page.tsx`)

- [ ] Set `variant` if different from default `"panel"`
- [ ] Add row actions (`edit`, `delete`, `view`, custom)
- [ ] Configure `detailWidth` or `listWidth` for ListDetail layout
- [ ] Wire `usePageHeader` with correct title/description/actions per view

### Step 5: Locales (`locales/widgets/*.json`)

- [ ] Translate all entity-specific keys (title, description, field labels)
- [ ] Add custom keys for any added UI text
- [ ] Ensure every locale file has the same keys

### Step 6: Verify

`<prefix>` is the package prefix derived from the root `package.json` name (see `../framework/configuration.md`).

```bash
pnpm --filter @<prefix>/<module> typecheck
pnpm --filter @<prefix>/<module> build
```

---

## 3. Widget Architecture Patterns

### 3a. Standard CRUD (List + Form + Detail)

Generated by scaffold. Uses `CrudList` → `CrudForm`/`CrudDetail` in a `ListDetail` layout.

```
CrudPage
├── ListDetail
│   ├── List (CrudList)
│   └── Detail/Form panel
└── usePageHeader (title + actions)
```

### 3b. Custom Editor (Loading Guard + Inner Content)

For complex editing UIs (bit-map editors, LED preset editors, etc.). Use `editor.hbs` template or follow this pattern:

```
EntityEditor (outer)           — fetch + loading guard + key-reset
└── EditorContent (inner)      — all state + UI (remounts on data change)
    ├── PanelHeader            — panel variant header
    ├── Content area           — domain-specific UI (scroll body: `<Stack flex overflow="auto">`, never a raw `overflow-y-auto` div)
    ├── EditorFooter           — save/cancel actions
    └── useUnsavedChanges      — browser leave + in-app confirmation
```

Key pattern: `key={data.id}-${data.updatedAt}` on inner component forces remount when server data changes.

**EditorFooter standard layout** — mirrors `CrudDetail.DefaultActions`:

```
┌─────────────────────────────────────┐
│ [Cancel/Back]     [✖ Delete] [Save] │
│  ← left (outline)   right (Flex) →  │
└─────────────────────────────────────┘
```

- `EditorFooter` uses `justify-between` — left side for cancel/back, right side for action group
- Right-side actions wrapped in `<Flex gap="sm">`: delete icon button (`variant="outline"`, `size="icon-sm"`) + the framework `SaveButton` (self-contains dirty/saving/validation state via `isDirty` / `isSaving` / `fieldErrors`) — do not hand-roll a `<Button variant="primary" disabled={...}>` for save
- Delete button only shown when `isEdit` is true
- This matches `CrudDetail.DefaultActions` pattern exactly

### 3c. Map Page

For geo-spatial entities with coordinates.

```
MapPage
├── useMapPageData({ data, isLoading, hasValidCoords })
├── MapProvider
│   └── Map + MapMarker[]
└── Sidebar list (optional)
```

### 3d. Tree CRUD

For hierarchical entities (departments, categories).

```
TreeCrudPage
├── CrudTree + useTreeExpansion
├── TreeMoveDialog / TreeReorderDialog
└── Form/Detail panel
```

---

## 4. Component Usage Quick Reference

### Layout

```tsx
<Stack gap="md">                         {/* Vertical stack */}
<Stack fill>                             {/* Full height (h-full) */}
<Stack flex>                             {/* Flex child (flex-1 min-h-0) */}
<Stack padded>                           {/* Content padding (pt-4 pb-8) */}
<Stack padded className="px-5">          {/* Content padding + horizontal */}
<Flex gap="sm" align="center">           {/* Horizontal flex */}
<Flex wrap>                              {/* Wrapping flex */}
<Flex fill>                              {/* Full height flex */}
<Card padding="md">                      {/* Content card */}
<Container size="full">                  {/* Constrained width */}
<CrudForm.Actions spread>               {/* justify-between footer */}
<TabsContent padded>                     {/* Tab content with padding */}
```

Gap values: `none`, `xs`, `sm`, `md`, `lg`, `xl`

**Layout props** (Stack/Flex):

| Prop | CSS | When to use |
| --- | --- | --- |
| `fill` | `h-full` | Root container that fills parent height |
| `flex` | `flex-1 min-h-0` | Flex child that grows and allows overflow |
| `padded` | `pt-4 pb-8` | Content area above a footer (editor/form body) |
| `overflow` | `overflow-auto` / `-hidden` / `-visible` / `-scroll` | Scrollable region — e.g. `overflow="auto"` on a `flex` body so a raw `overflow-y-auto` div is never needed |
| `wrap` | `flex-wrap` | Allow items to wrap to next line |

### List Columns

```tsx
// Simple column
<CrudList.Column<Entity> field="name" header={fieldLabel("name")} sortable />

// Boolean column
<CrudList.Column<Entity> field="isEnabled" header={fieldLabel("isEnabled")} display="boolean" sortable />

// Custom render (enum with badge)
<CrudList.Column<Entity> field="status" header={fieldLabel("status")} sortable>
  {({ value }) => {
    const v = resolveBootEnum(value);
    return <Badge variant={STATUS_COLORS[v]}>{enumLabel("entityStatus", v)}</Badge>;
  }}
</CrudList.Column>
```

### Form Fields

```tsx
// After F12: single object state pattern
const [values, setValues] = useState<FormValues>({ name: "", count: 0 });
const updateField = useCallback(<K extends keyof FormValues>(field: K, value: FormValues[K]) => {
  setValues(prev => ({ ...prev, [field]: value }));
}, []);

<FormFields.TextField label={fieldLabel("name")} value={values.name} onChange={(v) => updateField("name", v)} />
<FormFields.NumberField label={fieldLabel("count")} value={values.count} onChange={(v) => updateField("count", v ?? 0)} />
<FormFields.SelectField label={fieldLabel("type")} value={values.type} onChange={(v) => updateField("type", v)} options={[...]} />
<FormFields.SwitchField label={fieldLabel("enabled")} value={values.enabled} onChange={(v) => updateField("enabled", v)} />
```

### Detail Fields

```tsx
<CrudDetail.Section title={t("entity.details")}>
  <DetailField label={fieldLabel("name")} value={data.name} layout="inline" />
  <DetailBadgeField label={fieldLabel("status")} value={enumLabel("entityStatus", v)} variant={STATUS_COLORS[v]} layout="inline" />
  <DetailBooleanField label={fieldLabel("isActive")} value={data.isActive} layout="inline" />
  <DetailDateField label={fieldLabel("createdAt")} value={data.createdAt} layout="inline" />
</CrudDetail.Section>
```

### Mutations & Invalidation

```tsx
const _create = useCreateEntity();
const _update = useUpdateEntity();
const invalidate = useInvalidateEntity("/api/v1/entity");

const { handleSubmit } = useCrudFormSubmit<FormValues>({
  entityId,
  create: adaptOrvalCreate(_create, { onSettled: invalidate }),
  update: adaptOrvalUpdate(_update, "entityId", { onSettled: invalidate }),
  onSuccess,
});
```

### Editor Save Pattern (without useCrudFormSubmit)

```tsx
const updateMutation = useUpdateEntity();
const invalidate = useInvalidateEntity("/api/v1/entity");

const handleSave = useCallback(() => {
  const dto = { id: data.id, ...buildPayload() };
  updateMutation.mutate(
    { id: data.id, data: dto },
    { onSuccess: () => { invalidate(); onSuccess?.(); }, onError: invalidate },
  );
}, [data, updateMutation, invalidate, onSuccess]);
```

### Unsaved Changes Guard

```tsx
const isDirty = /* your dirty check */;
const { guardedNavigate, dialog: unsavedDialog } = useUnsavedChanges({ isDirty });

// Wrap navigation callbacks
const handleClose = useCallback(() => {
  guardedNavigate(() => onClose?.());
}, [guardedNavigate, onClose]);

// Render dialog
return (
  <Stack>
    {/* ... content ... */}
    {unsavedDialog}
  </Stack>
);
```

### Page Header

```tsx
// Standard — in CrudPage
usePageHeader((() => {
  if (variant === "page") {
    if (view === "new") return { title: t("entity.newEntity") };
    if (view === "edit") return { title: t("entity.editEntity") };
    if (view === "detail") return { title: t("entity.entityDetail") };
    return { title: t("entity.entities"), actions: <Button onClick={handleAdd}>Add</Button> };
  }
  return { title: t("entity.entities"), description: t("entity.description"), actions };
})());

// Simple — read-only page
usePageHeader({ title: t("entity.title"), description: t("entity.description") });
```

### Panel Header (for panel/dialog variant editors)

```tsx
{variant === "panel" && (
  <PanelHeader
    title={data.name ?? t("entity.editor")}
    description={t("entity.editDescription")}
    onClose={handleClose}
  />
)}
```

### Numbered Resource Selection with Duplicate Prevention

When selecting a numbered resource (a slot number or other sequential identifier) that must be unique within a scope:

**1. Shared helper in `shared/lib/`**

```tsx
// Build options: all numbers shown, used ones disabled
export function buildSlotNumberOptions(
  existingItems: ProductListDTO[],
  maxSlots: number,
  excludeId?: string,   // Editor passes current entity ID to keep its own value selectable
) {
  const used = new Set(
    existingItems
      .filter((item) => !excludeId || item.id !== excludeId)
      .map((item) => item.slotNumber)
      .filter((n): n is number => n != null),
  );
  return Array.from({ length: maxSlots }, (_, i) => i).map((n) => ({
    label: String(n),
    value: String(n),
    disabled: used.has(n),
  }));
}

// Find first available number (for Creator default)
export function findNextSlotNumber(existingItems: ProductListDTO[], maxSlots: number): number {
  const used = new Set(existingItems.map((item) => item.slotNumber).filter((n): n is number => n != null));
  for (let i = 0; i < maxSlots; i++) {
    if (!used.has(i)) return i;
  }
  return 0;
}
```

**2. State is always `number`**

```tsx
interface FormValues {
  slotNumber: number;   // NOT string — keep as number
}
```

**3. SelectField uses String/Number conversion**

```tsx
<FormFields.SelectField
  label={t("fields.slotNumber")}
  value={String(values.slotNumber)}                    // number → string
  onChange={(v) => updateField("slotNumber", Number(v))} // string → number
  options={slotOptions}
/>
```

**4. Creator: auto-sync when data loads**

```tsx
const nextSlot = useMemo(() => findNextSlotNumber(existingItems, maxSlots), [existingItems, maxSlots]);

useEffect(() => {
  if (nextSlot > 0 && values.slotNumber === 0) {
    setValues((prev) => ({ ...prev, slotNumber: nextSlot }));
  }
}, [nextSlot]);
```

**5. Editor: pass `excludeId` to keep current value selectable**

```tsx
const slotOptions = useMemo(
  () => buildSlotNumberOptions(existingItems, maxSlots, data.id),  // own ID excluded from "used"
  [existingItems, maxSlots, data.id],
);
```

**Key rules:**
- Used numbers are **disabled**, not hidden — user can see what's taken
- `excludeId` in Editor prevents current value from being disabled
- Max range comes from domain model (e.g., `parent.maxSlots`), never hardcoded
- The same pattern applies to any other numbered resource that must be unique within a scope
- All helpers live in `shared/lib/slot-options.ts`

### Filters

```tsx
<CrudList.FilterBar
  filters={[
    { type: "text", field: "name", label: fieldLabel("name"), operators: [SearchOperator.CONTAINS], defaultOperator: SearchOperator.CONTAINS },
    { type: "number", field: "count", label: fieldLabel("count"), operators: [SearchOperator.EQUALS] },
    { type: "faceted", field: "type", label: fieldLabel("type"), options: [{ label: "A", value: "A" }, { label: "B", value: "B" }] },
    { type: "toggle", field: "isEnabled", label: fieldLabel("isEnabled") },
    { type: "dateRange", field: "createdAt", label: fieldLabel("createdAt") },
  ]}
  state={list.filters}
/>
```

---

## 5. Anti-Patterns (DO NOT)

| Anti-Pattern | Correct Approach |
| --- | --- |
| `<div className="flex ...">` | Use `<Flex>` / `<Stack>` |
| `<div className="grid ...">` | Use `<Grid>` |
| `className="h-full"` on Stack/Flex | Use `fill` prop |
| `className="flex-1 min-h-0"` on Stack/Flex | Use `flex` prop |
| `className="pt-4 pb-8"` on Stack | Use `padded` prop |
| `className="flex-wrap"` on Flex | Use `wrap` prop |
| `className="...overflow-y-auto"` / `overflow-auto` scroll body | Use `overflow` prop, e.g. `<Stack flex overflow="auto">` |
| `CrudForm.Actions className={justify-*}` | Use `spread` prop |
| Hardcoded strings in JSX | Use `t("key")` from `useTranslation()` |
| `useState` per field (old pattern) | Single `useState<FormValues>({...})` + `updateField` |
| Custom delete confirmation dialog | Use `CrudDelete` or `ConfirmDialog` |
| Custom loading spinner | Use `<QueryFallback isLoading />` |
| Manual `window.addEventListener("beforeunload", ...)` | Use `useBeforeUnload` or `useUnsavedChanges` |
| `className="h-4 w-4"` | Use `className="size-4"` |
| `onSaved` / `onDone` callbacks | Use `onSuccess` |
| Inline panel header with close button | Use `<PanelHeader>` |
| Inline editor footer with actions | Use `<EditorFooter>` |
| Guessing button layout in footer/header | Read `CrudDetail.DefaultActions` source for the standard pattern first |
| Local `enumStr()` / `resolveEnum()` | Use `resolveBootEnum` from `@simplix-react-ext/simplix-boot-utils` |
| Raw `<section>` / `<div>` as card | Use `<Card padding="...">` |
| Passing for-edit enum fields directly to update DTO | Use `resolveBootEnum(form.field)` — enum objects cause server deserialization error |
| Empty `.filter(e => e.id)` in save handler | Consider initial empty state — new items have no server ID yet |
| **SelectField rendered before async options finish loading** | **Must check `isLoading` on BOTH the value source and options source queries (Rule 6)** |
| Relying only on useEffect-based state synchronization | Provide a fallback directly from the source data (Rule 6) |

---

## 6. Module Boundary Rules (FSD)

```
app → pages → widgets → features → entities → shared
```

- **widgets/**: Reusable UI compositions (list, form, detail, editor). Import from domain package + `@simplix-react/ui`.
- **pages/**: Page-level orchestration (CrudPage, MapPage). Import from widgets + domain package.
- **shared/config/**: Module-level constants and configuration.
- **shared/lib/**: Module-level utilities.
- Cross-slice import within the same layer is FORBIDDEN.
- App-specific UI components MUST go into the framework, NOT the module.

---
