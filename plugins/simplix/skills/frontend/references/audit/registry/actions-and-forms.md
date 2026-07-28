> Commonization registry — **Actions, saves, selects & validation**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry — Actions, saves, selects & validation

## Row Action Standardization

| Field | Value |
|-------|-------|
| **Pattern** | Unified row action types and consistent icon styling |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/list/crud-list.tsx`, `simplix-react/packages/ui/src/crud/tree/crud-tree.tsx` |

### Changes

1. **Delete button color normalized**: Removed `text-destructive` (icon variant) and `variant="destructive"` (outline/ghost variant) from delete action. All row action icons now use the same base color.
2. **`"unlink"` ActionType added**: New action type for removing associations (e.g., user-group membership, access-level assignment).
3. **`UnlinkIcon` added**: Inline SVG icon (Link2Off) in `icons.tsx`, no external dependency.

### ActionType

```typescript
type ActionType = "view" | "edit" | "delete" | "locate" | "unlink";
```

### Usage

```tsx
// Unlink action — uses framework icon automatically
const actions: RowActionDef<<Entity>DTO>[] = [
  { type: "unlink", onClick: (row) => handleUnlink(row) },
];

// Delete action — no longer red/destructive
const actions: RowActionDef<<Entity>DTO>[] = [
  { type: "delete", onClick: (row) => handleDelete(row) },
];
```

### Anti-Pattern

```tsx
// FORBIDDEN — Custom icon override for unlink (use type: "unlink" instead)
{ type: "edit", icon: <Link2OffIcon />, onClick: (row) => handleUnlink(row) }

// FORBIDDEN — Importing lucide-react icons when framework provides them
import { Link2OffIcon } from "lucide-react";
```

### i18n Keys

| Key | en | ko | ja |
|-----|----|----|-----|
| `common.unlink` | Unlink | 연결 해제 | リンク解除 |

## SearchPopover (Unified Searchable Assignment)

| Field | Value |
|-------|-------|
| **Component** | `SearchPopover` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/base/inputs/search-popover.tsx` |
| **Export** | `import { SearchPopover } from "@simplix-react/ui"` |

### Props

```typescript
interface SearchPopoverGroup<T> {
  label: string;  // Group header label
  items: T[];     // Items in this group
}

interface SearchPopoverProps<T> {
  triggerText: string;                // Button label text
  items?: T[];                        // Flat list (mutually exclusive with groups)
  groups?: SearchPopoverGroup<T>[];   // Grouped list (mutually exclusive with items)
  getLabel: (item: T) => string;      // Extract display label
  getKey: (item: T) => string;        // Extract unique key
  onSelect: (item: T) => void;        // Selection callback (receives full item object)
  disabled?: boolean;                 // Disable trigger button
  disabledReason?: string;            // Tooltip when disabled
  placeholder?: string;               // Search input placeholder (default: i18n field.searchOption)
  emptyMessage?: string;              // No results message (default: i18n field.noResults)
  align?: "start" | "center" | "end"; // Popover alignment (default: "end")
}
```

### Standard Usage

```tsx
// Flat list mode
<SearchPopover
  triggerText={t("product.assignCategory")}
  items={availableCategories}
  getLabel={(category) => category.name ?? ""}
  getKey={(category) => category.id ?? ""}
  onSelect={handleAssign}
  disabled={isMaxReached}
  disabledReason={isMaxReached ? t("product.maxCategoriesReached") : undefined}
  placeholder={t("product.searchCategory")}
  emptyMessage={t("product.noCategoriesSearch")}
/>

// Grouped list mode
<SearchPopover
  triggerText={t("product.assignItem")}
  groups={availableGrouped.map((g) => ({ label: g.groupName, items: g.items }))}
  getLabel={(item) => item.name ?? item.id ?? ""}
  getKey={(item) => item.id ?? ""}
  onSelect={(item) => onAddItem(item.id!)}
  emptyMessage={t("product.noAvailableItems")}
/>
```

### Design Decisions

