# Framework Component Reference

Complete catalog of `@simplix-react/ui` components, hooks, and utilities available for widget customization.

> **Scope.** This catalog covers only the framework-generic primitives in `@simplix-react/ui`. Project-/domain-specific shared UI (composites tied to your entities, branded cards, domain badges) does NOT live here — it belongs in the project's own shared UI package (e.g. `@<prefix>/<name>-ui`). Don't add domain widgets to `@simplix-react/ui`; import them from the project package and only commonize truly generic pieces upstream.

## Layout Primitives

| Component | Purpose | Key Props |
| --- | --- | --- |
| `Flex` | Horizontal layout (row) | `gap`, `align`, `justify`, `wrap`, `fill`, `flex`, `overflow`, `className` |
| `Stack` | Vertical/horizontal layout | `direction`, `gap`, `align`, `justify`, `wrap`, `fill`, `flex`, `padded`, `overflow` |
| `Grid` | CSS Grid layout | `columns` (1-6), `gap` + per-axis `gapX`/`gapY`, `divider` (vertical line mid-gutter between columns; fixed grids any column count, responsive grids two-column only), `template` |
| `Container` | Constrained max-width wrapper | `size`, `className` |
| `Section` | Semantic content section | Padding/spacing |
| `Card` | Content card container | `padding` (none/sm/md/lg), `className` |

