> Commonization registry — **Identity, detail fields & user labels**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry — Identity, detail fields & user labels

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

FK fields (ending with `Id`) MUST display the nested object's `.name` instead of the raw UUID. Backend DTOs provide dual fields: `categoryId` (string) + `category` (nested object with `{ id, name }`).

```tsx
// REQUIRED — Nested object name with ID fallback
value={displayData.category?.name ?? String(displayData.categoryId ?? "")}

// FORBIDDEN — Raw UUID display
value={String(displayData.categoryId ?? "")}
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

When a referenced entity name is unavailable, use em-dash `"—"` as fallback, NEVER the raw UUID.

```tsx
// REQUIRED
value={data.parent?.category?.name ?? "—"}

// FORBIDDEN
value={data.parent?.category?.name ?? data.parent?.categoryId}
```

**Exception — picker option labels**: select/picker
OPTION labels may fall back to the id (`item.name ?? item.id ?? ""` — the SearchPopover pattern),
since a picker item must remain identifiable and selectable even when unnamed. Table cells,
detail fields, and headers still follow the em-dash rule above.

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

// On CrudDetail:
auditData?: AuditData;
```

### Features

- **ID display**: UUID last 12 chars, click to copy full ID to clipboard
- **Tooltip**: Radix primitive (no Arrow), `bg-popover` for theme support
- **Date format**: Fixed 24h format `YYYY-MM-DD HH:mm` (locale-independent)
- **Layout**: Single row — ID left, dates right (`ml-auto`)
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

```tsx
// FORBIDDEN — AuditFooter as children (causes width mismatch in dialog and position drift)
<CrudDetail>
  <CrudDetail.Section>...</CrudDetail.Section>
  <CrudDetail.AuditFooter auditData={...} />
</CrudDetail>

// REQUIRED — Use auditData prop on CrudDetail
<CrudDetail auditData={...}>
  <CrudDetail.Section>...</CrudDetail.Section>
</CrudDetail>
```

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

Read-only status/severity detail field. Renders a tone-driven `StatusBadge` inside the standard `DetailFieldWrapper` with the same `EmptyValueBadge` empty fallback as other `DetailFields.*`. Props: `tone` (resolved `StatusTone`), `value` (translated label), `showDot?`, `icon?`, `appearance?`, `badgeSize?` (default `sm`), `fallback?` (string override of the badge). Use this — NOT `DetailBadgeField` (legacy Badge `variants` map) and NOT a hand-built `DetailFieldWrapper` + `LabeledField` + inline `StatusBadge` — whenever a detail view shows an enum/status with a shared tone map.

```tsx
<DetailFields.DetailStatusField tone={memberStatusToTone[v] ?? "neutral"} value={enumLabel("MemberStatus", v)} showDot layout="inline" />
```

### Anti-Pattern

```tsx
// FORBIDDEN — LabeledField/DetailFieldWrapper + inline StatusBadge, or an inert all-"default" DetailBadgeField variants map
<DetailFieldWrapper label={...}><StatusBadge tone={...} label={...} /></DetailFieldWrapper>
// REQUIRED
<DetailFields.DetailStatusField tone={...} value={...} />
```

## User identity labels (UserAvatar / UserLabel / UserHeading / useCurrentUserAvatar)

| Field | Value |
|-------|-------|
| **Components** | `UserAvatar`, `UserLabel`, `UserHeading` |
| **Hooks** | `useCurrentUserAvatar()` |
| **Package** | `@<scope>/<ui-package>` (subpath `./identity`) |
| **Export** | `import { UserAvatar, UserLabel, UserHeading, useCurrentUserAvatar } from "@<scope>/<ui-package>/identity"` |

### Rule

Every render of a user account's display name carries the user's avatar. The public avatar endpoint 404s for users without an uploaded photo, so all avatar rendering goes through these components (they handle the failure fallback to the app default image):

1. **`UserLabel userId name`** — the one inline user label (compact avatar + truncating name) for list columns, card titles, board/panel rows, and dialog lines. Surrounding typography is passed via `className` (and `avatarClassName="size-4"` for caption-size rows).
2. **`UserHeading userId name`** — detail-panel header for person-attributed records (avatar + muted level-4 `Heading`). Replaces a bare `Heading level={4} tone="muted"` titled by a person's name.
3. **`UserAvatar userId name`** — avatar only, when the name renders elsewhere (dialog titles, custom compositions).
4. **`useCurrentUserAvatar()`** — the signed-in user's `{ userId, version, avatarUrl }` (cache-busted by the avatar attachment id). The ONLY way to render the current user's avatar; never re-implement the auth + avatar-query + URL assembly inline.

Calendar/gantt resources get avatars centrally via the shared calendar adapters (`avatarUrl` + `avatarFallbackUrl` on `CalendarResource`) — never per-screen.

### Standard Usage

