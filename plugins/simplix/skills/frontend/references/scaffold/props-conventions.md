# Props Conventions Reference

Conventions for widget/editor callback props and page header patterns used across all domain modules.

## 1. Widget Callback Props Convention

| Prop | Purpose | Used In |
| --- | --- | --- |
| `onClose` | Panel header close button - dismiss without saving | Forms, Details, Editors (panel variant) |
| `onBack` | Back/Return button - full-page variant navigation | Forms, Details, Editors (page variant) |
| `onCancel` | Cancel button - form-only mode, alternative to onBack | Forms |
| `onSuccess` | After successful save - navigate, refresh list | Forms, Editors |
| `onEdit` | Detail view → edit mode transition | Details |
| `onDeleted` | After successful deletion | Details |

## 2. Editor Props Pattern

Editors (e.g., `ProductEditor`, `CategoryEditor`) follow:

```tsx
interface EditorProps {
  entityId?: string;        // undefined = create mode
  variant?: "panel" | "page";
  onClose?: () => void;     // panel variant close
  onBack?: () => void;      // page variant back
  onSuccess?: () => void;   // after successful save
}
```

## 3. usePageHeader Patterns

Header patterns:

### A. Standard conditional (e.g., product, category)

```tsx
// the create action is gated on its endpoint's permission on BOTH variants (invariant #52)
const canCreate = useCan("create", SUBJECTS.<screenKey>);
usePageHeader((() => {
  if (variant === "page") {
    if (view === "new") return { title: t("entity.new") };
    if (view === "edit") return { title: t("entity.edit") };
    if (view === "detail") return { title: t("entity.detail") };
    return {
      title: t("entity.list"),
      actions: canCreate ? <Button onClick={handleAdd}>{t("common.add")}</Button> : undefined,
    };
  }
  return { title, description, actions };
})());
```

### B. Embedded suppression (e.g., a child entity embedded in a parent)

```tsx
if (externalList) return {};  // suppress header when embedded
```

### C. Editor view null-return (e.g., an entity with a custom editor)

```tsx
if (isEditorView) return null;  // hide header during editing
```

### D. Static read-only (e.g., a read-only reference entity)

```tsx
usePageHeader({ title: t("entity.title"), description: t("entity.description") });
```

## 4. ListDetail Sizing Guide

- The detail's width is not set per screen: the panel, the drawer and the dialog share one measure (invariant #69), and a product that needs another changes it once on `UIProvider`'s `defaults` (invariant #67)
- Pass `detailWidth` or `listWidth` (e.g., `listWidth={380}` for a compact list beside a wide editor) only with the reason written at that line, as any departure from the generated shape is (#67)
- Do NOT set both unless explicitly needed
- **`ListDetail` splits the height that is left**, so a page that stacks status cards, a
  banner and a description table above it hands both panels very little - and opening the
  detail squashes the two together rather than one of them. Give the component a minimum
  height on such pages (around `26rem` in practice) so the split has something to divide.
