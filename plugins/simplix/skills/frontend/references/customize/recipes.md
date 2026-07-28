# Customization Recipes

Step-by-step patterns for common post-scaffold customization tasks.

---

## Recipe 1: Add Enum Badge Column to List

**When**: A list column shows raw enum string instead of a translated badge.

**Before** (generated):
```tsx
<CrudList.Column<Entity> field="status" header={fieldLabel("status")} sortable />
```

**After** (customized):
```tsx
import { resolveBootEnum } from "@simplix-react-ext/simplix-boot-utils";

const STATUS_COLORS: Record<string, BadgeVariants["variant"]> = {
  ACTIVE: "default",
  INACTIVE: "secondary",
  PENDING: "outline",
};

<CrudList.Column<Entity> field="status" header={fieldLabel("status")} sortable>
  {({ value }) => {
    const v = resolveBootEnum(value);
    return <Badge variant={STATUS_COLORS[v] ?? "outline"}>{enumLabel("entityStatus", v)}</Badge>;
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

<CrudList.Table actions={actions} actionVariant="dropdown" ... />
```

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
        <Button size="sm" variant="primary" onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
          {updateMutation.isPending ? t("common.saving") : t("common.save")}
        </Button>
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

### Step 1: Remove from FormValues interface

```tsx
// REMOVE these fields from the interface
export interface EntityFormValues {
  name: string;
  description: string;
  // DELETE: id, createdAt, updatedAt
}
```

### Step 2: Remove from initial state

```tsx
const [values, setValues] = useState<Partial<EntityFormValues>>({
  name: defaultValues?.name ?? "",
  description: defaultValues?.description ?? "",
  // DELETE: id, createdAt, updatedAt entries
});
```

### Step 3: Remove form fields

Delete the corresponding `<FormFields.*>` JSX elements.

---

## Recipe 6: Add Detail with Inline Layout

**When**: You want a compact key-value layout instead of stacked.

```tsx
<CrudDetail.Section title={t("entity.section")}>
  <DetailField label={fieldLabel("name")} value={data.name} layout="inline" />
  <DetailField label={fieldLabel("description")} value={data.description} layout="inline" />
  <DetailBadgeField label={fieldLabel("status")} value={enumLabel("entityStatus", resolveBootEnum(data.status))} variant="default" layout="inline" />
  <DetailBooleanField label={fieldLabel("isActive")} value={data.isActive} layout="inline" />
  <DetailDateField label={fieldLabel("createdAt")} value={data.createdAt} layout="inline" />
</CrudDetail.Section>
```

---

## Recipe 7: Wire Delete with i18n Confirmation

**When**: Generated detail uses hardcoded delete messages.

```tsx
import { useCrudDeleteDetail } from "@simplix-react/ui";

const { deleteProps } = useCrudDeleteDetail({
  mutation: adaptOrvalDelete(useDeleteEntity(), "entityId"),
  entityId: data.id,
  onDeleted,
});

<CrudDelete
  title={t("entity.deleteConfirmTitle")}
  description={t("entity.deleteConfirmDescription", { name: data.name })}
  {...deleteProps}
/>
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

```tsx
// Standard: detail panel on right
<ListDetail detailWidth={480}>
  ...
</ListDetail>

// Compact list with wide editor
<ListDetail listWidth={380}>
  ...
</ListDetail>
```

Default detail width is framework-defined. Only override when content requires it.
