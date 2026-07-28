# Drag-and-Drop Reordering Reference

Guide for implementing drag-and-drop reordering in `CrudList.Table` using `adaptOrvalOrder()`.

---

## Reorder Pattern with adaptOrvalOrder

The `@simplix-react` framework reorders rows through a single `reorder` prop on
`CrudList.Table`. You pass it the order field name, the id field name, and an
`onReorder` callback. `adaptOrvalOrder()` adapts an Orval-generated order
mutation into exactly that callback, so it is wired directly as `onReorder`.

---

## Key Concepts

- **order field** (`displayOrder` / `sortOrder`): the entity field that stores the row order.
- **id field** (`id`): the entity's primary-key field, used to address each moved row.
- **`adaptOrvalOrder(mutation, idField, orderField, options?)`**: adapts the generated
  order mutation (e.g. `useOrder<Entity>`) into an `onReorder(items)` handler that issues the
  batch order update. Imported from `@simplix-react/ui`.
- **Conditional drag handles**: the framework shows drag handles only when the list is sorted
  by the order field ascending — it manages this internally.

---

## CrudList.Table Reorder Support

`reorder` takes three keys: `orderField`, `idField`, and `onReorder`. Wire
`adaptOrvalOrder()` straight into `onReorder` — do NOT hand-roll a `mutateAsync` loop.

```tsx
import { adaptOrvalOrder, useInvalidateEntity } from "@simplix-react/ui";

const orderMutation = useOrderProduct();              // Orval-generated order hook (use<Verb><Entity>)
const invalidate = useInvalidateEntity("/api/v1/product");

<CrudList.Table
  reorder={{
    orderField: "displayOrder",                       // entity field holding the order (or "sortOrder")
    idField: "id",                                     // entity primary-key field
    onReorder: adaptOrvalOrder(orderMutation, "id", "displayOrder", { onSettled: invalidate }),
  }}
>
  <CrudList.Column field="name" header={fieldLabel("name")} sortable />
  {/* ... other columns */}
</CrudList.Table>
```

> The `reorder` key is **`orderField`** (not `field`); `idField` is optional and
> defaults to `"id"`, but pass it explicitly (as the examples do) for clarity.
> `adaptOrvalOrder` takes four positional arguments — `(mutation, idField, orderField, options)` —
> and returns the `onReorder` callback itself; you do not call `.mutateAsync` yourself.

---

## adaptOrvalOrder Signature

```tsx
import { adaptOrvalOrder } from "@simplix-react/ui";

// (orderMutation, idField, orderField, options) → (reorderedRows) => Promise<void>
const onReorder = adaptOrvalOrder(useOrderProduct(), "id", "displayOrder", {
  onSettled: useInvalidateEntity("/api/v1/product"),   // refetch after the order update settles
});
```

The adapter computes the new order values from the dropped position and submits the
batch order mutation. Pair it with `useInvalidateEntity(<resource-path>)` via `onSettled`
so the list refetches once the server confirms.

---

## Conditional Drag-Drop

Drag-and-drop only makes sense when the list is sorted by the order field ascending —
manual reordering against a filtered or differently-sorted view is ambiguous.

### Why Conditional

- Manual reordering only makes sense in ascending order
- Prevents confusion from descending sort during drag operations
- Filtering shows only a subset of items, making reorder results unpredictable

### Detection

The framework handles this internally when you use the `reorder` prop on `CrudList.Table`.
Drag handles automatically appear/hide based on the current sort state.

---

## Sorting and Filters Coexist with Drag

Reorderable lists keep `sortable` columns and a `CrudList.FilterBar` — the framework gates
the drag affordance on the active sort instead of forcing you to strip sorting/filtering.
The older "always-on drag handle → remove `sortable` from every column and drop the FilterBar"
approach is NOT how reorderable lists are built here; do not disable sorting or filtering just
to enable reordering.
