> Commonization registry - **Domain-shared widgets (calendar chrome and per-domain widgets)**. Detail file of `../registry.md` (the index); sections verbatim. Check the index first, then read only the section you need.
>
> Entries naming `@simplix-react/*` are framework components and apply to every project. Entries naming `@<scope>/<ui-package>` are the *shape* a project's own shared UI package takes - substitute the project's package and its domain nouns.

# Registry - Domain-shared widgets (calendar chrome and per-domain widgets)

## CalendarShell / CalendarApiBridge / CalendarColorLegend (calendar package)

| Field | Value |
|-------|-------|
| **Components** | `CalendarShell`, `CalendarApiBridge`, `CalendarColorLegend` |
| **Package** | `@simplix-react/calendar` (framework package) |

### Rule

Every calendar screen composes its chrome from the calendar package, inside a `CalendarProvider`:

1. **`CalendarShell`** - the standard fixed-`CalendarHeader` + scrolling-`CalendarBody` layout, with optional `sidePanel` (fixed-width, independently scrolling right column) and `trailing` header slot. NEVER hand-write the `min-h-0 flex-1 overflow-y-auto` scroll-host div or the `w-72 shrink-0 border-l` side column per screen.
2. **`CalendarApiBridge`** - exposes imperative `CalendarApi` (`setView` / `setDate` / `goTo`) through a ref for drill-down handlers living outside the provider (e.g. month-cell click → day view). NEVER re-implement a module-local view-bridge component over `useCalendarView`/`useCalendarDate`.
3. **`CalendarColorLegend`** - dot-and-label legend over `CalendarColor` tokens. NEVER hand-roll a `dotBgClass` + label loop.

### Standard Usage

```tsx
<CalendarProvider items={items} onCellClick={(d) => apiRef.current?.goTo(d, "gantt-day")} ...>
  <CalendarApiBridge apiRef={apiRef} />
  <CalendarShell views={["month", "gantt-week", "gantt-day"]} trailing={<Badge>…</Badge>} sidePanel={<SummaryPanel />} />
</CalendarProvider>
```

## A widget several boards of one domain draw (@<scope>/<ui-package>/<domain>)

| Field | Value |
|-------|-------|
| **Component** | one `<Domain><Widget>` per domain - an activity feed, a day-detail popup, a view legend, a row-extra badge group |
| **Package** | `@<scope>/<ui-package>` (the domain's subpath) |

### Rule

A widget that more than one board over the same record family draws is ONE component in the domain's subpath of the project UI package. The caller owns the query and passes the row and its loading state; the component owns its labels (the package's own i18n namespace), its empty state and its formatting. Do NOT re-build it per module - two boards showing the same record must not disagree about what it holds.

The condition for whether a lifecycle action applies is shared the same way: ONE predicate table in the domain module's `features/` segment that every surface reads - list row actions, detail footer buttons, operator boards. An inline `resolveBootEnum(x.status) === "SOME_STATE"` comparison in a widget is a duplicate: it silently diverges from the sibling surface the next time the state machine changes. The project's own registry names the widgets and the tables (`../registry.md` § Adding a new pattern).