**Gap values**: `none`, `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), `xl` (24px)

**Align values**: `start`, `center`, `end`, `stretch`, `baseline`

**Justify values**: `start`, `center`, `end`, `between`, `around`

**`overflow` prop** (Stack/Flex): `auto` | `hidden` | `visible` | `scroll` — e.g. `<Stack flex overflow="auto">` for a scrollable region, so a raw `<div className="...overflow-y-auto">` is never needed.

**Boolean layout props** (Stack/Flex):

| Prop | CSS | Use case |
| --- | --- | --- |
| `fill` | `h-full` | Root container filling parent height |
| `flex` | `flex-1 min-h-0` | Flex child growing to fill available space |
| `padded` | `pt-4 pb-8` | Content area spacing above footer |
| `wrap` | `flex-wrap` | Allow items to wrap to next line |

---

## Base UI Components

### Buttons & Badges

| Component | Props | Notes |
| --- | --- | --- |
| `Button` | `variant` (default/primary/outline/ghost/destructive/link), `size` (sm/md/lg) | Standard action button |
| `SaveButton` | `isDirty?`, `isSaving?`, `validationCount?`, `fieldErrors?`, `savingText?` (extends `ButtonProps`) | Self-contained CRUD save button: disables when not dirty, shows spinner while saving, shows a validation/error-count badge. Pair with `useIsDirty` / `useCrudFormSubmit` |
| `Badge` | `variant` (default/secondary/outline/destructive + custom) | Status/tag indicator |
| `BooleanBadge` | `value: boolean` | True/false badge display |

### Inputs

| Component | Props | Notes |
| --- | --- | --- |
| `Input` | Standard HTML input props | Base text input |
| `NumberInput` | `value`, `onChange`, `min`, `max`, `step` | Numeric input with arrow keys |
| `Textarea` | Standard textarea props | Multi-line text |
| `PasswordField` | `value`, `onChange` | Password with visibility toggle |

### Toggles & Selection

| Component | Props | Notes |
| --- | --- | --- |
| `Switch` | `checked`, `onCheckedChange`, `size` (sm/md) | Toggle switch |
| `Checkbox` | `checked`, `onCheckedChange`, `disabled` | Checkbox |
| `Select` | `value`, `onValueChange` | With SelectTrigger, SelectContent, SelectItem |
| `RadioGroup` | `value`, `onValueChange` | With RadioGroupItem |

### Composition

| Component | Props | Notes |
| --- | --- | --- |
| `SettingSwitch` | `label`, `description`, `checked`, `onCheckedChange` | Label + description + switch |
| `PanelHeader` | `title`, `description?`, `onClose?`, `thumbnail?`, `trailing?`, `children?`, `borderVariant?` | Panel/sheet header; `trailing` slot renders a control (Badge, Button, ...) after `children` and before the close button |
| `ConfirmDialog` | `open`, `title`, `description`, `variant`, `onConfirm`, `isPending` | Generic confirmation |

### Dialog & Sheet

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>
      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Form Field Components

### Editable Fields (FormFields.*)

| Field | Value Type | Props |
| --- | --- | --- |
| `TextField` | `string` | `label`, `value`, `onChange`, `type?` (email/url) |
| `NumberField` | `number` | `label`, `value`, `onChange`, `min?`, `max?` |
| `TextareaField` | `string` | `label`, `value`, `onChange` |
| `SwitchField` | `boolean` | `label`, `value`, `onChange` — defaults to `layout="trailing"`: switch right-aligned with a dashed leader line from the label, description below at the label's left edge. Keep the default so toggle columns line up; pass `layout="inline"` only inside dense grids (e.g. a permission matrix dialog) |
| `CheckboxField` | `boolean` | `label`, `value`, `onChange` |
| `SelectField` | `string` | `label`, `value`, `onChange`, `options: {label, value}[]` |
| `MultiSelectField` | `string[]` | `label`, `value`, `onChange`, `options` |
| `ComboboxField` | `string` | `label`, `value`, `onChange`, `options` (searchable) |
| `RadioGroupField` | `string` | `label`, `value`, `onChange`, `options` |
| `DateField` | `Date \| null` | `label`, `value`, `onChange` |
| `DateTimeField` | `Date \| null` | `label`, `value`, `onChange`, `hideTime?`, `hour12?`, `minuteStep?` (calendar + time UI in one popover) |
| `TimeField` | `TimeValue \| null` | `label`, `value`, `onChange`, `hour12?`, `minuteStep?`, `minTime?`, `maxTime?` |
| `SliderField` | `number` | `label`, `value`, `onChange`, `min`, `max` |
| `ColorField` | `string` | `label`, `value`, `onChange` |
| `CountryField` | `string` | `label`, `value`, `onChange` (country code) |
| `TimezoneField` | `string` | `label`, `value`, `onChange` |
| `LocationPickerField` | `{lat, lng}` | `label`, `value`, `onChange` |
| `TreeSelectField<T>` | `string \| null` | `label`, `value`, `onChange`, `treeData`, `config` |
| `PlateEditorField` | `string` (serialized Plate JSON) | `label`, `value`, `onChange`, `variant` (basic/standard/advanced), `defaultHeight?`, `minHeight?`, `maxHeight?`, `resizable?` — WYSIWYG rich-text editor (Plate.js). `basic` = bold/italic/underline/strike, H1–H3, blockquote, lists, link; `standard` adds image/code; `advanced` adds font styles/align/tables. Emits `""` when the document is emptied; a stored plain-text value loads as paragraphs (legacy fallback). Display stored values with `PlateViewer` and flatten them for list cells with `plateValueToText` — both from the `@simplix-react/ui/plate-editor` subpath |
| `PlateEditorI18nField` | `Record<lang, string>` | Multi-language rich-text variant (language tabs); helpers `convertPlateI18nToJson` / `parsePlateI18nFromJson` live on the same subpath |

### Input-row adornments (`prefixControl` / `suffixControl`)

Every `FormFields.*` field accepts `prefixControl` and `suffixControl` — a control rendered on the SAME row as the input (add button, IconPicker, ColorPicker, unit label). The field keeps the control vertically centered with the input while `description` and `error` render below at full width.

A control composed OUTSIDE the field is a defect: wrapping the field and a button in `Flex align="end"` bottom-aligns the button against the whole field INCLUDING its description/error, so the button drifts off the input row the moment a description exists (and jumps when a validation error appears).

```tsx
// ✔ button stays aligned with the input; description spans below both
<FormFields.TextField
  label={fieldLabel("requiredTrainingKeys")}
  value={draft}
  onChange={setDraft}
  description={t("visitType.requiredTrainingKeysHint")}
  error={fieldErrors?.["requiredTrainingKeys"]}
  suffixControl={
    <Button type="button" size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
      <PlusIcon className="size-4" />
      {tUi("common.add")}
    </Button>
  }
