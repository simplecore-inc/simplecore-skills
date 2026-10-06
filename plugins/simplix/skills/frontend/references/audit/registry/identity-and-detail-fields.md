> Commonization registry - **Identity, detail fields & user labels**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry - Identity, detail fields & user labels

## ID/UUID Exposure Prevention

| Field | Value |
|-------|-------|
| **Pattern** | Prevent raw UUID/ID exposure in user-facing UI elements |
| **Scope** | All widget detail, form, and crud-page files |

### Rules

All user-facing UI text MUST display human-readable names, NEVER raw UUIDs. This applies to:

#### 1. Detail Header

Header MUST use entity display name from loaded data, placed AFTER `usePreviousData()` call.

```tsx
// REQUIRED — Entity name from loaded data
const displayData = usePreviousData(data);
if (!displayData) return <QueryFallback ... />;
const header = onClose ? <Heading level={4} tone="muted">{String(displayData.name ?? "")}</Heading> : undefined;

// FORBIDDEN — UUID in header
const header = onClose ? <Heading level={4} tone="muted">{t("entity.detailHeader", { id: String(entityId) })}</Heading> : undefined;
```

#### 2. Form Header (Live Title)

Header MUST be defined inside inner component (where `name` state lives) for real-time updates. Outer component passes `isEdit` boolean instead of `header` ReactNode.

- **New mode**: Fixed title from translation key (e.g., `t("entity.newHeader")`)
- **Edit mode**: Live `name` state value (updates as user types)

```tsx
// REQUIRED — Inner component pattern
// Outer:
return <EntityFormInner ... isEdit={isEdit} ... />;

// Inner:
const header = onClose ? <Heading level={4} tone="muted">{isEdit ? (values.name as string) : t("entity.newHeader")}</Heading> : undefined;

// FORBIDDEN — Static header in outer component with UUID
const header = onClose ? <Heading level={4} tone="muted">{isEdit ? t("entity.editHeader", { id: String(entityId) }) : t("entity.newHeader")}</Heading> : undefined;

// FORBIDDEN — Fallback to "new" title when name is empty in edit mode
const header = ... {name || t("entity.newSchedule")} ...;
```

For entities without a single `name` field, compose the display name from its parts:
```tsx
const header = onClose ? <Heading level={4} tone="muted">{isEdit ? `${values.lastName ?? ""} ${values.firstName ?? ""}`.trim() : t("entity.newHeader")}</Heading> : undefined;
```

#### 3. Detail FK Field Resolution

