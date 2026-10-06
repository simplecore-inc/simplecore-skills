# Customization Recipes

Step-by-step patterns for common post-scaffold customization tasks.

---

## Recipe 1: Add Enum Badge Column to List

**When**: A list column shows raw enum string instead of a translated badge.

**Before** (generated):
```tsx
<CrudList.Column<Entity> field="status" header={fieldLabel("status")} sortable />
```

**After** (customized) - the enum's ONE tone map lives in the project UI package, never in the module (`../audit/registry/tones-and-badges.md`; the audit's `status-map-resurrect` fails a map under a name the project declares retired (`audit.statusMapResurrect` in `.claude/simplix.json`), and `inline-dark-tone-map` lists the other status maps for review):
```tsx
import { resolveBootEnum } from "@simplix-react-ext/simplix-boot-utils";
import { StatusBadge, EmptyValue } from "@simplix-react/ui";
import { entityStatusToTone } from "@<scope>/<ui-package>/<domain>";

<CrudList.Column<Entity> field="status" header={fieldLabel("status")} sortable>
  {({ value }) => {
    const v = resolveBootEnum(value);
    return v
      ? <StatusBadge tone={entityStatusToTone[v] ?? "neutral"} label={enumLabel("entityStatus", v)} />
      : <EmptyValue />;
  }}
</CrudList.Column>
```

**Also update**: `cardContent` prop to use the same pattern for responsive card view.

---

## Recipe 2: Add Card View to List

**When**: You want a responsive card layout for small screens.

```tsx
<CrudList.Table
  cardBreakpoint={480}
  cardTitle={({ row }) => (
    <Flex align="center" gap="sm" className="min-w-0">
      <span className="text-sm font-semibold truncate">{row.name}</span>
      {row.isBuiltin && <Badge variant="secondary" className="shrink-0 text-[0.625rem] px-1.5 py-0">{t("entity.builtin")}</Badge>}
    </Flex>
  )}
  cardContent={({ row }) => (
    <Flex gap="xs" align="center" wrap>
      <Badge variant={TYPE_COLORS[resolveBootEnum(row.type)]}>{enumLabel("entityType", resolveBootEnum(row.type))}</Badge>
      <span className="text-xs text-muted-foreground">{row.count} items</span>
    </Flex>
  )}
>
```

---

## Recipe 3: Add Row Actions

**When**: You need edit/delete/custom actions per row.

```tsx
const nav = useCrudNavigation(search, onNavigate);

const actions: RowActionDef<Entity>[] = [
  { type: "view", onClick: (row) => nav.openDetail(row.id) },
  { type: "edit", onClick: (row) => nav.openEdit(row.id) },
  { type: "delete", onClick: (row) => handleDelete(row.id) },
];

<CrudList.Table actions={actions} ... />
```