/>

// ✖ external composition — button bottom-aligns with the description, not the input
<Flex gap="sm" align="end">
  <FormFields.TextField ... description={...} />
  <Button ...>Add</Button>
</Flex>
```

### Read-Only Fields (Detail*)

| Field | Display | Props |
| --- | --- | --- |
| `DetailField` | Plain text | `label`, `value`, `layout?` (inline/stacked) |
| `DetailTextField` | Formatted text | `label`, `value` |
| `DetailNumberField` | Formatted number | `label`, `value` |
| `DetailBadgeField` | Badge with color | `label`, `value`, `variant` |
| `DetailBooleanField` | Boolean indicator | `label`, `value`, `mode?` (checkbox/text/badge) |
| `DetailDateField` | Formatted date/time field row | `label`, `value`, `format?` (`date`/`datetime`/`time`/`relative`), `displayZone?` (instants) |
| `DetailImageField` | Image display | `label`, `value` (URL) |
| `DetailLinkField` | Clickable link | `label`, `value`, `href` |
| `DetailListField` | Array display | `label`, `value`, `mode?` (list/table) |
| `DetailLocationField` | Map coordinates | `label`, `value` |
| `DetailCountryField` | Country name | `label`, `value` (code) |
| `DetailTimezoneField` | Timezone name | `label`, `value` |
| `DetailNoteField` | Rich text/HTML | `label`, `value` |
| `DetailFieldWrapper` | Label + slot wrapper | `label?`, `labelKey?`, `layout?` (top/left/inline/hidden), `children` |
| `PlateViewer` | Rich-text content (Plate) | `value` (serialized JSON \| plain text \| parsed `Value`), `variant?` (basic/standard/advanced), `className?` — from `@simplix-react/ui/plate-editor`; borderless read-only renderer for `PlateEditorField` content. Wrap in `DetailFieldWrapper layout="top"`; plain-text values render as paragraphs |

`DetailFieldWrapper` is the shared label/layout wrapper that all `DetailFields.*` build on — wrap a custom read-only value in it to match the standard label treatment instead of re-implementing the label row.

### Inline date/time text (cell · card · caption)

For a date/time value rendered as raw text — a list cell, a card row, a caption — where a full `DetailDateField` row does not fit, use these inline components (from `@simplix-react/ui`) instead of calling `formatDateTime` / `formatDateMedium` by hand. Never wrap a value in `new Date(...)` and format it inline; these components own the parsing and zone math.

| Component | Renders | Props |
| --- | --- | --- |
| `InstantText` | An absolute `Instant` in an explicit zone | `value`, `displayZone?`, `format?` (`datetime` default / `date` = zone-local calendar date), `fallback?` |
| `CalendarDateText` | A zone-neutral `LocalDate` | `value`, `fallback?` |
| `WallClockText` | A `LocalTime` (`HH:mm[:ss]`) | `value`, `fallback?` |

`InstantText format="date"` is the only way to print an `Instant` as its zone-local calendar date — `DetailDateField format="date"` and `CrudList.Column format="date"` are zone-neutral. Full kind → component matrix (detail row · inline text · list column) → `customize/datetime-fields.md`.

### Date / time field selection

This section covers form INPUT; for read-only DISPLAY use the field rows and inline text components above. Pick the field from what the backend stores, never from what is convenient to type into:

| Backend type | Field | Value in state |
| --- | --- | --- |
| Calendar date (`LocalDate`) | `FormFields.DateField` | `Date` |
| Timestamp (`Instant`, `OffsetDateTime`) | `FormFields.DateTimeField` | `Date` |
| Wall-clock time of day (`LocalTime`) | `FormFields.TimeField` | server string, converted at the field |

A time-of-day input is ALWAYS `FormFields.TimeField`. A `TextField` with `inputProps={{ type: "time" }}` (browser-native, renders differently per browser) or a free-text `placeholder="HH:mm"` (no validation) is a defect — replace both on sight.

`TimeField` reads and emits `TimeValue` (`{ hours, minutes }`), while a `LocalTime` DTO field travels as `"HH:mm"` / `"HH:mm:ss"`. Convert with the ONE shared helper pair in the project's shared UI package (its `date` module — the same place the date encoding helpers live). Never re-implement the conversion per module:

```tsx
<FormFields.TimeField
  label={fieldLabel("startTime")}
  value={parseLocalTime(values.startTime)}          // string | LocalTime object → TimeValue | null
  onChange={(v) => updateField("startTime", formatLocalTime(v))}  // TimeValue → "HH:mm"
  error={fieldErrors?.["startTime"]}
  required
