# Date/Time Fields — Encoding, Decoding, Display Timezone

Rules for every widget, form, and filter that reads or writes a temporal value. Deployments span sites in different timezones, and the operator's browser is often NOT on the site's clock — no stored value may depend on where the operator happens to sit. This file is self-contained: the rules below are complete for frontend work.

## Semantic kinds (decide first)

Every temporal field is exactly ONE of these kinds. The kind decides how you encode, decode, and display it.

| Kind | Meaning | JSON on the wire | OpenAPI hint |
|---|---|---|---|
| **Absolute instant** | One global point in time — the same moment in every zone | RFC 3339 with offset (`2026-08-15T09:00:00+09:00`) | `format: date-time` |
| **Calendar date** | "That date" — zone-free until combined with a timezone | bare `2026-08-15` | `format: date` |
| **Wall-clock time** | "That time of day" — recurs daily, zone-free | `09:00` / `09:00:00` | `format: partial-time` |

The generated types and `format` hints tell you the kind. When ambiguous, ask: do two sites in different timezones need the same **moment** (→ absolute instant) or the same **printed date/time** (→ calendar date / wall-clock time)?

**A field's kind can change, and codegen alone will not catch it.** `pnpm codegen` only rewrites `src/generated/`; it never touches hand-written widgets. When a backend field is reclassified (e.g. `Instant` → `LocalTime` or `String` → `LocalDate`), the TypeScript type often stays `string`, so `tsc` passes and the field-name snapshot diff shows nothing — yet the form now renders the wrong picker (a date picker for a time-of-day, a text box for a calendar date) and a range filter serializes the wrong wire shape. After any temporal reclassification, re-audit every hand-written form / detail / list / filter for that field **by its OpenAPI `format`**, not by whether the code compiles.

## Encoding (writing to the API)

1. **Calendar date → bare `yyyy-MM-dd`.** Serialize with the framework `serializeCalendarDate` (string) or `asPlainDate` (a tagged `Date` whose `toJSON` emits the bare date). NEVER serialize a picked date as local midnight plus an offset (`2026-08-15T00:00:00+09:00`) OR as a UTC-midnight datetime (`2026-08-15T00:00:00Z`): both are the same defect — read in another zone the string designates a different date, and a UTC-midnight datetime sent to a `format:date` column shifts a day for any app zone at or west of UTC (it only "works" east of UTC). This applies to EVERY calendar-date field, not just policy dates — a person's birth/hire/termination date is a calendar date. A hand-rolled UTC-midnight encoder for date-carrying fields is banned; there is no such helper in the shared UI package.
2. **Absolute instant on a site-scoped field** (validity windows, visit schedules, access-level activation) → build the instant **from the site timezone**: interpret the picked wall-clock value in the site's IANA timezone (the site API's `timezone` field), then emit RFC 3339 with that offset. The operator's browser zone must never change the stored instant — two admins in Seoul and LA saving "8/15 09:00" for the same site must produce the same value.
3. **Absolute instant anchored to "now"** (client-side timestamps) → any offset denotes the same instant; the browser offset is acceptable.
4. **Wall-clock time → `HH:mm[:ss]`** exactly as picked. No date, no offset.
5. **Inclusive end dates: send what the user picked.** The exclusive-boundary conversion (+1 day for date windows, −1 minute for schedule ends) is the server's contract — never pre-shift on the client. A client-side shift double-applies the moment the server implements its side.

## Decoding (reading API values into pickers and cells)

