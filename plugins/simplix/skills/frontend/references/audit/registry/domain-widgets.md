> Commonization registry — **Domain-shared widgets (activity / calendar / lifecycle / approval)**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.
>
> Entries naming `@simplix-react/*` are framework components and apply to every project. Entries naming `@<scope>/<ui-package>` are the *shape* a project's own shared UI package takes — substitute the project's package and its domain nouns.

# Registry — Domain-shared widgets (activity / calendar / lifecycle / approval)

## ActivityList (@<scope>/<ui-package>/activity)

| Field | Value |
|-------|-------|
| **Component** | `ActivityList` |
| **Package** | `@<scope>/<ui-package>` (subpath `./activity`) |

### Rule

Scrolling activity/event feed. Rows are `ActivityRowModel { id, title, subtitle?, icon?, badge?, timestamp?, onNavigate? }`; the component owns relative-time formatting (`formatRelativeTime`) and the empty state. Replaces hand-rolled recent-events / recent-activity / entity-feed lists and their duplicated `formatRelativeTime`/`formatAbsoluteTime` helpers.

## CalendarShell / CalendarApiBridge / CalendarColorLegend (calendar package)

| Field | Value |
|-------|-------|
| **Components** | `CalendarShell`, `CalendarApiBridge`, `CalendarColorLegend` |
| **Package** | `@simplix-react/calendar` (framework package) |

### Rule

Every calendar screen composes its chrome from the calendar package, inside a `CalendarProvider`:

1. **`CalendarShell`** — the standard fixed-`CalendarHeader` + scrolling-`CalendarBody` layout, with optional `sidePanel` (fixed-width, independently scrolling right column) and `trailing` header slot. NEVER hand-write the `min-h-0 flex-1 overflow-y-auto` scroll-host div or the `w-72 shrink-0 border-l` side column per screen.
2. **`CalendarApiBridge`** — exposes imperative `CalendarApi` (`setView` / `setDate` / `goTo`) through a ref for drill-down handlers living outside the provider (e.g. month-cell click → day view). NEVER re-implement a module-local view-bridge component over `useCalendarView`/`useCalendarDate`.
3. **`CalendarColorLegend`** — dot-and-label legend over `CalendarColor` tokens. NEVER hand-roll a `dotBgClass` + label loop.

### Standard Usage

```tsx
<CalendarProvider items={items} onCellClick={(d) => apiRef.current?.goTo(d, "gantt-day")} ...>
  <CalendarApiBridge apiRef={apiRef} />
  <CalendarShell views={["month", "gantt-week", "gantt-day"]} trailing={<Badge>…</Badge>} sidePanel={<SummaryPanel />} />
</CalendarProvider>
```

## Day-detail dialog for calendar boards (@<scope>/<ui-package>/<domain>)

| Field | Value |
|-------|-------|
| **Component** | one `<Domain>DayDetailDialog` per calendar domain |
| **Package** | `@<scope>/<ui-package>` (the domain's subpath) |

### Rule

Every board over the same day-scoped record family shares ONE day-detail popup — a status pill, the breakdown rows, the event stream, and the locked/closed state. The caller owns the query and passes `row`/`isLoading`; a boolean prop adds the privileged-only rows; a `footer` slot carries the action and is suppressed when the day is locked. Labels come from the package's own i18n namespace. Do NOT re-build a `Dialog` + `DetailFieldWrapper` breakdown + event list per module — two boards showing the same day must not disagree about what that day contains.

## Gantt row extras and view-family legends (@<scope>/<ui-package>/<domain>)

| Field | Value |
|-------|-------|
| **Components** | a row-extra badge group, a bar-vocabulary legend, a timeline empty notice |
| **Package** | `@<scope>/<ui-package>` (the domain's subpath) |

### Rule

1. **Row-extra badges** — the summary badges appended to gantt rows through `renderGanttRowExtra` are ONE shared component per domain. It takes the raw numbers, hides zero values, and owns its label i18n. NEVER re-build the badge pair with inline `text-[0.625rem] tabular-nums` classes in a module.
2. **View-family legend** — gantt views speak a bar vocabulary (work / overtime / night / break / uncredited spans) that is DIFFERENT from the month view's day-status colors, so a board offering both families **swaps its legend with the active view**: the bar legend while a `gantt-*` view is active, the day-status legend for month/year/agenda. Swatches reuse the framework's `timelineBarClass`/`patternClass` — never hand-rolled bar swatches. A legend entry that only some boards draw (a leave span on the time grid) is opt-in via a prop, not always rendered.
3. **Timeline empty notice** — passed through `CalendarProvider`'s `timelineEmptyState` slot on every gantt. Gantt rows exist only for *timed* records, so the framework's generic "no records" empty state misleads on a day that holds only untimed ones (an absence, a leave, a holiday); this notice says where those live instead. Boards without the side panel the default hint points at pass their own `hint`.

### Standard Usage

```tsx
{view.startsWith("gantt-") ? <BarLegend /> : <StatusLegend ... />}

<CalendarProvider ... timelineEmptyState={<TimelineEmptyNotice />}>
```

## Lifecycle / presence predicate tables (module `features/`)

| Field | Value |
|-------|-------|
| **Modules** | `modules/<domain>/src/features/lifecycle-actions` (approval-lifecycle predicates), `modules/<domain>/src/features/presence-actions` (`presenceValue` / `isOnSite` / `isCheckinable` / `isLivePresence` / `isTerminalPresence`) |
| **Scope** | Every surface that gates an action or affordance on an entity's lifecycle / presence state |

### Rule

The condition for whether a lifecycle action applies (submit / review / cancel / check-in / extend / assign) lives in ONE predicate table in the domain module's `features/` segment, and every surface — list row actions, detail footer buttons, operator boards — reads its condition from there. An inline `resolveBootEnum(x.status) === "SOME_STATE"` comparison in a widget is a duplicate: it silently diverges from the sibling surface the next time the state machine changes (a desk button enabled where the panel's is disabled is this exact failure). New states or actions extend the table, not the widgets.

## ApprovalFlowSection (approver-scoped — not for operator surfaces)

| Field | Value |
|-------|-------|
| **Component** | `ApprovalFlowSection` (`@<scope>/<ui-package>/approval`) |
| **Scope** | Approval surfaces where the viewer is a flow participant (approval inbox, requester self-service detail) |

### Rule

`ApprovalFlowSection` reads the approval-flow endpoint, which is scoped to the flow's PARTICIPANTS — for any other viewer it rejects with an access-denied error that surfaces as a modal. Operator surfaces (desks, ops consoles) must NOT embed it: they show the request's approval STATUS (a `StatusBadge` from the entity's own DTO) and, where relevant, the operator-actionable review affordance instead. Embedding the flow section outside a participant-scoped surface is a defect even when it happens to render for an admin account.