/>
```

Read-only detail rows render the same value with the shared `displayLocalTime` helper, not a local slice/pad.

Rules that follow from how the picker behaves:

1. **12-hour is the default.** Leave `hour12` alone (the AM/PM toggle is the standard look). Only pass `hour12={false}` when a screen has a specific reason for a 24-hour clock, and then apply it to every time field on that screen.
2. **The picker always shows a clock value** — a `null` value renders as `12:00 AM`, it has no empty state. So an OPTIONAL time must be gated by something that expresses "unset": an existing mode select, or a `SwitchField` you add for the pair (`coreStartTime`/`coreEndTime`, an access window). When the gate is off, write `undefined` to the DTO; when it is on, seed a concrete default so what is displayed is what is submitted. Never leave a form that displays `12:00 AM` while submitting nothing.
3. **Width and height are owned by the framework** (a fixed, non-shrinking control that matches the standard input height). Do not stretch it with `flex-1` or squeeze it into a narrow grid cell — in a tight panel let the row wrap (`Flex … className="flex-wrap"`) instead.
4. **A LocalTime DTO field is a string on the wire.** The generated model may declare it as an object (`{ hour, minute }`) — that is the OpenAPI schema's naive view of `java.time.LocalTime`. Submit `"HH:mm"`; the shared parser accepts both shapes when reading.

---

## CRUD Compound Components

### CrudList

```tsx
<CrudList>
  <CrudList.FilterBar filters={[...]} state={list.filters} leading={<Badge>...</Badge>} />

  <CrudList.Table
    data={list.data}
    isLoading={list.isLoading}
    emptyReason={list.emptyReason}
    emptyState={{ icon: <Icon />, title: "...", description: "..." }}
    density="compact"                    // "compact" | "default" | "relaxed"
    onRowClick={handleRowClick}
    activeRowId={activeId}
    rowId={(row) => String(row.id)}
    sort={list.sort.field ? { field: list.sort.field, direction: list.sort.direction } : null}
    onSortChange={(s) => list.sort.setSort(s.field, s.direction)}
    selectedIndices={list.selection.selected}
    onSelectionChange={list.selection.toggle}
    onSelectAll={() => list.selection.toggleAll(list.data)}
    actions={rowActions}                 // RowActionDef[]
    actionVariant="dropdown"             // "inline" | "dropdown"
    cardBreakpoint={480}                 // responsive card view below this width
    cardTitle={({ row }) => <span>{row.name}</span>}
    cardContent={({ row }) => <span>{row.type}</span>}
  >
    <CrudList.Column<Entity> field="name" header="Name" sortable />
    <CrudList.Column<Entity> field="status" header="Status" sortable>
      {({ value }) => <Badge>{value}</Badge>}
    </CrudList.Column>
  </CrudList.Table>

  <CrudList.Pagination
    page={list.pagination.page}
    pageSize={list.pagination.pageSize}
    total={list.pagination.total}
    totalPages={list.pagination.totalPages}
    onPageChange={list.pagination.setPage}
    onPageSizeChange={list.pagination.setPageSize}
  />
