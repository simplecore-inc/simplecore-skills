> Commonization registry — **Status tones, badges & flash**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.

# Registry — Status tones, badges & flash

## Status Tone System (STATUS_TONES + StatusBadge + StatusDot)

| Field | Value |
|-------|-------|
| **Components** | `STATUS_TONES`, `StatusBadge`, `StatusDot` |
| **Package** | `@simplix-react/ui` |
| **Source** | `base/status-tone.ts`, `base/display/status-badge.tsx`, `base/display/status-dot.tsx` |

### Rule

Status / severity coloring is centralized in `STATUS_TONES` — a single table of 7 semantic tones (`success | warning | danger | info | neutral | pending | processing`), each bundling dark-inclusive class strings for every slot (`badge`, `outline`, `dot`, `ring`, `icon`, `surface`, `chart`, `chartDark`). NEVER hand-write enum→Tailwind-color maps in a module. Render status pills/dots with `StatusBadge` / `StatusDot`; map a domain enum to a tone via the shared `@<scope>/<ui-package>` maps (see below). `icon` props are typed structurally (`IconComponent`) so any `lucide-react` version is accepted.

### Standard Usage

```tsx
import { StatusBadge, StatusDot } from "@simplix-react/ui";
import { severityToTone } from "@<scope>/<ui-package>/status";

<StatusBadge tone={severityToTone[value] ?? "neutral"} showDot label={enumLabel("EventSeverity", value)} />
<StatusDot tone="success" animation="ping" /> // LIVE indicator
```

### Anti-Pattern

```tsx
// FORBIDDEN — inline enum→color map with hand-written dark: classes
const severityConfig = { CRITICAL: { dot: "bg-red-500", badge: "bg-red-100 dark:bg-red-900 ..." }, ... };
<Badge variant="outline" className={severityConfig[v].badge}><span className={cn("size-1.5 rounded-full", severityConfig[v].dot)} />{label}</Badge>

// REQUIRED — tone token + StatusBadge + shared map
<StatusBadge tone={eventSeverityToTone[v] ?? "neutral"} showDot label={label} />
```

## Domain enum→tone maps (@<scope>/<ui-package>)

| Field | Value |
|-------|-------|
| **Maps** | `severityToTone`, `connectionStateToTone`, `channelStatusToTone`, `syncStatusToTone`, `circuitStateToTone`, `syncDeliveryStatusToTone`, `activityActionToTone`, `controllerHealthToTone` (`./status`); `eventSeverityToTone`, `eventActionToTone` (`./event`); `memberStatusToTone`, `credentialStatusToTone` (`./identity`) |
| **Package** | `@<scope>/<ui-package>` (subpaths `./status`, `./event`, `./identity`) |

### Rule

Each domain status enum has exactly ONE tone map, defined once in `@<scope>/<ui-package>`. Modules import the map; they do not redefine it. Maps carry NO display text (`t()` stays in the widget); icon-bearing maps (`controllerHealthToTone`, `eventActionToTone`) pair the tone with a `lucide-react` icon (+ optional `pulse`). Categorical (non-status) palettes — `CATEGORY_COLORS`, `CARD_FORMAT_TYPE_COLORS`, `VENDOR_TYPE_COLORS`, `LED_COLOR_MAP`, `TYPE_ICONS`, `MODE_VARIANTS` — are intentionally NOT tone maps and stay domain-local.

## AlertBanner

| Field | Value |
|-------|-------|
| **Component** | `AlertBanner` |
| **Package** | `@simplix-react/ui` |
| **Source** | `base/feedback/alert-banner.tsx` |

### Rule

Tone-tinted inline notice box (icon + title/subtitle/children + optional trailing). `tone` (StatusTone), `density` (`default | sm | hint`). Replaces hand-written `rounded-md border bg-{tone}-50 dark:...` boxes and the former module-local `AlarmCallout` / `InfoHint` / `WarningHint`.

### Anti-Pattern

```tsx
// FORBIDDEN — inline tone box
<Flex className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
  <AlertTriangleIcon className="text-red-500" /> <span className="text-red-700 dark:text-red-400">{msg}</span>
</Flex>
// REQUIRED
<AlertBanner tone="danger" density="sm" icon={AlertTriangleIcon} title={msg} />
```

