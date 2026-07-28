> Commonization registry — **Empty / loading / fallback states**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry — Empty / loading / fallback states

## EmptyState

| Field | Value |
|-------|-------|
| **Component** | `EmptyState` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/shared/empty-state.tsx` |
| **Export** | `import { EmptyState } from "@simplix-react/ui"` |

### Props

```typescript
interface EmptyStateProps {
  icon?: ReactNode;     // Icon displayed in circular muted background
  title: string;        // Bold heading text (required)
  description?: string; // Muted subtext below title
  action?: ReactNode;   // Action button/element below description
  className?: string;   // Override container styles
}
```

### Standard Usage

```tsx
<EmptyState
  icon={<SomeIcon />}
  title={t("entity.emptyTitle")}
  description={t("entity.emptyDescription")}
/>
```

**Page-level empty boxes are uniform**: every empty/error box that replaces a page's main content area (list table area, tabbed panel body, prompt-to-select screens) is a FULL-WIDTH bordered box with the standard `min-h-[280px]` and an icon, so all such boxes share one height and rhythm. `CrudList` applies this internally to its empty/error/no-filter states; custom panels pass `className="min-h-[280px]"` and an `icon`. Compact contexts (side panels, form sub-sections, popovers) keep the content-driven default — do NOT add the min-height there.

```tsx
// Page-level custom panel (tab body, prompt screen)
<EmptyState className="min-h-[280px]" icon={<InboxIcon className="size-6" />} title={t("requests.empty")} />
```

### Internal Framework Usage

`CrudList.Table` uses `EmptyState` internally when `emptyReason === "no-data"` and `emptyState` prop is provided. No changes needed for existing table empty states.


### Anti-Pattern (What NOT to Do)

```tsx
// FORBIDDEN - Custom inline empty state
<Flex direction="column" align="center" gap="sm" className="py-16">
  <div className="rounded-full bg-muted p-4 text-muted-foreground">
    <SomeIcon className="size-8" />
  </div>
  <p className="text-base font-semibold">{title}</p>
  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
</Flex>

// REQUIRED - Use shared component
<EmptyState icon={<SomeIcon />} title={title} description={description} />
```

## DetailFields Fallback Standardization

| Field | Value |
|-------|-------|
| **Pattern** | DetailFields empty value fallback |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/fields/detail/*.tsx`, `simplix-react/packages/ui/src/fields/shared/detail-fallback.tsx` |

### Rule

All `DetailFields.*` components MUST render the shared `EmptyValueBadge` (muted dashed-outline "No value" pill, framework-translated via the `field.noValue` key) when value is null, undefined, or empty string `""`. This makes "the server sent no value" unmistakable — a silently blank row is indistinguishable from a rendering error. An explicitly passed `fallback` string overrides the badge only where a domain-specific empty label reads better (e.g. an "Unlimited" capacity).

### Fallback Behavior by Component

| Component | value type | empty default | empty detection |
|-----------|-----------|:---:|:---:|
| DetailTextField | `string \| null \| undefined` | `EmptyValueBadge` | `hasValue` check |
| DetailNumberField | `number \| null` | `EmptyValueBadge` | N/A (number type) |
| DetailDateField | `DateLike \| null` | `EmptyValueBadge` | parseDate handles |
| DetailCountryField | `string \| null \| undefined` | `EmptyValueBadge` (unknown code shows raw value) | falsy check |
| DetailTimezoneField | `string \| null \| undefined` | `EmptyValueBadge` (unknown ID shows raw value) | falsy check |
| DetailLocationField | `number` coords | `EmptyValueBadge` | invalid/0,0 coords |
| DetailBadgeField | `T \| null \| undefined` | `EmptyValueBadge` | `hasValue` check |
| DetailBooleanField | `boolean \| null \| undefined` | `EmptyValueBadge` | N/A (boolean type) |
| DetailListField | `string[] \| null \| undefined` | `EmptyValueBadge` | empty array check |
| DetailLinkField | `string \| null \| undefined` | `EmptyValueBadge` | `hasValue` check |
| DetailStatusField | `ReactNode` | `EmptyValueBadge` | `hasValue` check |
| DetailTextareaField / DetailI18nTextareaField | `string`/i18n map | `EmptyValueBadge` | `hasValue` / resolved check |
| DetailNoteField | `string \| null \| undefined` | Returns null (by design) | `value ?? fallback` |
| DetailImageField | `string \| null \| undefined` | Placeholder SVG | Visual placeholder |
| DetailField | `children` | None (generic wrapper) | Caller responsibility |
| I18nText (list-cell helper) | i18n map | Empty string (cell context — see `EmptyValue`) | resolved check |
| InstantText (inline instant — cell/card/caption) | `DateLike \| null` | `fallback` prop (default: nothing) | parseDate handles |
| CalendarDateText (inline `LocalDate`) | `DateLike \| null` | `fallback` prop | parseDate handles |
| WallClockText (inline `LocalTime`) | `string \| null` | `fallback` prop | value check |

Date/time display goes through a framework component, never an inline `formatDateTime` / `formatDateMedium` call: `DetailDateField` (detail row) / `CrudList.Column format=` (column) for the declarative cases, and `InstantText` / `CalendarDateText` / `WallClockText` for raw-text cells, cards, and captions. `InstantText format="date"` is the only one that renders an `Instant` as its zone-local date (`format="date"` on the field/column is zone-neutral). Full matrix → `customize/datetime-fields.md`.

### Anti-Pattern