</CrudList>
```

### CrudForm

```tsx
<CrudForm
  onSubmit={handleSubmit}
  header={<Heading level={4}>{title}</Heading>}
  onClose={onClose}
  footer={
    <CrudForm.Actions spread={!!(onBack || onCancel)}>
      {/* spread=true → justify-between (back on left, save on right) */}
      {/* spread=false → justify-end (all buttons on right) */}
      <Button type="button" variant="outline" onClick={onCancel}>{t("common.cancel")}</Button>
      <Button type="submit" variant="primary">{t("entity.save")}</Button>
    </CrudForm.Actions>
  }
>
  <CrudForm.Section title={t("entity.section")} variant="flat">
    <FormFields.TextField label="..." value={v} onChange={setV} />
  </CrudForm.Section>
</CrudForm>
```

### CrudDetail

```tsx
<CrudDetail
  isLoading={isLoading}
  header={onClose ? <Heading level={4} tone="muted">{data.name}</Heading> : undefined}
  onClose={onClose}
  displayZone={siteZone}                 // instants + audit footer render in this zone
  auditData={{ id: data.id, createdAt: data.createdAt, updatedAt: data.updatedAt }}
  footer={
    <CrudDetail.DefaultActions onClose={onClose} onDelete={requestDelete} onEdit={onEdit} isPending={isDeleting} />
  }
>
  <CrudDetail.Section title={t("entity.section")} variant="flat">
    <DetailField label={fieldLabel("name")} value={data.name} layout="inline" />
  </CrudDetail.Section>
</CrudDetail>
```

**Footer** — pass one of these as `footer`:

| Component | Shape | Use when |
| --- | --- | --- |
| `CrudDetail.DefaultActions` | Single row: Close/Back + Delete / children / Edit | No domain lifecycle actions |
| `CrudDetail.ActionFooter` | Two-tier: a wrapping row of domain lifecycle `actions` above the standard row, with a divider between the tiers | The entity has lifecycle actions (submit, review, cancel, resend, renew, …) |

Both share the same standard-row props. A domain or Edit/Delete action that does not apply to the record's current state stays **visible but disabled** with a `title` reason (`editDisabled` / `deleteDisabled` + `*DisabledReason`, or `disabled` + `title` on a domain action button), never hidden — the action bar is stable across states.

---

## Hooks Reference

### List Hooks

| Hook | Signature | Returns |
| --- | --- | --- |
| `useCrudList<T>` | `(adaptedHook, options)` | `{ data, isLoading, emptyReason, filters, sort, pagination, selection }` |
| `adaptOrvalList` | `(orvalListHook)` | Adapted hook for `useCrudList` |
| `useFilterBarState` | `({ defaultFilters? })` | Standalone `CrudListFilters` for a `FilterBar` on a non-CrudList surface (aggregation report, custom query). Read query params from `committedValues`; faceted single-select values may be one-element arrays |

Options for `useCrudList`:
```tsx
{
  stateMode: "server",            // "server" | "client"
  defaultPageSize: 10,
  defaultSort: { field: "id", direction: "desc" },
  filterMode: "deferred",         // "deferred" | "instant"
}
```

### Form Hooks

| Hook | Signature | Returns |
| --- | --- | --- |
| `useCrudFormSubmit<T>` | `({ entityId?, create, update, onSuccess })` | `{ isEdit, handleSubmit, isPending }` |
| `useCrudDeleteWired` | `({ deleteMutation, labels, onDeleted? })` | `{ requestDelete, deleteDialog }` — wires `useCrudDeleteList` state + `CrudDelete` rendering into one hook; call `requestDelete(target)` and render `deleteDialog` instead of hand-managing `open`/`onOpenChange` |
| `adaptOrvalCreate` | `(mutation, options?)` | Adapted create mutation |
| `adaptOrvalUpdate` | `(mutation, pathParam?, options?)` | Adapted update mutation |
| `adaptOrvalDelete` | `(mutation, pathParam)` | Adapted delete mutation |
| `useInvalidateEntity` | `(entityPath)` | `() => void` (invalidate query cache) |

### Navigation & State Hooks

| Hook | Signature | Returns |
| --- | --- | --- |
| `usePageHeader` | `({ title?, description?, metadata?, metadataKey?, center?, actions? } \| null)` | Sets the page header from any child component; pass `metadata` (use `metadataKey` to force refresh) and `actions` to populate the header slots |
| `useCrudNavigation` | `(search, onNavigate)` | `{ view, entityId, navigate, openNew, openEdit, ... }` |
| `useCrudPageState` | `(list, search, onNavigate)` | Combined list + navigation state |
| `useListDetailState` | `()` | `{ isDetailOpen, activeId, openDetail, closeDetail }` |

### Guard Hooks

| Hook | Signature | Returns |
| --- | --- | --- |
| `useUnsavedChanges` | `({ isDirty })` | `{ guardedNavigate, dialog }` |
| `useBeforeUnload` | `(enabled: boolean)` | (no return — registers beforeunload listener) |
| `useIsDirty` | `(current, initial)` | `boolean` |

### Translation Hooks

| Hook | Signature | Returns |
| --- | --- | --- |
| `useTranslation` | `(namespace)` | `{ t }` — translate by key |
| `useEntityTranslation` | `(entityName)` | `{ fieldLabel, enumLabel }` — entity-specific |

---

## Filter Types

| Type | Props | Use For |
| --- | --- | --- |
| `text` | `field`, `label`, `operators`, `defaultOperator` | Free-text search (name, description) |
| `number` | `field`, `label`, `operators`, `defaultOperator` | Numeric ranges (count, sortOrder) |
| `faceted` | `field`, `label`, `options: {label, value}[]` | Enum/category selection |
| `toggle` | `field`, `label` | Boolean on/off |
| `dateRange` | `field`, `label` | Date range (createdAt, updatedAt) |

---

## Row Actions

```tsx
const actions: RowActionDef<Entity>[] = [
  { type: "edit", onClick: (row) => nav.openEdit(row.id) },
  { type: "delete", onClick: (row) => handleDelete(row.id) },
  { type: "view", onClick: (row) => nav.openDetail(row.id) },
  { type: "custom", label: "Duplicate", icon: <CopyIcon />, onClick: (row) => handleDuplicate(row) },
];
```

---

## Map Components

```tsx
import { Map, MapMarker, MapProvider, useMapPageData } from "@simplix-react/ui";

