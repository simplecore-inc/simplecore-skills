> **CUSTOMIZE** category reference inside this skill. Loaded via the Task Router when a task tidies or normalizes an existing CRUD page — trimming a list, reshaping a detail panel, laying out a summary card, or aligning one screen with its siblings. Sibling files: `overview.md`, `framework-components.md`, `recipes.md`, `columns/overview.md`, `filters/overview.md`. This is the row-by-row layout standard the post-scaffold customization in `overview.md` § 2 finishes with.

# CRUD Page Consistency Checklist

The layout standard a CRUD page is normalized to after it is scaffolded and wired. Every rule here is a `→` directive: **review question → action**. Walk the four sections in order (List → Detail → Cards & embedded blocks → Cross-cutting); each renders through framework primitives only (invariant #8) and reuses the shared component before a local one (invariant #9, #22).

Placeholders: `<Entity>` / `<entity>` (the PascalCase / camelCase entity name), `<domain>` (the domain package), `<EnumType>` (a boot-enum type). Concrete names come from the codebase, never from this document.

---

## 1. List (`CrudList`)

### Columns to remove or hide

- **A descriptive or long-text column is in the list?** → drop it from the list; a description / body / note belongs on the detail panel, not in a row. (`display` order category "Description" is list-optional, not list-default — invariant #18.)
- **A machine identifier is shown as a column?** → hide it. Raw ids (record UUIDs, credential ids, hardware GUIDs, permission ids), and any FK surfaced as its raw id, stay hidden; the row is identified by a human value (code / name), not a key.
- **A boolean spreads a wide column?** → give it a `width` and place it in the Attributes group in table-column order (invariant #18). With a `width` set, the header auto-truncates and shows a tooltip — no manual handling.

### Cell rendering & alignment

- **`CrudList.Column` has no `align` prop** → apply alignment inside the cell render (invariant #20): fixed-length codes, booleans, and bounded numerics center via `<Flex justify="center">`; long text stays left; unbounded numbers go right.

```tsx
<CrudList.Column<Entity> field="checkedInAt" header={fieldLabel("checkedInAt")} width={180} sortable>
  {({ row }) => (
    <Flex justify="center">
      <InstantText value={row.checkedInAt} displayZone={zone} format="datetime" fallback="-" />
    </Flex>
  )}
</CrudList.Column>
```

- **Badges in a column render at uneven widths?** → give the shared status badge a uniform minimum width so the column reads as a stack, not a ragged edge (the shared `StatusBadge` carries a `min-w` floor; do not re-fix per cell).
- **A cell references a person or actor?** → render it through the shared identity label (avatar + name + peek trigger), not a bare name string. A label that already shows an avatar must not be wrapped by another avatar row — opt out of the inner one (`showAvatar={false}`) so a cell never shows two.

### Peek & links from a cell — invariant #45

- **A cell references another record?** → render the shared `*PeekLabel` and pass nothing else. The label dispatches to the app-root peek host, which mounts the dialog outside the row; the screen holds no peek state and renders no dialog of its own. A dialog left in the cell is unmounted by the next refetch and closes itself seconds after opening.

```tsx
// in a cell — that is the whole wiring
<UserPeekLabel userId={id} name={name} />
```

- **Adding a peek label for a new entity?** → export its dialog separately and dispatch from the trigger; the host takes any dialog, so nothing is registered per kind.

```tsx
const peek = usePeekHost();
<PeekTriggerButton
  label={t("peek.view")}
  onClick={() => peek.open({
    render: ({ open, onOpenChange }) => <XPeekDialog open={open} onOpenChange={onOpenChange} xId={id} name={name} />,
  })}
/>
```

- **Column order** → Drag > Select > Identifier(hidden) > Relations(hidden) > Type > Text > Description > Attributes > Metrics > Schedule > Audit(hidden) > Actions (invariant #18 — mandatory, not aesthetic).
- **Filter bar** → `maxBadges={3}` on every FilterBar touched (invariant #13); boolean → `type: "toggle"` (#14). Full rules → `filters/overview.md`.

---

## 2. Detail (`CrudDetail`)

### Section grouping — divide the panel, never one flat list

- **More than a handful of fields, or fields spanning distinct concerns?** → split the panel into several titled `CrudDetail.Section`s grouped by concern (identity / basics, rules / config, schedule / period, status / history), NOT one section with a dozen rows. A single catch-all section is a defect even when every row is individually correct — the reader gets no structure. **Group into sections first, then apply two-column layout within each section** — two-column on one giant section is only half the job.
- Name each section from the domain vocabulary (e.g. "기본 정보", "부여 규칙", "촉진 기준", "통보 이력"). A scaffold's single default section is the starting point, not the final shape, and sibling screens of the same entity family share the same section decomposition.
- Order sections by reading priority: who/what it is → its rules/config → its schedule → its status/timestamps. Conditional or rarely-present groups (compliance holds, response history) come last.

### Section layout

- **A run of short scalar pairs?** → group them in `CrudDetail.Section layout="two-column"` (the framework lays them out as a two-column grid with a divider); a panel that stacks one short value per line runs off-screen before it runs out of fields.
- **Only genuinely paired short scalars go two-column** → a long value, an identifier, or a descriptive block takes the **full width**, in its own single-column section. Do not force a block value into a half column.
- **A descriptive / multi-line value (description, note, reasons)?** → render it with `DetailFields.DetailBlockField` in a **separate full-width section** whose title is the field label — never inside the two-column area, where it wraps into a lopsided stack.

```tsx
<CrudDetail.Section title={t("<entity>.sectionMain")} variant="flat" layout="two-column">
  <DetailFields.DetailTextField label={fieldLabel("code")} value={String(data.code ?? "")} layout="inline" />
  <DetailFieldWrapper label={fieldLabel("active")} layout="inline"><BooleanBadge value={!!data.active} /></DetailFieldWrapper>
</CrudDetail.Section>

{data.description ? (
  <CrudDetail.Section title={fieldLabel("description")} variant="flat" className="pt-3">
    <DetailFields.DetailBlockField value={String(data.description)} />
  </CrudDetail.Section>
) : null}
```

### Section separation & spacing

- **A second (or later) section needs separating?** → a `variant="flat"` section already draws its own boundary; add `className="pt-3"` for breathing room. Do **not** stack an extra `border-t` on a section that already draws a rule — that yields a double line.
- **A titleless block sits raw in the panel (not a `CrudDetail.Section`)?** → give it a divider + spacing + section title with `className="mt-3 border-t pt-3"`.

### Embedded record lists

- **The detail embeds a list of sub-records (assignment history, declared items, vehicles, rule items, scope targets)?** → render it as a bordered `DetailList`, one row per record, each row `border-b px-4 py-2 last:border-b-0`, and each row links out (peek) to its own page. This is the standard "card-style list", distinct from a two-column field grid.
- **The component AND the row class are the contract — visual resemblance is not conformance.** A block that *already looks like* a bordered list but is a hand-rolled `Stack` / `Flex` with `border-b border-border/50`, `py-1.5`, or any ad-hoc padding is **NOT compliant** and must be converted to `DetailList` + the exact `border-b px-4 py-2 last:border-b-0` row class — do not pass it over as "already a bordered list" and touch only its spacing. Every embedded record list on the panel renders through the same `DetailList`, so two lists on sibling screens (or two in one panel) never diverge in padding or divider tone. Grep the panel for `border-b` rows outside a `DetailList` before declaring the pass done.

### Referenced records link out — every FK is navigable

- **A field holds a reference to another record (an FK, or an id resolved to a name — user, site, org, policy, device, category)?** → it is NOT plain text. Render it as a peek link to that record, the same as a list cell does. Resolving the id to a name and printing it through `DetailTextField` is a defect: every reference the screen shows must be navigable to the referenced record. This holds on **every** surface — detail rows, card facts, embedded list rows — not just list columns.
- Use the shared label for the entity where one exists (`UserPeekLabel` for a user account; a domain `*PeekLabel` for a domain entity). Where none exists yet, **build one shared component** (module `shared/ui` for a single-module entity; the project UI package for a cross-module one) — a per-screen inline `usePeekTarget` + `DetailPeekDialog` copy is the thing you extract, not the thing you ship (invariant #23). The first screen that needs a new entity's peek creates its `*PeekLabel`; the rest import it.
- Every surface uses the same label with the same wiring — the peek host mounts the dialog, so a detail row, a card fact, and a list cell are written identically (invariant #45).
- **Sweep the panel before declaring done**: any `fieldLabel(...Id)` row whose value is a resolved name rendered as text (`nameOf(...)`, `*Name(...)`, `DetailTextField value={...Name}`) is an un-linked reference — convert it.

### Dates and times are never formatted inline

- **A temporal value rendered anywhere on the screen?** → it goes through the shared date components, never a hand-rolled string. Formatting inline — `formatDateTime(new Date(x), …)`, `datePart(String(x))`, `String(x).slice(0, 5)`, `toLocaleDateString()` — is a defect on every surface (list cell, card, detail row, dialog, caption). Pick by semantic kind (invariant #42):

| Kind | Field row (detail) | Inline (cell / card / dialog / caption) |
| --- | --- | --- |
| Absolute instant (RFC 3339) | `DetailDateField format="datetime"` + `displayZone` | `<InstantText value={x} displayZone={zone} />` |
| Calendar date (bare `yyyy-MM-dd`) | `DetailDateField format="date"` | `<CalendarDateText value={x} />` |
| Wall-clock time (`HH:mm[:ss]`) | `DetailFieldWrapper` + `WallClockText` | `<WallClockText value={x} />` |

- **Why it matters beyond consistency**: a hand-rolled formatter silently drops the viewer's locale (`formatDateTime(d, undefined, zone)` renders one fixed locale for everyone), and `slice(0, 5)` / `datePart` bypass locale ordering entirely. The components read the active locale and the explicit display zone, so the same value reads correctly for every viewer.
- **Fallbacks belong to the component** — `<CalendarDateText value={x} fallback={t("...openEnded")} />` instead of a ternary that formats one branch and prints a label in the other.
- **Legitimate non-display uses stay** — `datePart()` producing a bare `yyyy-MM-dd` for a **form prefill value** or for a **date comparison** is data, not display; keep it and let the rendered output go through a component. Everything a user reads is a component.
- **Sweep before declaring done**: grep the touched module for `datePart(`, `slice(0, 5)`, `formatDateTime(`, `toLocale`; every remaining hit must be a prefill or a comparison, never something rendered.

### Field rows

- **A label–value row** → `DetailFieldWrapper layout="trailing"` puts the label left and the value at the right edge with a blank gap between (no leader rule).
- **A nullable enum row?** → render it with `DetailFields.DetailBadgeField` (`value={resolveBootEnum(x) || null}` + `displayValue` + the module variant map), never a bare module badge shell inside a `DetailFieldWrapper` — the shell returns `null` for an absent value and leaves a silently blank row while sibling rows show the shared no-value badge.
- **Badge size** → omit `size` on detail badges so they match the list (invariant #43); never enlarge a detail/form badge.
- **Custom-rendered value?** → `DetailTextField` has no `children`; compose the value inside a `DetailFieldWrapper` (invariant #44).
- **Audit footer** → pass the panel's `displayZone` (the site zone for site-scoped screens); stamps render locale-aware in that zone (invariant #42).

---

## 2b. A screen with no list beside it — the width is the whole page

Everything in §2 is written for a panel: `CrudDetail` inside `ListDetail.Detail`, a few hundred
pixels wide, where one field per line is the failure mode the two-column rule exists to prevent. A
screen with **no list beside it** — an account settings page, a single-record editor, a preferences
tab, a wizard step — has no panel to be narrow. Its content gets the page, and that is the trap: at
1440px a stack of short fields draws each input a thousand pixels wide for a value of twenty
characters, and the reader's eye travels the whole width to find the next label.

- **Content or a form filling the page width?** → give it columns. Short scalar fields go
  two-to-a-row (`<Grid columns={2} gapX="lg">`, or `FormFields` inside a two-column grid), exactly
  as a panel's `layout="two-column"` does. The rule is the same rule; only the container changed.
- **Which fields pair and which do not** is decided as in §2 — short scalars pair, a long text
  value, a descriptive block, or a table takes the full width in its own row.
- **Cap the measure rather than letting it run.** A form that has genuinely one column of content
  still does not want the whole viewport: constrain it (`Container size="md"`, a `max-w-*`) so a
  line length stays readable.
- **The check is the viewport, not the component.** Ask what this content is next to. Nothing to
  its left or right means the page width is its width, and a single column is a decision rather
  than a default.

**Judge by the rendered input, never by the component name.** A screen that never imports
`FormFields`, `TextField` or `SelectField` is still a form when it draws `<Label>` + `<Input>`
pairs or a bare `<select>`, and a survey that counts framework component names walks straight past
it — the one screen most likely to be laid out wrong is the one that was written by hand, which is
the same screen the survey cannot see. Count the input controls themselves: `<input>`, `<select>`,
`<textarea>`, and the framework fields alike.

---

## 3. Cards & embedded blocks

- **A card component (`variant="card"`) — is it the right owner?** → the card treatment is for a summary of **another** record referenced by this screen. A record's own primary information stays **flat** (a plain section), never wrapped in a card of itself.
- **Facts inside a card?** → lay them two-to-a-row as well (`<Grid columns={2} gapX="lg" divider>`), matching the detail's two-column density; one fact per line pushes the card past the fold on a panel-width surface.
- **A full-width fact belongs with a card's two-column facts (e.g. check-in / check-out instants)?** → render it **after the two-column grid closes**, not inside it — a timestamp read next to an unrelated column reads as a value of that column. Expose a dedicated slot (e.g. `trailingFacts`) rather than smuggling it into the grid.
- **Action buttons on a card / panel footer?** → make them fill the width evenly (`[&>*]:flex-1`, or equal `w-` classes), not a ragged left-packed row.
- **Two sibling sub-blocks in one card (e.g. items and vehicles)?** → separate them with a rule **only when both render** — put `border-t pt-3` on the second block, gated on the first being present, so a lone block never carries a dangling line.

---

## 4. Cross-cutting

- **Every referenced record links out (detail rows included, not just list cells)** → see Detail § "Referenced records link out". A resolved FK printed as plain text is a defect on any surface.
- **External-link / peek placement** → the link icon follows the identity it belongs to (immediately after the label + its status badge), not at the far end of the row after the action buttons.
- **Peek dialog title** → carry the record's larger avatar in the dialog title; drop a duplicate avatar from the body's first row.
- **Page chrome** → title/description via `usePageHeader`, create action in its `actions` slot, no ad-hoc page-root padding, panel list-detail renders the `Stack flex` root directly (invariant #31).
- **Backend-sync gate** → if the OpenAPI spec moved since the last codegen, run the SCAFFOLD Update path FIRST (invariant #29) — even a "just a column" tidy is blocked on stale `generated/`.
- **After the pass** → run AUDIT (`../audit/overview.md`) — any pattern this normalization repeats across modules is extracted to the shared package (invariant #22, #23), never left inlined.

---

## Framework-source changes belong upstream

Several of these standards are enforced by the framework components themselves (the two-column section divider, the trailing row's label/value split, the badge width floor, the audit footer's zone-aware stamp). When a rule needs a change to shared behavior rather than a per-screen workaround, edit the framework/shared package source and rebuild its `dist` before typecheck — a per-module reimplementation of a shared layout is a defect (invariant #9, #23).