## StatCard tone / highlighted

| Field | Value |
|-------|-------|
| **Component** | `StatCard` (extended) |
| **Package** | `@simplix-react/ui` |
| **Source** | `base/charts/stat-card.tsx` |

### Rule

Conditional surface tint is expressed via `tone?: StatusTone` + `highlighted?: boolean`, NOT a call-site `className` ternary. `highlighted && tone` applies the tone's `surface` token; otherwise `bg-card`.

```tsx
// FORBIDDEN: className={cond ? "border-emerald-200 bg-emerald-50/50 dark:..." : undefined}
// REQUIRED:  tone="success" highlighted={cond}
```

## theme.css status-flash / live-flash keyframes

| Field | Value |
|-------|-------|
| **Tokens** | `--animate-status-flash` (`status-flash 0.9s ease-out`), live-flash keyframes |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/theme.css` |

### Rule

Status flash animation lives in the framework `theme.css` (`@keyframes status-flash` / live-flash) and is consumed via `StatusDot animation="flash"` (and `animation="ping"` for the live indicator). Modules must NOT hand-write `animate-[ping_3s...]` or bespoke flash keyframes — drive the one-shot flash/ping through the `StatusDot` `animation` prop so timing stays centralized. See [[Status Tone System (STATUS_TONES + StatusBadge + StatusDot)]].

## ColorDot (arbitrary-hex color swatch)

| Field | Value |
|-------|-------|
| **Component** | `ColorDot` |
| **Package** | `@simplix-react/ui` |
| **Source** | `simplix-react/packages/ui/src/base/display/color-dot.tsx` |

### Rule

Small circular swatch filled with an arbitrary CSS color (props: `color`, `size?: "xs"|"sm"|"md"`, `className`). For DATA-DRIVEN / user-defined colors where the tone-based `StatusDot` does not apply (e.g. a holiday-type palette). Replaces hand-written `<span className="size-3 rounded-full" style={{ backgroundColor }} />`. `ColorDot` renders no children — if the swatch must also contain a glyph/index digit, keep a justified raw `<span>` with a `{/* raw layout: ... */}` note.

## New domain tone maps (extension)

| Field | Value |
|-------|-------|
| **Maps / fn** | `commandTypeToTone`, `resolveSyncResultStatusTone` (`@<scope>/<ui-package>/status`); `configChangeActionToTone`, `diffChangeToTone` (`@<scope>/<ui-package>/event`) |
| **Source** | `packages/<ui-package>/src/status/tones.ts`, `packages/<ui-package>/src/event/event-tones.ts` |

### Rule

Extends the [[Domain enum→tone maps (@<scope>/<ui-package>)]] set:
- `commandTypeToTone` — sync `SyncCommandType` → `{ tone, icon }` (icon-bearing, like `eventActionToTone`): `PARTIAL_UPDATE`→info/RefreshCw, `FULL_DOWNLOAD`→warning/Download.
- `resolveSyncResultStatusTone(value)` — a FUNCTION (not a Record map) because the backend types `resultStatus` as a free-form `string`; keyword-derived (`COMPLETED`/`ACKNOWLEDGED`→success, `FAILED`/`TIMEOUT`→danger, else neutral). The function form is the sanctioned exception to the "plain Record map" convention for free-form string fields.
- `configChangeActionToTone` — `ConfigChangeAction` → `StatusTone` (INSERT→success, UPDATE→info, DELETE→danger, SYNC_EXECUTE→processing, FULL_DOWNLOAD→neutral).
- `diffChangeToTone` — `{ added: "success", removed: "danger" }` for bit/field diff direction.

Modules import these; they do NOT redefine them. Adopted in sync-delivery-detail, audit-log/detail, event/detail-sections. See [[Status Tone System (STATUS_TONES + StatusBadge + StatusDot)]].

## Seed-driven tone classes (toneSlotClass + STATUS_TONE_CLASS_OVERRIDE)

| Field | Value |
|-------|-------|
| **Helpers** | `toneSlotClass(tone, slot)`, `STATUS_TONE_CLASS_OVERRIDE` |
| **Package** | `@<scope>/<ui-package>` (subpath `./status`) |
| **CSS** | app `styles/tones.css` (authored `.tone-<name>` / `.tsf-<slot>` classes) + `--tone-*` seeds in the app theme (`:root` + `.dark`) |

### Rule

Each status tone is painted from ONE seed CSS variable (`--tone-<name>`). The authored classes in `tones.css` derive every slot — `fg` (icon/text), `dot`, `badge` (icon disc / filled), `outline`, `surface` (strong tint), `soft` (resting tint), `border` (tinted border only) — from that seed via `color-mix` against `--card` / `--foreground`, so one color decides a tone's whole look and adapts to light/dark + color-variant themes. Build a slot's class string with `toneSlotClass(tone, slot)`; NEVER read `STATUS_TONES[tone].<slot>` for a Tailwind class in a widget (that bypasses the seed). `STATUS_TONE_CLASS_OVERRIDE` is passed once to `UIProvider`'s `statusTones` at the app root so every `useStatusTones()` consumer (`StatusBadge`, `StatusDot`, `StatCard`, `AlertBanner`) paints from the same seed. Chart consumers still read `STATUS_TONES[tone].chart` (literal hex). `StatusCard` always tints its surface: `active` → `surface` (strong), resting → `soft`. See [[Status Tone System (STATUS_TONES + StatusBadge + StatusDot)]] and [[StatCard tone / highlighted]].

**Categorical accents (entity/type cards).** For NON-status cards whose color marks an entity KIND (site/building/user/…), use the parallel accent palette (`--accent-<hue>` seeds; hues `emerald|blue|violet|slate|rose|amber|cyan`). A `StatusCard` takes `accentColor={accentVar(hue)}` (drives disc/icon/surface/border from that one color, overriding `tone`). A hand-rolled card/chip (framework `Card`, a list-row icon chip) uses `accentToneClass(hue, slot)` (the `"acc-<hue> tsf-<slot>"` counterpart of `toneSlotClass`) — set `soft` on the surface and bare `tsf-badge` / `tsf-fg` on its children. NEVER hand-write `bg-<hue>-100 text-<hue>-600 dark:…` disc/surface classes on a summary/nav card. (Genuinely categorical Badges/dots/chips that are not card surfaces stay domain-local — see [[Domain enum→tone maps (@<scope>/<ui-package>)]].)

### Anti-Pattern

```tsx
// FORBIDDEN — static palette-class read bypasses the per-tone seed
<Icon className={STATUS_TONES.success.icon} />
<div className={done ? STATUS_TONES.success.dot : "bg-border"} />
// REQUIRED — seed-driven slot class
<Icon className={toneSlotClass("success", "fg")} />
<div className={done ? toneSlotClass("success", "dot") : "bg-border"} />
```

## Domain status badge + status variant maps (@<scope>/<ui-package>/<domain>)

| Field | Value |
|-------|-------|
| **Component / maps** | one `<Domain>StatusBadge`; the domain's variant maps (`REQUEST_STATUS_VARIANT`, `statusVariant`, `dayStatusTone`, …) |
| **Package** | `@<scope>/<ui-package>` (the domain's subpath) |

### Rule

A status vocabulary shared by several entities of one domain (a DRAFT/PENDING/APPROVED/… ladder running across every request family, roster, and closing) renders via ONE shared `<Domain>StatusBadge` — it normalizes the boot enum, tones through a variant map, and translates via the merged `enums.*` keys (`enumLabel` prop optional). The variant maps are defined once in the project UI package; modules re-export through a local shim path at most, never redefine. A tone resolver over a classification status (`dayStatusTone(status)` → `StatusTone`, via the shared calendar palette) belongs in the same place — never re-declare a local `CALENDAR_COLOR_TONE` map, and never a per-module day-status color map beside the single shared palette.

### Anti-Pattern

```tsx
// FORBIDDEN — module-local status pill + duplicated variant map
const REQUEST_STATUS_VARIANT = { DRAFT: "outline", PENDING: "secondary", ... };
<Badge variant={REQUEST_STATUS_VARIANT[resolved] ?? "outline"}>{enumLabel(name, resolved)}</Badge>
// REQUIRED
<RequestStatusBadge enumName="LeaveRequestStatus" value={row.requestStatus} />
```