- **Trigger button**: Unified `<Button size="sm" variant="outline"><PlusIcon />{triggerText}</Button>`. Only `triggerText` is customizable.
- **Search**: Built-in via Command (cmdk). Always present.
- **i18n defaults**: Placeholder and empty message default to framework-level i18n keys (`field.searchOption`, `field.noResults`).
- **Item return**: `onSelect` receives the full item object, not just the key. Consumer extracts what it needs.

### Patterns Replaced

Unified assignment picker. Use `SearchPopover` with `items` for a flat option list or `groups` for grouped options instead of hand-building a `Popover`+`Command` or `DropdownMenu` assignment widget.

### Anti-Pattern (What NOT to Do)

```tsx
// FORBIDDEN — Custom Popover + Command inline implementation
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button size="sm" variant="outline">
      <PlusIcon className="size-4" />
      Assign Level
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-60 p-0" align="end">
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup>
          {items.map((item) => (
            <CommandItem key={item.id} onSelect={() => handleSelect(item)}>
              {item.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>

// REQUIRED — Use SearchPopover
<SearchPopover
  triggerText="Assign Level"
  items={items}
  getLabel={(i) => i.name}
  getKey={(i) => i.id}
  onSelect={handleSelect}
/>

// FORBIDDEN — DropdownMenu for searchable grouped lists
<DropdownMenu>
  <DropdownMenuTrigger asChild><Button>Assign Door</Button></DropdownMenuTrigger>
  <DropdownMenuContent>
    {groups.map((g) => (
      <DropdownMenuGroup key={g.label}>
        <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
        {g.items.map((item) => (
          <DropdownMenuItem onClick={() => handleSelect(item)}>{item.name}</DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    ))}
  </DropdownMenuContent>
</DropdownMenu>

// REQUIRED — Use SearchPopover groups mode
<SearchPopover
  triggerText="Assign Door"
  groups={groups.map((g) => ({ label: g.label, items: g.items }))}
  getLabel={(i) => i.name}
  getKey={(i) => i.id}
  onSelect={handleSelect}
/>
```

## SelectField Compact Mode

| Field | Value |
|-------|-------|
| **Component** | `SelectField` with `compact` prop |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/fields/form/select-field.tsx` |
| **Export** | `import { FormFields } from "@simplix-react/ui"` (via `FormFields.SelectField`) |

### Props (compact-specific)

```typescript
interface SelectFieldProps<T extends string = string> extends CommonFieldProps {
  // ... standard props ...
  compact?: boolean; // When true: no FieldWrapper, auto-width, h-8 trigger
}
```

### Standard Usage

```tsx
<FormFields.SelectField
  compact
  value={row.categoryId}
  options={categoryOptions}
  placeholder={t("product.selectCategory")}
  onChange={(v) => onCategoryChange(row.id, "categoryId", v)}
/>
```

### Design Decisions

- **No FieldWrapper**: `compact` mode skips label, error, description rendering entirely
- **Auto-width**: Uses `w-auto` instead of fixed width — trigger width matches content
- **Height**: Fixed `h-8` for table cell alignment
- **Accessibility**: `aria-label` set from `label ?? placeholder` when compact
- **Options format**: Same `{ label, value }` array as standard mode

### Pattern Replaced

For a table-cell select, use `FormFields.SelectField` with the `compact` prop instead of a raw `<Select>` wrapper.

### Anti-Pattern

```tsx
// FORBIDDEN — Raw Select wrapper for compact usage
<Select value={value} onValueChange={onChange}>
  <SelectTrigger className="h-8 w-40 text-sm">
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    {options.map((o) => (
      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
    ))}
  </SelectContent>
</Select>

// REQUIRED — Use SelectField compact
<FormFields.SelectField
  compact
  value={value}
  onChange={onChange}
  options={options.map((o) => ({ label: o.name, value: o.id }))}
  placeholder="Select..."
/>

// FORBIDDEN — Fixed width on compact select
<FormFields.SelectField compact className="w-40" ... />

// REQUIRED — Let auto-width handle it (w-auto is built-in)
<FormFields.SelectField compact ... />
```

## Awaitable Cache Invalidation (useInvalidateEntity)

| Field | Value |
|-------|-------|
| **Pattern** | Await `useInvalidateEntity` before resetting local state in inline editors |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/form/use-invalidate-entity.ts` |