// Filter valid coordinate items
const { validItems, isLoading } = useMapPageData({
  data: list.data,
  isLoading: list.isLoading,
  hasValidCoords: (item) => isValidCoord({ lat: item.latitude, lng: item.longitude }),
});

// Render map
<MapProvider defaultFallbackTileUrl="/tiles/{z}/{x}/{y}.pbf" defaultMarkerIcon={customIcon}>
  <Map center={[37.5, 127.0]} zoom={12}>
    {validItems.map(item => (
      <MapMarker key={item.id} coords={{ lat: item.latitude, lng: item.longitude }} label={item.name} />
    ))}
  </Map>
</MapProvider>
```

---

## Orval Adapter Patterns

### List Adapter

```tsx
const list = useCrudList<Entity>(
  adaptOrvalList(useListEntities),
  { stateMode: "server", defaultPageSize: 10 },
);
```

### Create Adapter

```tsx
const _create = useCreateEntity();
const invalidate = useInvalidateEntity("/api/v1/entities");

// adaptOrvalCreate transforms: mutate({ data: T }) → mutate(T)
const create = adaptOrvalCreate(_create, { onSettled: invalidate });
```

### Update Adapter

```tsx
const _update = useUpdateEntity();

// adaptOrvalUpdate transforms: mutate({ [pathParam]: id, data: T }) → mutate({ id, dto: T })
const update = adaptOrvalUpdate(_update, "entityId", { onSettled: invalidate });
```

### Delete Adapter

```tsx
const _delete = useDeleteEntity();

// adaptOrvalDelete transforms: mutate({ [pathParam]: id }) → mutate(id)
const del = adaptOrvalDelete(_delete, "entityId");
```