```tsx
<CrudList.Column<RowDTO> field="userAccountId" header={fieldLabel("userAccountId")}>
  {({ row }) => (row.userAccountId ? <UserLabel userId={String(row.userAccountId)} name={nameOf(String(row.userAccountId))} /> : "")}
</CrudList.Column>

const header = onClose ? <UserHeading userId={String(data.userAccountId ?? "")} name={nameOf(String(data.userAccountId ?? ""))} /> : undefined;
```

### Anti-Pattern

```tsx
// FORBIDDEN — bare text render of a user name where the user id is in scope
{({ row }) => nameOf(String(row.userAccountId ?? ""))}
// FORBIDDEN — hand-built <img> against the avatar endpoint (no 404 fallback, no cache-busting contract)
<img src={`/api/v1/public/user/${id}-avatar-sm.png`} />
// FORBIDDEN — module-local re-implementation of the current-user avatar assembly
const url = userId && avatar?.attachmentId ? getUserAvatarUrl(userId, { size: "sm", version: avatar.attachmentId }) : DEFAULT_USER_AVATAR_URL;
```

## PeekTriggerButton (cross-detail peek trigger)

| Field | Value |
|-------|-------|
| **Component** | `PeekTriggerButton` (`@<scope>/<ui-package>/layout`) |
| **Scope** | Any trigger that opens a `DetailPeekDialog` |

### Rule

A cross-detail reference opens the referenced record in a `DetailPeekDialog`; its trigger is always `PeekTriggerButton`, never a hand-rolled `<Button>` with a `stopPropagation` closure. Two forms via the `appearance` prop, and **one question decides which: is it inside a card?** A card gets `"inline"` (outline button carrying the label and the icon), because the trigger is the only action in its region and has no value beside it to crowd. **Everywhere else takes the default `"icon"`** (icon-only ghost button, label as tooltip and accessible name) — `DetailFieldWrapper`, `CrudList.Column`, `DetailListRow`, a `CrudDetail.Section` header `trailing` slot, and a detail footer action row. Do not widen the test to 「beside a labelled value」: a bordered button at the end of a two-column detail row eats the width its own value needs, so the name the row exists to show truncates while the control that opens it stays whole. A separate `tight` prop decides whether the control hugs the value in front of it; it defaults to the shape (`"icon"` hugs, `"inline"` does not) and is overridden only for an icon in a trailing slot, where nothing precedes it. Every trigger passes `target` — what it opens, as a person reads it — and an icon-only one must: with the label gone, `aria-label` is all a screen reader has, and one panel holds several triggers whose label is the same word. The name becomes 「남부현장 보기」 rather than the fourth 「보기」 on the screen. Both draw the external-link icon — the dialog is a window onto another record, and an eye says 「read-only」, which is a different promise — and both stop row-click propagation. A module-local icon-only peek button is a duplicate — use `appearance="icon"`.

## usePeekTarget (peek open/close state machine)

| Field | Value |
|-------|-------|
| **Hook** | `usePeekTarget<T = true>()` (`@<scope>/<ui-package>/layout`) |
| **Scope** | A one-off `DetailPeekDialog` trigger that is not a reusable reference label |

### Rule

The open/close state a widget-root `DetailPeekDialog` needs comes from `usePeekTarget`, never a hand-rolled `useState(false)` + manual `onOpenChange` closure. It returns `{ target, isOpen, open, close, onOpenChange }`: a boolean single-target peek uses the default `T` (`open()` / `isOpen`); a nullable multi-kind peek passes a target object (`open({ kind, id, title })`) and reads `target?.kind` at the mount gate. Wire `open={peek.isOpen}` and `onOpenChange={peek.onOpenChange}` straight through. Label lookup and `goToHref` assembly stay with the caller (domain- and i18n-scoped).

**A reference label does NOT use this hook** — `*PeekLabel` components dispatch to the app-root peek host (`usePeekHost`, registry entry below), so the dialog mounts outside the row. Reach for `usePeekTarget` only when the trigger is screen-specific and its state already sits outside every cell and `.map()` callback (invariant #45).

## usePeekHost / PeekHost (app-root peek mounting)

| Field | Value |
|-------|-------|
| **Hook / Component** | `usePeekHost()` · `PeekHost` (`@<scope>/<ui-package>/peek`) |
| **Scope** | Every reusable `*PeekLabel`; the app provider stack |

### Rule

`PeekHost` wraps the routed tree once in the app's provider stack and owns the mounted peek dialog. A peek label never holds open state and never renders a dialog inline: its trigger calls `peek.open({ render: ({ open, onOpenChange }) => <XPeekDialog … /> })`, and the host mounts that element at the app root. The host is kind-agnostic — the caller supplies the dialog, so a module's own entity peek needs no registration. A dialog left inside the subtree that opened it is unmounted by that subtree's next refetch and closes itself seconds later, which is the defect this replaces. Labels expose no `onPeek` escape hatch: one way in, one mount point.