### Behavior

`useInvalidateEntity` returns `() => Promise<void>` and calls `queryClient.invalidateQueries(...)` directly (no deferral); the returned promise resolves once the refetch settles.

### Rationale

In inline editors (no navigation after save), calling `reset()` before the invalidation's refetch completes shows a brief flash of stale cached data — so the reset must wait for invalidation (see Usage Rule).

### Usage Rule

In inline editors that reset local state after save, ALWAYS `await invalidate()` before resetting:

```tsx
// REQUIRED — Await invalidation in inline editors
await saveAll.mutateAsync({ data: { items } });
await invalidate();
reset();

// REQUIRED — Await in .then() callbacks
mutation.mutateAsync({ data: dto })
  .then(async () => {
    await invalidate();
    onSuccess?.();
  })
  .catch(async (error: unknown) => {
    await invalidate();
    // handle error
  });
```

### Unaffected Patterns (No Change Needed)

Fire-and-forget patterns (CrudForm, scaffolded code) are unaffected by the type change:

```tsx
// OK — Fire-and-forget in onSettled (CrudForm, scaffolded)
adaptOrvalCreate(_create, { onSettled: invalidate })
adaptOrvalUpdate(_update, "id", { onSettled: invalidate })
adaptOrvalDelete(_delete, "id", { onSettled: invalidate })

// OK — Fire-and-forget in .mutate() callback
updateMutation.mutate(dto, {
  onSuccess: () => { invalidate(); onSuccess?.(); },
  onError: () => invalidate(),
});
```

### Anti-Pattern

```tsx
// FORBIDDEN — Fire-and-forget invalidate before state reset in inline editor
await saveAll.mutateAsync({ data: { items } });
invalidate();  // NOT awaited — stale data flash
reset();

// REQUIRED — Await invalidation
await saveAll.mutateAsync({ data: { items } });
await invalidate();  // Wait for refetch to complete
reset();             // Now safe — UI shows fresh server data
```

### HBS Templates

No template changes needed. All 6 templates (`form.hbs`, `detail.hbs`, `list.hbs`, `crud-page.hbs`, `tree-crud-page.hbs`, `editor.hbs`) use fire-and-forget patterns via `onSettled` or `.mutate()` callbacks.

## SaveButton (Unified Save Button with isDirty + Validation)

| Field | Value |
|-------|-------|
| **Component** | `SaveButton` |
| **Hook** | `useIsDirty` (Date-aware shallow comparison) |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/form/save-button.tsx`, `use-is-dirty.ts` |
| **Export** | `import { SaveButton, useIsDirty } from "@simplix-react/ui"` |

### Props

```typescript
interface SaveButtonProps extends Omit<ButtonProps, "loading" | "disabled" | "variant" | "size"> {
  isDirty?: boolean;         // Defaults to true (create mode). false disables button.
  isSaving?: boolean;        // Shows spinner + loading text.
  validationCount?: number;  // Shows destructive badge when > 0, disables button.
  savingText?: string;       // Defaults to t("common.saving").
  disabled?: boolean;        // Additional disable condition.
}
```

### Standard Usage

```tsx
// CrudForm (edit mode) — useIsDirty for automatic dirty detection
const initialValues = useRef(values).current;
const isDirty = useIsDirty(values as Record<string, unknown>, initialValues as Record<string, unknown>);
<SaveButton type="submit" isDirty={isEdit ? isDirty : undefined} isSaving={isPending}>
  {t("entity.save")}
</SaveButton>

// CrudForm (create mode) — isDirty omitted = always enabled
<SaveButton type="submit" isSaving={isPending}>{t("entity.create")}</SaveButton>

// Editor — own isDirty computation
<SaveButton isDirty={isDirty} isSaving={isSaving} onClick={handleSave}>
  {t("entity.saveChanges")}
</SaveButton>

// Editor with validation badge
<SaveButton isDirty={isDirty} isSaving={isSaving} validationCount={errors.length} onClick={handleSave}>
  {t("entity.save")}
</SaveButton>