```tsx
// FORBIDDEN — Custom inline fallback handling in modules
{value ? <DetailFields.DetailTextField value={value} /> : <span>—</span>}

// FORBIDDEN — Blanking the value at the call site; pass the raw nullable instead
<DetailFields.DetailTextField value={String(value ?? "")} />

// REQUIRED — Let the component handle the empty state internally
<DetailFields.DetailTextField value={value} />
```

## Loading Indicator Standardization (Button `loading` prop)

| Field | Value |
|-------|-------|
| **Pattern** | Unified loading indicator for action buttons during async operations |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/base/controls/button.tsx` |

### Components Enhanced

| Component | Prop Added | Behavior |
|-----------|-----------|----------|
| `Button` | `loading`, `loadingText` | Spinner + text swap + auto-disable + `aria-busy` |
| `CrudForm` | `isSubmitting` | `data-submitting` attribute propagation |
| `CrudDetail.DefaultActions` | `isPending` | Auto-disables Edit/Delete buttons |

### Button Props

```typescript
interface ButtonProps {
  loading?: boolean;       // Show spinner + disable button
  loadingText?: ReactNode; // Text to show while loading (replaces children)
}
```

### Standard Usage

```tsx
// Form submit button (Phase 1 pattern)
const { handleSubmit, isPending } = useCrudFormSubmit({ ... });
<CrudForm onSubmit={handleSubmit} isSubmitting={isPending}>
  <CrudForm.Actions>
    <Button variant="outline" disabled={isPending}>{t("common.cancel")}</Button>
    <Button type="submit" variant="primary" loading={isPending} loadingText={t("common.saving")}>
      {t("entity.save")}
    </Button>
  </CrudForm.Actions>
</CrudForm>

// Editor save button (Phase 2 pattern)
<Button onClick={handleSave} disabled={!isDirty}
  loading={updateMutation.isPending} loadingText={t("entity.saving")}>
  {t("entity.saveChanges")}
</Button>

// Detail default actions (Phase 3 pattern)
<CrudDetail.DefaultActions onEdit={onEdit} onDelete={del.requestDelete}
  isPending={deleteMutation.isPending} />
```

### i18n Keys

| Key | en | ko | ja |
|-----|----|----|-----|
| `common.saving` | Saving... | 저장 중... | 保存中... |
| `common.deleting` | Deleting... | 삭제 중... | 削除中... |

### Anti-Pattern

```tsx
// FORBIDDEN -- Manual disabled + ternary text
<Button disabled={isPending}>
  {isPending ? t("saving") : t("save")}
</Button>

// FORBIDDEN -- Manual spinner icon
<Button disabled={isPending}>
  {isPending && <Loader2Icon className="size-4 animate-spin" />}
  {isPending ? t("saving") : t("save")}
</Button>

// REQUIRED -- Button loading prop
<Button loading={isPending} loadingText={t("common.saving")}>
  {t("save")}
</Button>
```

### HBS Templates

All 3 scaffold templates (`form.hbs`, `detail.hbs`, `editor.hbs`) enforce this pattern:
- `form.hbs`: `isPending` extracted from `useCrudFormSubmit`, Button `loading` + `loadingText`
- `detail.hbs`: `isPending` on `CrudDetail.DefaultActions`
- `editor.hbs`: Button `loading` + `loadingText` on save button

## EmptyValue (em-dash placeholder for non-field cells)

| Field | Value |
|-------|-------|
| **Component** | `EmptyValue` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/base/display/empty-value.tsx` |

### Rule

Muted em-dash placeholder (`children` default `—`) for "no value" in COMPACT contexts where neither a `DetailFields.*` component (which renders the shared `EmptyValueBadge` internally) nor a standalone `EmptyValueBadge` applies — table cells, editor summaries, dense inline displays where a pill would be visual noise. Replaces raw `<span>—</span>` and inline `?? "—"` literals so empty rendering stays centralized. For `DetailFields.*` values, still pass the raw nullable value (do NOT wrap with `EmptyValue` — the field handles it internally). For i18n label fallbacks that must be a `string` (e.g. a filter-option `label`), keep a string fallback — `EmptyValue` is a node.

## EmptyValueBadge (no-value pill for detail-style displays)

| Field | Value |
|-------|-------|
| **Component** | `EmptyValueBadge` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/base/display/empty-value-badge.tsx` |
| **Export** | `import { EmptyValueBadge } from "@simplix-react/ui"` |

### Props

```typescript
interface EmptyValueBadgeProps {
  label?: string;     // Override; defaults to the framework-translated field.noValue ("No value" / "값 없음" / "値なし")
  className?: string;
}
```

### Rule

Muted dashed-outline badge that explicitly marks a missing value, so a blank field reads as "no value" rather than a rendering error. Every `DetailFields.*` component renders it as the default empty fallback (see [[DetailFields Fallback Standardization]]) — do NOT wrap `DetailFields.*` values with it. Use it directly ONLY in custom detail-style displays that bypass `DetailFields.*` (hand-built `DetailFieldWrapper` bodies, summary panels). Table cells and dense inline contexts keep `EmptyValue` (em-dash).

```tsx
// Custom detail-style display without a matching DetailFields component
<DetailFieldWrapper label={fieldLabel("provider")} layout="inline">
  {provider ? <ProviderSummary provider={provider} /> : <EmptyValueBadge />}
</DetailFieldWrapper>
```

### Anti-Pattern

```tsx
// FORBIDDEN — wrapping a DetailFields value (the field renders the badge internally)
{value ? <DetailFields.DetailTextField value={value} /> : <EmptyValueBadge />}

// FORBIDDEN — hand-rolled no-value pill
<Badge variant="outline" className="border-dashed text-muted-foreground">값 없음</Badge>
```