FK fields (ending with `Id`) MUST display the nested object's `.name` instead of the raw UUID. Backend DTOs provide dual fields: `categoryId` (string) + `category` (nested object with `{ id, name }`). The name is drawn through the referenced entity's peek label wherever its detail component exists (SKILL.md invariant #66), and what is handed over is the raw nullable name - never the id, which rule 5 below covers when the name is absent.

```tsx
// REQUIRED - Nested object name, passed nullable so the field draws its own no-value badge
value={displayData.category?.name}

// FORBIDDEN - Raw UUID display, alone or as the fallback behind the name
value={String(displayData.categoryId ?? "")}
value={displayData.category?.name ?? String(displayData.categoryId ?? "")}
```

When nested object is not available (e.g., form `RootValues` only has ID), pass name from parent component as a separate prop.

#### 4. Delete Confirmation Dialog

Delete dialog MUST display entity name, not UUID. When display field is null/undefined, fallback MUST be empty string `""`, NEVER UUID.

```tsx
// REQUIRED — name available
{ type: "delete", onClick: (row) => requestDelete({ id: row.id!, name: String(row.name ?? "") }) }

// REQUIRED — no displayNameField (null case)
{ type: "delete", onClick: (row) => requestDelete({ id: row.id!, name: "" }) }

// FORBIDDEN — direct UUID
{ type: "delete", onClick: (row) => requestDelete({ id: row.id!, name: String(row.id) }) }

// FORBIDDEN — UUID fallback when name is null
{ type: "delete", onClick: (row) => requestDelete({ id: row.id!, name: String(row.name ?? row.id) }) }
```

#### 5. Fallback Values

When a referenced entity name is unavailable, pass the nullable name and let the component draw the fallback - a `DetailFields.*` field its `EmptyValueBadge`, a table cell or other compact context `EmptyValue` (`states-and-fallbacks.md`) - NEVER the raw UUID, and never a hand-written dash literal.

```tsx
// REQUIRED - detail field: the raw nullable name
value={data.parent?.category?.name}
// REQUIRED - compact cell
{data.parent?.category?.name ?? <EmptyValue />}

// FORBIDDEN
value={data.parent?.category?.name ?? data.parent?.categoryId}
```

**Exception - picker option labels**: select/picker
OPTION labels may fall back to the id (`item.name ?? item.id ?? ""` - the SearchPopover pattern),
since a picker item must remain identifiable and selectable even when unnamed. Table cells,
detail fields, and headers still follow the fallback rule above.

### HBS Template Patterns (Scaffolding)

The following scaffold templates in `simplix-react/packages/cli/src/templates/ui/` enforce these rules for newly generated code:

| Template | Pattern |
|----------|---------|
| `detail.hbs` | Header uses `displayData.{{displayNameField}}` after `usePreviousData()`. FK fields use `displayData.{{fkEntityField}}?.name` fallback. |
| `form.hbs` | Header defined in inner component using `values.{{displayNameField}}` for live updates. `isEdit` prop instead of `header` ReactNode. |
| `crud-page.hbs` | Delete confirm uses `row.{{displayNameField}}` when available. When `displayNameField` is null, uses empty string `""` instead of `row.{{rowIdField}}`. |
| `scaffold-crud.ts` | `displayNameField` auto-detected from fields (`name` > `title` > `label` > `displayName` > first string). `FieldInfo.isForeignKey` / `fkEntityField` added for FK detection. |

## System Field Exclusion

| Field | Value |
|-------|-------|
| **Pattern** | Prevent system-managed fields from being displayed or edited by users |
| **Scope** | All scaffold-generated detail and form widgets |
| **Package** | `@simplix-react/cli` (scaffold-crud.ts, detail.hbs, form.hbs) |

### System Fields

| Field Name | Type | Purpose | Auto-Managed |
|------------|------|---------|:---:|
| `id` | string (UUID) | Entity primary key | Yes (server-generated) |
| `displayOrder` | number | UI list sorting order | Partial (some entities auto-increment via `max + 100`) |
| `sortOrder` | number | Hierarchy/group ordering | No (default 0) |

### Rules

1. **Detail views**: System fields MUST NOT appear as visible `DetailFields.*` components. `id` is only shown in `auditData` prop.
2. **Form views**: System fields MUST NOT appear as editable `FormFields.*` components. However, they MUST remain in `FormValues` interface, state initialization, and `handleSubmit` for server transmission.
3. **State pattern**: Use read-only `const [field] = useState(...)` (no setter) for system fields that are not rendered.
4. **Scaffold enforcement**: `FieldInfo.isSystemField` flag + `SYSTEM_FIELDS` constant in `scaffold-crud.ts`. HBS templates use `{{#unless this.isSystemField}}` to skip UI rendering.

### Usage in scaffold-crud.ts

```typescript
const SYSTEM_FIELDS = ["id", "displayOrder", "sortOrder"];

// FieldInfo includes:
isSystemField: SYSTEM_FIELDS.includes(name)
```

### Usage in HBS Templates

```handlebars
{{!-- detail.hbs: Skip system fields in display --}}
{{#each fields}}
{{#unless this.isSystemField}}
  <DetailFields.DetailTextField ... />
{{/unless}}
{{/each}}

{{!-- form.hbs: FormValues and state include ALL fields --}}
{{!-- form.hbs: UI rendering skips system fields --}}
{{#each fields}}
{{#unless this.isSystemField}}
  <FormFields.TextField ... />
{{/unless}}
{{/each}}
```

### Anti-Pattern

```tsx
// FORBIDDEN — System field visible in detail view
<DetailFields.DetailTextField
  label={fieldLabel("sortOrder")}
  value={displayData.sortOrder}
/>
<DetailFields.DetailTextField
  label={fieldLabel("id")}
  value={String(displayData.id ?? "")}
/>

// FORBIDDEN — System field editable in form
<FormFields.NumberField
  label={fieldLabel("sortOrder")}
  value={sortOrder}
  onChange={(v) => setSortOrder(v ?? 0)}
/>

// FORBIDDEN — Commented-out system field JSX (dead code)
{/*<FormFields.TextField*/}
{/*  label={fieldLabel("id")}*/}
{/*  value={id}*/}
{/*  onChange={setId}*/}
{/*/>*/}

// REQUIRED — System field in state but not rendered
const [sortOrder] = useState<number>(defaultValues?.sortOrder ?? 0);
const [id] = useState<string>(defaultValues?.id ?? "");
// ... these are included in handleSubmit but have no UI
```

## CrudDetail AuditFooter

| Field | Value |
|-------|-------|
| **Pattern** | Audit metadata display (ID, createdAt, updatedAt) in detail views |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/crud/detail/crud-detail-audit-footer.tsx` |

### Architecture

`DetailAuditFooter` is a standalone component exported from `@simplix-react/ui`. It is also integrated into `CrudDetail` via the `auditData` prop, which renders it as a `sticky bottom-0` element inside the scrollable body, directly above the footer actions bar.

```
┌─────────────────────────────────────┐
│ Header                        [X]   │
├─────────────────────────────────────┤
│ Scrollable body                     │
│   Section (fields...)               │
│   ┌─────────────────────────────┐   │
│   │ AuditFooter (sticky bottom) │   │  ← bg-muted/50, rounded-md
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│ ← Back              Delete   Edit   │
└─────────────────────────────────────┘
```

### Props

```typescript
interface AuditData {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
}

// On CrudDetail (passed through to the footer), and on CrudDetail.AuditFooter itself:
auditData?: AuditData;
displayZone?: string; // IANA zone the two stamps render in
```

### Features

- **ID display**: UUID last 12 chars, click to copy full ID to clipboard
- **Tooltip**: Radix primitive (no Arrow), `bg-popover` for theme support
- **Date format**: locale-aware medium date and short time, `formatDateTime(date, locale, zone)` (`Intl.DateTimeFormat` with `dateStyle: "medium"`, `timeStyle: "short"`), the same format the panel's own date fields use. The zone is the `displayZone` prop, else the app-level default display zone, else the browser zone; a stamp that does not parse is shown as received
- **Layout**: Single row - ID left, dates right (`ml-auto`)
- **Design**: `bg-muted/50 rounded-md`, no border
- **Empty handling**: Returns null when all fields are empty

### Usage

```tsx
// Via CrudDetail prop (recommended for detail views)
<CrudDetail
  auditData={{ id: displayData.id, createdAt: displayData.createdAt, updatedAt: displayData.updatedAt }}
  footer={<CrudDetail.DefaultActions ... />}
>
  <CrudDetail.Section>...</CrudDetail.Section>
</CrudDetail>

// Standalone (for use outside CrudDetail)
<CrudDetail.AuditFooter auditData={{ id: data.id, createdAt: data.createdAt, updatedAt: data.updatedAt }} />
```

### Anti-Pattern

A detail **with no tabs**:

```tsx
// FORBIDDEN - AuditFooter as children of an untabbed detail (causes width mismatch in dialog and position drift)
<CrudDetail>
  <CrudDetail.Section>...</CrudDetail.Section>
  <CrudDetail.AuditFooter auditData={...} />
</CrudDetail>

// REQUIRED — Use auditData prop on CrudDetail
<CrudDetail auditData={...}>
  <CrudDetail.Section>...</CrudDetail.Section>
</CrudDetail>
```

A **tabbed** detail is the other shape: `CrudDetail.AuditFooter` goes at the end of the FIRST tab's panel and nowhere else, because on the root the record's stamps render under every tab (SKILL.md invariant #72; the audit's `audit-strip-outside-the-first-tab` enforces it).

### HBS Template

`detail.hbs` automatically includes `auditData` prop on `CrudDetail` for all scaffolded entities:

```handlebars
<CrudDetail ... auditData={{ldb}} id: displayData.id, createdAt: displayData.createdAt, updatedAt: displayData.updatedAt {{rdb}} footer={...}>
```

### i18n Keys

| Key | en | ko | ja |
|-----|----|----|-----|
| `audit.created` | Created | 생성일 | 作成日 |
| `audit.modified` | Modified | 수정일 | 更新日 |
| `audit.clickToCopy` | Click to copy ID | 클릭하여 ID 복사 | クリックしてIDをコピー |
| `audit.copied` | Copied! | 복사됨! | コピーしました! |

## LabeledField

| Field | Value |
|-------|-------|
| **Component** | `LabeledField` (generalizes `SettingSwitch`) |
| **Package** | `@simplix-react/ui` |
| **Source** | `base/controls/labeled-field.tsx` |

### Rule

Label + optional description on the left, an arbitrary `control` (Switch/Select/Button/…) on the right. `SettingSwitch` now composes `LabeledField`. Use it instead of re-implementing the `Flex justify-between` + `Label` + `<p text-xs muted>` + control row.

## DetailListRow / DetailList

| Field | Value |
|-------|-------|
| **Components** | `DetailListRow`, `DetailList` |
| **Package** | `@simplix-react/ui` |
| **Source** | `base/display/detail-list-row.tsx` |

### Rule

Bordered list of `icon? + primary + trailing?` rows. `DetailList` is the `overflow-hidden rounded-lg border` container; `DetailListRow` is the `h-10 border-b px-4 last:border-b-0` row (interactive when `onClick` is set). Replaces hand-written bordered detail-row groups.

## DetailStatusField (tone-driven status detail field)

| Field | Value |
|-------|-------|
| **Component** | `DetailFields.DetailStatusField` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/fields/detail/status-field.tsx` |

### Rule

Read-only status/severity detail field. Renders a tone-driven `StatusBadge` inside the standard `DetailFieldWrapper` with the same `EmptyValueBadge` empty fallback as other `DetailFields.*`. Props: `tone` (resolved `StatusTone`), `value` (translated label), `showDot?`, `icon?`, `appearance?`, `badgeSize?` (default `sm`), `fallback?` (string override of the badge). Use this - NOT `DetailBadgeField` (legacy Badge `variants` map) and NOT a hand-built `DetailFieldWrapper` + `LabeledField` + inline `StatusBadge` - whenever a detail view shows an enum/status with a shared tone map. An enum with a Badge variants map and no tone map uses `DetailBadgeField`; SKILL.md invariant #53 holds both.

```tsx
const v = resolveBootEnum(displayData.status) || "";
<DetailFields.DetailStatusField tone={memberStatusToTone[v] ?? "neutral"} value={enumLabel("MemberStatus", v)} showDot layout="inline" />
```

### Anti-Pattern

```tsx
// FORBIDDEN — LabeledField/DetailFieldWrapper + inline StatusBadge, or an inert all-"default" DetailBadgeField variants map
<DetailFieldWrapper label={...}><StatusBadge tone={...} label={...} /></DetailFieldWrapper>
// REQUIRED
<DetailFields.DetailStatusField tone={...} value={...} />
```

## User identity labels (@<scope>/<ui-package>/identity)

| Field | Value |
|-------|-------|
| **Components** | the project's inline user label, its detail-header label, its avatar, and its current-user avatar hook |
| **Package** | `@<scope>/<ui-package>` (subpath `./identity`) |

### Rule

Where the product shows user avatars, every render of a user account's display name goes through the project's identity components, which own the avatar request and the fallback for a user with no uploaded photo. Never a bare name where the user id is in scope, never a hand-built `<img>` against the avatar endpoint, and never a module-local copy of the current-user avatar assembly. The project's own registry names the components and their props (`../registry.md` § Adding a new pattern).

## PeekTriggerButton (cross-detail peek trigger)

| Field | Value |
|-------|-------|
| **Component** | `PeekTriggerButton` (`@<scope>/<ui-package>/layout`) |
| **Scope** | Any trigger that opens a `DetailPeekDialog` |

### Rule

A cross-detail reference opens the referenced record in a `DetailPeekDialog`; its trigger is always `PeekTriggerButton`, never a hand-rolled `<Button>` with a `stopPropagation` closure. Which form a place takes, and why, is SKILL.md invariant #66 (full form in `invariants.md`); this entry is the component's contract:

- **`appearance`** - `"inline"` (outline button carrying the label and the icon) or the default `"icon"` (icon-only ghost button, label as tooltip and accessible name).
- **`tight`** - whether the control hugs the value in front of it. It defaults to the shape (`"icon"` hugs, `"inline"` does not) and is overridden only for an icon in a trailing slot, where nothing precedes it.
- **`target`** - what it opens, as a person reads it; it becomes the accessible name of an icon-only trigger, which must pass it.
- Both forms draw the external-link icon - the dialog is a window onto another record, and an eye says 「read-only」, which is a different promise - and both stop row-click propagation. A module-local icon-only peek button is a duplicate - use `appearance="icon"`.

## usePeekTarget (peek open/close state machine)

| Field | Value |
|-------|-------|
| **Hook** | `usePeekTarget<T = true>()` (`@<scope>/<ui-package>/layout`) |
| **Scope** | A one-off `DetailPeekDialog` trigger that is not a reusable reference label |

### Rule

The open/close state a widget-root `DetailPeekDialog` needs comes from `usePeekTarget`, never a hand-rolled `useState(false)` + manual `onOpenChange` closure. It returns `{ target, isOpen, open, close, onOpenChange }`: a boolean single-target peek uses the default `T` (`open()` / `isOpen`); a nullable multi-kind peek passes a target object (`open({ kind, id, title })`) and reads `target?.kind` at the mount gate. Wire `open={peek.isOpen}` and `onOpenChange={peek.onOpenChange}` straight through. Label lookup and `goToHref` assembly stay with the caller (domain- and i18n-scoped).

**A reference label does NOT use this hook** - `*PeekLabel` components dispatch to the app-root peek host (`usePeekHost`, registry entry below), so the dialog mounts outside the row. Reach for `usePeekTarget` only when the trigger is screen-specific and its state already sits outside every cell and `.map()` callback (invariant #45).

## usePeekHost / PeekHost (app-root peek mounting)

| Field | Value |
|-------|-------|
| **Hook / Component** | `usePeekHost()` · `PeekHost` (`@<scope>/<ui-package>/peek`) |
| **Scope** | Every reusable `*PeekLabel`; the app provider stack |

### Rule

`PeekHost` wraps the routed tree once in the app's provider stack and owns the mounted peek dialog. A peek label never holds open state and never renders a dialog inline: its trigger calls `peek.open({ render: ({ open, onOpenChange }) => <XPeekDialog … /> })`, and the host mounts that element at the app root. The host is kind-agnostic - the caller supplies the dialog, so a module's own entity peek needs no registration. A dialog left inside the subtree that opened it is unmounted by that subtree's next refetch and closes itself seconds later, which is the defect this replaces. Labels expose no `onPeek` escape hatch: one way in, one mount point.