// Creator — isDirty omitted
<SaveButton isSaving={isPending} onClick={handleCreate}>{t("entity.create")}</SaveButton>
```

### Anti-Pattern

```tsx
// FORBIDDEN -- Manual disabled + loading + ternary text
<Button disabled={!isDirty || isPending} loading={isPending} loadingText={t("saving")}>
  {t("save")}
</Button>

// FORBIDDEN -- Manual Badge inside Button
<Button disabled={!isDirty} loading={isSaving}>
  {t("save")}
  {errors.length > 0 && <Badge>{errors.length}</Badge>}
</Button>

// REQUIRED -- SaveButton
<SaveButton isDirty={isDirty} isSaving={isSaving} validationCount={errors.length}>
  {t("save")}
</SaveButton>
```

### HBS Templates

`form.hbs` and `editor.hbs` use SaveButton with useIsDirty automatically.

## Enum SelectField options — derive from the generated enum, not a hardcoded array

| Field | Value |
|-------|-------|
| **Pattern** | `SelectField` `options` for an enum field |
| **Scope** | All form/editor widgets |

### Rule

When a `SelectField` offers the FULL set of an enum's values, derive options from the generated domain enum constant (the single source of truth), NOT a hardcoded `[{value:"X"},...]` array — so a backend regen that adds a value flows through automatically:

```tsx
import { CredentialStatus } from "@<scope>/domain-<domain>";
options={Object.values(CredentialStatus).map((v) => ({ label: enumLabel("CredentialStatus", v), value: v }))}
```

EXCEPTION — keep an explicit hardcoded list ONLY when the form deliberately offers a SUBSET (e.g. audit-log/form `action` exposes INSERT/UPDATE/DELETE but NOT the system-only SYNC_EXECUTE/FULL_DOWNLOAD of the 5-value `ConfigChangeAction`). Annotate why. Adopted across several generated forms in the reference project.

## groupValidationErrors (no inline validation-error grouping loops)

| Field | Value |
|-------|-------|
| **Helper** | `groupValidationErrors(error)` |
| **Package** | `@simplix-react/ui` |

### Rule

In hand-rolled mutation `.catch`/`onError` handlers, group server validation errors with the framework helper, NEVER an inline `for (const e of errors) { grouped[e.field] = ... }` loop:

```tsx
// FORBIDDEN — inline grouping loop duplicated per widget
const errors = getValidationErrors(error);
if (errors) { const grouped = {}; for (const e of errors) { grouped[e.field] = ...; } setFieldErrors(grouped); }
// REQUIRED
const grouped = groupValidationErrors(error);
if (grouped) setFieldErrors(grouped);
```

Note: the boot mutator UNWRAPS the response envelope, so a create success callback's argument IS the created DTO — read `created.id` directly (typed), never `resp?.data?.id` (dead post-unwrap) behind an `as any`. Use `useCrudFormSubmit` for standard create/update forms; keep the hand-rolled `mutateAsync().then()` flow only when you need the created id in `onSuccess` (e.g. navigate-to-new-entity), since `useCrudFormSubmit.onSuccess` is `() => void`.

## createEntityOptions (FK options loader factory)

| Field | Value |
|-------|-------|
| **Factory** | `createEntityOptions({ useList, listParams, getValue, getLabel, filter?, useEnabled?, onData? })` (`@<scope>/<ui-package>`) |
| **Scope** | Every batch-loaded `{ label, value }` FK options hook (combobox + faceted filter) |

### Rule

An FK entity's `{ label, value }` options — shared by its `EntityCombobox` picker and any faceted filter over the same directory — come from ONE `useXOptions` hook built with `createEntityOptions`, never a hand-rolled `useListX({ size: 1000 }) → adaptOrvalGet → .filter(id).map({label,value})` pipeline repeated per combobox. Annotate the row in `getValue` (`(x: NonNullable<ListX200Body["content"]>[number]) => x.id`) so the item type binds to the real list body. The concrete `useXOptions` lives next to its domain package (a module `shared/ui`, or the shared UI package for cross-domain entities like site/org/user); React Query dedupes the one batch request across the combobox and every filter. Options are icon-free (the combobox and faceted filter type their optional `icon` incompatibly). A server-searched picker (paged, not batch-1000) does NOT fit this factory and stays hand-written.