1. **Calendar date / wall-clock time → parse the string's own components** (split `2026-08-15` / `09:00` textually). NEVER pass a bare date into `new Date(...)` and read it back through local getters (`getFullYear`/`getMonth`/`getDate`) — local re-interpretation shows a different date to viewers in other zones, and an edit round-trip (open form → save) then silently shifts the stored value by a day.
2. **Absolute instant → parse as an instant, then convert to an explicit display zone** (site timezone on site-scoped screens; the user's preference elsewhere). Never rely on the implicit browser zone for site-scoped fields.

## Display & filters

1. **Site-scoped screens render times in the site timezone and label it** (e.g. "사이트 시간 · Asia/Seoul"). An unlabeled time on a multi-zone deployment is ambiguous data.
2. **Date-range filters over site-scoped data**: convert the picked from/to dates to instants at the **site timezone's** day boundaries and send offset-carrying values. Browser-zone boundaries filter a different day than the site's — up to a full day of rows appears or disappears depending on where the operator sits.
3. **Never format a temporal value inline in a widget.** `formatDateTime(new Date(x), …)` / `formatDateMedium(new Date(x), …)` in a list cell, card, caption, or field is a defect — the `new Date(x)` + locale + zone plumbing is repeated per call and drifts, and `new Date()` on a bare date shifts it by a viewer's offset. Render through the framework display components (next section); those components wrap the formatters, so the raw formatters never appear in a widget. A raw ISO string reaching the user is a machine value leaking through (invariant #36).

## Display by kind (detail · list cell · card · caption)

Render every temporal value through a framework display component from `@simplix-react/ui`. The component follows the semantic kind; the framework owns the zone math.

| Kind | Detail field row | Inline text (cell · card · caption) | List column (declarative) |
|---|---|---|---|
| Calendar date (`LocalDate`) | `DetailDateField format="date"` | `CalendarDateText` | `CrudList.Column format="date"` |
| Wall-clock time (`LocalTime`) | `DetailDateField format="time"` | `WallClockText` | cell render with `WallClockText` |
| Absolute instant → datetime | `DetailDateField format="datetime" displayZone={z}` | `InstantText displayZone={z}` | `CrudList.Column format="datetime" displayZone={z}` |
| Absolute instant → shown as its zone-local date | `DetailFieldWrapper` + `InstantText displayZone={z} format="date"` | `InstantText displayZone={z} format="date"` | cell render with `InstantText … format="date"` |

- `DetailDateField format="date"` and `CrudList.Column format="date"` are **zone-neutral** (they ignore `displayZone`) — correct for a `LocalDate`, WRONG for an `Instant` you want printed as a zone-local date (they fall back to the browser zone). `InstantText … format="date"` is the ONLY display component that renders an instant's date part in an explicit zone; use it whenever a backend `Instant` is shown date-only.
- Use the declarative `CrudList.Column format=…` when the cell is just the field value with an empty blank. Drop to a cell render with `InstantText` / `CalendarDateText` (with `fallback`) when the column needs custom empty text, a per-row zone (`displayZone` also accepts `(row) => zone`), or an instant-as-date. In a cell render, read the typed value from `row.<field>`, not the untyped `value` argument.
- The bare `datePart(x)` (from `@simplix-react/calendar`) is a valid string-returning renderer for a `LocalDate` where a string (not a node) is required — e.g. a `DetailTextField value` or a `t()` interpolation. Prefer `CalendarDateText` where a node is acceptable.

## Form input & encoding by kind

The picker follows the semantic kind. The framework owns the zone math — never hand-roll `toISOString()` on a picker value.

1. **Calendar date** — form: `FormFields.DateField` + `serializeCalendarDate` on submit, `parseDate` / `decodeCalendarDate` on load.
2. **Wall-clock time** — form: `FormFields.TimeField` + the shared `parseLocalTime` / `formatLocalTime` pair (`@<scope>/<ui-package>/date`), seeded with a concrete default (`|| "00:00"`).
3. **Site-scoped absolute instant** — form: `FormFields.DateTimeField displayZone={siteZone} displayZoneLabel={…}`; its `onChange` yields a zone-tagged `Date` — store `serializeInstant(v, siteZone)`, NEVER `v.toISOString()` (which stamps the browser offset). Resolve `siteZone` from the record's site via `useSiteTimeZones().zoneOf(siteId)`, falling back to `useAppTimeZone()` until the site (or its zone) is known. In a list, pass the SAME zone to the column / `InstantText` `displayZone`, the date-range filter `displayZone`, and the detail — one zone per row (`displayZone={(row) => zoneOf(row.siteId) ?? appZone}`) — so the cell, filter, and detail all read the same time. A cell on the browser zone while filter/detail use the site zone is a defect: the field then reads three different times.
4. **App-anchored instant (non-site-scoped)** — a globally-synced record with no single site (e.g. a schedule activation time) anchors to `useAppTimeZone()` and labels it; there is no site to resolve. A "now"-stamped instant (a punch, a client timestamp) may use the browser offset — any offset denotes the same moment.

## Verification greps

Run over `modules/` and non-generated `packages/` sources; every hit outside the framework's encoding primitives is a suspect:

```bash
# local-zone encoding / decoding
grep -rn "getTimezoneOffset\|toISOString" --include="*.ts" --include="*.tsx" . | grep -v generated

# bare-date strings re-interpreted through the local clock
grep -rn "new Date(" --include="*.tsx" . | grep -v generated

# inline date formatting in a widget — render through a display component instead
# (InstantText / CalendarDateText / WallClockText / DetailDateField / CrudList.Column format)
grep -rn "formatDateTime(\|formatDateMedium(" --include="*.tsx" modules | grep -v generated
```