How the actions draw (`actionVariant`) is the product's default, set once on `UIProvider`'s `defaults` - a screen does not name it (invariant #67; the audit's `screen-picks-action-variant`).

---

## Recipe 4: Build a Custom Editor Widget

**When**: CrudForm is too simple for your editing needs (bit-map editors, LED configurators, etc.)

### Step 1: Create the editor file

```
modules/<domain>/src/widgets/<entity>/editor.tsx
```

Or generate from template:
```bash
npx simplix scaffold <entity> --module <domain> --template editor
```

### Step 2: Outer guard component

```tsx
export function EntityEditor({ entityId, variant = "panel", onClose, onSuccess }: Props) {
  const { t } = useTranslation("<domain>/widgets");
  const { data, isLoading } = useGetEntity(entityId);

  if (isLoading) return <QueryFallback isLoading />;
  if (!data) return <QueryFallback isLoading={false} notFoundMessage={t("entity.notFound")} />;

  return <EditorContent key={`${data.id}-${data.updatedAt}`} data={data} variant={variant} onClose={onClose} onSuccess={onSuccess} />;
}
```

### Step 3: Inner content component

```tsx
function EditorContent({ data, variant, onClose, onSuccess }: ContentProps) {
  const { t } = useTranslation("<domain>/widgets");
  const updateMutation = useUpdateEntity();
  const invalidate = useInvalidateEntity("/api/v1/entity");

  // Domain state
  const initialState = useMemo(() => buildInitialState(data), [data]);
  const [state, setState] = useState(initialState);

  // Dirty check
  const isDirty = useMemo(() => !isEqual(state, initialState), [state, initialState]);

  // Unsaved changes guard
  const { guardedNavigate, dialog: unsavedDialog } = useUnsavedChanges({ isDirty });

  // Save handler
  const handleSave = useCallback(() => {
    const dto = buildUpdateDTO(data, state);
    updateMutation.mutate({ id: data.id, data: dto }, {
      onSuccess: () => { invalidate(); onSuccess?.(); },
      onError: invalidate,
    });
  }, [data, state, updateMutation, invalidate, onSuccess]);

  const handleClose = useCallback(() => {
    guardedNavigate(() => onClose?.());
  }, [guardedNavigate, onClose]);

  return (
    <Stack fill>
      {variant === "panel" && <PanelHeader title={data.name} onClose={handleClose} />}
      {/* Use the Stack `overflow` prop — never a raw `<div className="...overflow-y-auto">`. */}
      <Stack flex overflow="auto">
        <Stack gap="md" padded className="px-5">
          {/* Your custom editor UI */}
        </Stack>
      </Stack>
      <EditorFooter>
        <Button size="sm" variant="outline" onClick={handleClose}>{t("common.cancel")}</Button>
        <Flex gap="sm">
          <SaveButton isDirty={isDirty} isSaving={updateMutation.isPending} onClick={handleSave}>
            {t("common.save")}
          </SaveButton>
        </Flex>
      </EditorFooter>
      {unsavedDialog}
    </Stack>
  );
}
```

### Step 4: Wire into CrudPage

```tsx
// In crud-page.tsx
if (view === "edit" && entityId) {
  return <EntityEditor entityId={entityId} variant={variant === "page" ? "page" : "panel"} onClose={() => nav.back()} onSuccess={() => nav.openDetail(entityId)} />;
}
```

### Step 5: Export from widget index

```tsx
// widgets/<entity>/index.ts
export { EntityEditor } from "./editor";
```

---

## Recipe 5: Remove Fields from Generated Form

**When**: Generated form includes read-only fields (id, createdAt) that shouldn't be editable.

A field the update DTO carries stays in the form's state even when no control edits it: `id` (and any system field the DTO requires, such as `displayOrder`) is kept in `FormValues`, the initial state and the submit payload (`../audit/registry/identity-and-detail-fields.md` § System Field Exclusion; invariant #34). Only what the DTO does not accept leaves the state.

### Step 1: Remove from FormValues interface

```tsx
export interface EntityFormValues {
  id?: string;          // KEPT: the update DTO needs it; no control edits it
  name: string;
  description: string;
  // DELETE: createdAt, updatedAt (server-owned, not in the DTO)
}
```

### Step 2: Remove from initial state

```tsx
const [values, setValues] = useState<Partial<EntityFormValues>>({
  name: defaultValues?.name ?? "",
  description: defaultValues?.description ?? "",
  id: defaultValues?.id,
  // DELETE: createdAt, updatedAt entries
});
```

### Step 3: Remove form fields

Delete the corresponding `<FormFields.*>` JSX elements - for `id`, the control only; the value stays in the state above.

---

## Recipe 6: Add Detail with Inline Layout

**When**: You want a compact key-value layout instead of stacked.

```tsx
<CrudDetail.Section title={t("entity.section")}>
  <DetailField label={fieldLabel("name")} value={data.name} layout="inline" />
  <DetailField label={fieldLabel("description")} value={data.description} layout="inline" />
  {/* the RAW resolved value keys the tone; the label goes in displayValue (invariant #53) */}
  <DetailBadgeField label={fieldLabel("status")} value={resolveBootEnum(data.status) || ""} displayValue={enumLabel("entityStatus", resolveBootEnum(data.status) || "")} variants={entityStatusVariants} layout="inline" />
  <DetailBooleanField label={fieldLabel("isActive")} value={data.isActive} layout="inline" />
  <DetailDateField label={fieldLabel("createdAt")} value={data.createdAt} layout="inline" />
</CrudDetail.Section>
```

---

## Recipe 7: Wire Delete with i18n Confirmation

**When**: Generated detail uses hardcoded delete messages.

Clone the wiring from a precedent page on EVERY crud-page variant (invariant #46); the shape is `useCrudDeleteWired` + `adaptOrvalDelete` + `{deleteDialog}`:

```tsx
import { useCrudDeleteWired, adaptOrvalDelete } from "@simplix-react/ui";

const del = useCrudDeleteWired({
  deleteMutation: adaptOrvalDelete(useDeleteEntity(), "entityId"),
  labels, // the confirmation's title and description, naming the record by a human value - as the precedent passes them
  onDeleted,
});

// onDelete activates only when onDeleted exists - no dead button on a callback-less render
<EntityDetail entityId={entityId} onDelete={onDeleted ? del.requestDelete : undefined} />
{del.deleteDialog}
```

Locale keys:
```json
{
  "entity": {
    "deleteConfirmTitle": "Delete Entity",
    "deleteConfirmDescription": "Are you sure you want to delete \"{{name}}\"? This action cannot be undone."
  }
}
```

---

## Recipe 8: Add Map Page for Geo Entities

**When**: Entity has latitude/longitude fields.

```tsx
import { Map, MapMarker, useMapPageData, isValidCoord } from "@simplix-react/ui";

function EntityMapPage() {
  const list = useEntityList();
  const { validItems, isLoading } = useMapPageData({
    data: list.data,
    isLoading: list.isLoading,
    hasValidCoords: (item) => isValidCoord({ lat: item.latitude, lng: item.longitude }),
  });

  usePageHeader({ title: t("entity.mapTitle") });

  return (
    <Map center={[37.5, 127.0]} zoom={10}>
      {validItems.map(item => (
        <MapMarker
          key={item.id}
          coords={{ lat: item.latitude, lng: item.longitude }}
          label={item.name}
        />
      ))}
    </Map>
  );
}
```

---

## Recipe 9: Embedded Page (External List)

**When**: A page is embedded inside another page (e.g., a category list inside product detail).

```tsx
interface CategoryCrudPageProps {
  variant?: "panel" | "dialog" | "page";
  search: CrudSearch;
  onNavigate: (search: CrudSearch) => void;
  externalList?: ReturnType<typeof useCategoryList>;  // Pass from parent
}

function CategoryCrudPage({ externalList, ...props }: CategoryCrudPageProps) {
  const internalList = useCategoryList();
  const list = externalList ?? internalList;

  // Suppress page header when embedded
  usePageHeader((() => {
    if (externalList) return {};
    // ... normal header logic
  })());

  return <ListDetail list={<CategoryList list={list} />} detail={...} />;
}
```

---

## Recipe 10: Customize ListDetail Panel Width

**When**: Default panel width doesn't fit your content.

The detail's width is the product's, not the screen's: the panel, the drawer and the dialog share one measure (invariant #69), and a product that needs another changes it once at the app root (`UIProvider`'s `defaults`, invariant #67). A screen passes a width only with the reason written beside it:

```tsx
// Compact list beside a wide editor - the reason is recorded where the screen departs (#67)
{/* departs from the generated shape: the editor's canvas needs the width */}
<ListDetail listWidth={380}>
  ...
</ListDetail>
```
