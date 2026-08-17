# Props Conventions Reference

Conventions for widget/editor callback props and page header patterns used across all domain modules.

## 1. Widget Callback Props Convention

| Prop | Purpose | Used In |
| --- | --- | --- |
| `onClose` | Panel header close button — dismiss without saving | Forms, Details, Editors (panel variant) |
| `onBack` | Back/Return button — full-page variant navigation | Forms, Details, Editors (page variant) |
| `onCancel` | Cancel button — form-only mode, alternative to onBack | Forms |
| `onSuccess` | After successful save — navigate, refresh list | Forms, Editors |
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

Four patterns found across pages:

### A. Standard conditional (e.g., product, category)

```tsx
usePageHeader((() => {
  if (variant === "page") {
    if (view === "new") return { title: t("entity.new") };
    if (view === "edit") return { title: t("entity.edit") };
    if (view === "detail") return { title: t("entity.detail") };
    return { title: t("entity.list"), actions: <Button>Add</Button> };
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

- Default: `detailWidth={480}` for standard detail/form panels
- Override `listWidth` only when list needs specific size (e.g., `listWidth={380}` for compact list with wide editor)
- Do NOT set both unless explicitly needed
- **`ListDetail` splits the height that is left**, so a page that stacks status cards, a
  banner and a description table above it hands both panels very little — and opening the
  detail squashes the two together rather than one of them. Give the component a minimum
  height on such pages (around `26rem` in practice) so the split has something to divide.
