---
name: frontend
description: MANDATORY handbook for ALL frontend work in a simplix-react project. Invoke on the first frontend-touching task of the session — before reading, writing, reviewing, refactoring, or explaining any TSX, TS, CSS, or documentation file in that project. Applies when the repository is built on simplix-react — a `simplix.config.ts` at its root, `@simplix-react/*` dependencies, or CLI-generated `packages/domain-*` packages; skip it for stock React/Next repositories with none of those markers. simplix-react is package-first, OpenAPI-driven, derives hooks, and uses FSD layering, with conventions that diverge from stock React/Next patterns. Working from memory produces defects and regression. Covers the full frontend lifecycle — framework contracts (defineApi, deriveEntityHooks, setupMockWorker), domain scaffolding (add-domain, openapi, add-module CLI), widget customization (CrudList, CrudForm, CrudDetail composition), specialized customization (data table filters, list columns with badges/icons/i18n), commonization audit (registry-based duplicate prevention), and documentation (Diataxis classification, TSDoc standards). Trigger on ANY cue that implies frontend work — user mentions a React type, hook, component, or file ("component", "widget", "page", "hook", "list", "form", "detail", "modal", "dialog", "button", "icon", "badge", "column", "filter", "search", "table", "CrudList", "CrudForm", "CrudDetail", "FilterBar", "useQuery", "defineApi", "deriveHooks", "simplix-react", "@simplix-react/ui", "OpenAPI", "scaffold", "add-domain", "add-module", "TSDoc", "README", "Diataxis", "FSD", "features", "widgets", "entities", "pages", "shared"); the task touches files under apps/, modules/, packages/, or produces documentation (*.md, TSDoc blocks); the user asks to create a domain, add a module, customize a widget, add a filter, style columns, reorder columns, add a badge, audit commonization, write docs, or anything frontend-adjacent. Never skip on "this is simple" — simple changes are where convention drift happens. Creating a NEW screen additionally triggers the mandatory precedent check — two same-shape sibling screens are read end to end and matched before implementation. Once invoked within a session, do not re-invoke.
version: 1.0.0
---

# SimpliX Frontend Development Handbook

Single source of truth for frontend work in a **simplix-react** project — a package-first React framework that auto-generates reusable domain packages from OpenAPI specs — with strict conventions for FSD layering, framework component composition, filter/column design, commonization, and documentation. The handbook is project-agnostic: concrete domain, entity, and package names come from the project's `simplix.config.ts` and codebase, never from this document. Names appearing in examples (`@<scope>/<ui-package>`, `packages/domain-<name>`, `modules/<domain>`) are placeholders.

---

## How to Use

1. **Step 0 — Backend-sync check**: if the backend OpenAPI spec has changed since last codegen, jump to **invariant #29** first — it blocks every CUSTOMIZE task.
2. **Step 0.5 — Precedent check for screens**: creating a NEW screen or reshaping one? Run **invariant #51** — classify the screen's shape, pick two same-shape precedent screens, read them end to end BEFORE designing anything → `customize/precedent-check.md`.
3. Review the **Non-Negotiable Invariants** below — especially #29 (backend-sync gate), #51 (precedent-first screens), #9 (framework-first), #22 (registry-first).
4. Use the **Task Router** → Read referenced files lazily. SCAFFOLD comes first when the backend changed. **The routed Read precedes the first edit of the task — an edit made before the routed reference is read is a violation, not a head start.**
5. DOCUMENT is cross-cutting (any `*.md` / TSDoc output → also read `docs/*`). AUDIT is mandatory after CUSTOMIZE (`audit/*`).

### Handbook-skip red flags (each of these thoughts means: stop and route)

| Thought | Reality |
| --- | --- |
| "This change is small — no need to open the references" | Small changes are where drift accumulates. The Task Router names a file for every trigger; read it before the first edit. |
| "I remember this convention from a previous session" | Conventions evolve with every promoted learning; memory is stale by definition. The reference is the current state. |
| "The scaffold / framework output is already consistent" | Generated output is generic. Project decisions live in these references and in precedent screens. |
| "I'll make it consistent with the siblings afterwards" | Post-hoc alignment = review churn. The precedent check (#51) and routed reads come FIRST. |
| "This screen is a special case — no precedent applies" | Special cases still classify into a shape in `customize/precedent-check.md`, and chrome / filters / columns / mutations always have precedents. |

### Path conventions in this file

1. Paths inside the **Task Router** are relative to this skill's own `references/` directory — `framework/overview.md` means this skill's `references/framework/overview.md`.
2. Every other path is relative to the **frontend project root** — the directory holding `simplix.config.ts`. In a monorepo, prefix the subproject name when the working directory is the repository root.
3. Where an invariant points at a project-owned document (FSD rules, development workflow, policy tables), read whatever the project keeps under its own `.claude/`; when it keeps none, the rule stated here stands on its own.
4. Scripts shipped with this plugin are addressed through `${CLAUDE_PLUGIN_ROOT}` and run from the frontend project root (or with `--root=<dir>`).

---

## Scope — What This Handbook Covers

In scope:

1. **Framework contracts** — `defineApi`, `deriveEntityHooks`, `setupMockWorker`, mock handlers, `simplix.config.ts` (CLI-scaffolded projects derive hooks via OpenAPI codegen rather than calling the deriver directly — see the simplix-react framework documentation for framework contract mechanics)
2. **Domain scaffolding** — `add-domain`, `openapi`, `add-module`, `scaffold` CLI; route/mock/menu wiring; API update propagation
3. **Widget customization** — composing `CrudList`, `CrudForm`, `CrudDetail`, layout primitives (`Flex`, `Stack`, `Grid`, `Container`, `Section`, `Card`), custom editors, map/tree views, mutation/invalidation
4. **Filter design** — `CrudList.FilterBar`, faceted / toggle / text / date-range / chip filters, FK injection, external state sync
5. **Column design** — `CrudList.Column`, cell rendering with badges/icons, formatting, alignment, ordering, visibility, drag-drop, i18n
6. **Commonization audit** — registry-based prevention of duplicated inline UI patterns; enforcement that shared components live in a shared package (the framework `@simplix-react/ui` for generic patterns, the project's own shared UI package for domain-specific ones), never inlined in modules/apps
7. **Documentation** — Diataxis classification, TSDoc, README / CHANGELOG / CONTRIBUTING standards

Out of scope (handled elsewhere):

1. FSD layer rules and import direction — the project's own architecture reference
2. MCP server priority (code-graph / UI-component MCPs, when available — capability-level, no hardcoded servers)
3. Project policies (package-first, design reference interpretation, backend request templates, pattern-first) — the project's own policy reference
4. Build / lint / typecheck / dev-server commands — the project's own development-workflow reference
5. Backend work → the `simplix:backend` skill

---

## Non-Negotiable Invariants

These invariants apply to **every** frontend file you touch. Treat each as inviolate unless the invariant itself names an exception.

> **When the backend OpenAPI spec has changed since the last codegen, jump to invariant #29 (Backend Sync) FIRST — it supersedes every invariant below it.** A CUSTOMIZE task on stale generated/ code produces silent bugs that compile cleanly.

### Framework & Contracts

1. **Contract-first** — every domain has ONE API contract; on the codegen path hooks are generated by **Orval** and re-exported from a single hooks file (`src/hooks/`) per domain package (Orval output lives in `src/generated/`). When the framework's own deriver is referenced it is `deriveEntityHooks` (NOT `deriveHooks`) — see the simplix-react framework documentation for those mechanics. Never hand-write hooks alongside the generated ones.
2. **Boot mutator** — API calls go through each domain's `src/mutator.ts`, which uses `getMutator("boot")` (the `simplix-boot` profile). The full Boot envelope is `{ type: string; message: string; body: T; timestamp: string; errorCode?: string | null; errorDetail?: ErrorDetail | null }` — `type` is a **free string** (the success marker is the literal `"SUCCESS"`, NOT a closed enum), and the DTO payload lives in `body`. The boot mutator unwraps this envelope (returns `.body`) so React Query `data` is the plain DTO directly; `adaptOrvalList` then reads the already-unwrapped `.body.content` for list hooks. Any envelope whose `type !== "SUCCESS"` throws `ApiResponseError`. Never bypass the mutator or hand-roll fetch — and never re-access `data.body` after unwrap (it resolves to `undefined`). See `scaffold/overview.md` Common Issues for the one-time `getMutator("boot")` fix.
3. **Query builder / params** — NEVER hand-assemble query strings. In the hand-authored contract path, use the framework's `simpleQueryBuilder` (unless custom pagination is required). In the Orval-codegen path (the CLI default), list/sort/pagination params are produced by the generated request params — `simpleQueryBuilder` is not used (see `framework/overview.md`). Either way, no ad-hoc query string assembly. Paged list reads send `page` and `size` TOGETHER — some searchable-params parsers reject a lone `{ size }`; confirm the pagination contract from the spec rather than assuming `size` is independently optional.
4. **Type-name conflicts** — when `schemas.ts` and derived types collide, export **only Zod constants** from `schemas.ts`.

### Scaffolding

> **Scaffold-first — generate, don't hand-create (CLI + OpenAPI before anything).** Creating a new domain package, UI module, or CRUD widget set is ALWAYS done with the `simplix` CLI (and OpenAPI codegen when a spec exists) — never by authoring the skeleton, contract, or list/form/detail widgets by hand. This is the FIRST action when adding any new package, module, or page; hand-creating them forks the structure codegen and the validators expect.
>
> | To create… | Run (CLI-first) | NOT |
> | --- | --- | --- |
> | A domain from an OpenAPI spec (preferred) | `simplix openapi <spec> -d <name> -y` | hand-write the contract or `src/generated/` |
> | A domain with no spec | `simplix add-domain <name> -y`, then fill `operations` | hand-create the package folder |
> | A UI module | `simplix add-module <name> -y` | hand-create `modules/<name>/` |
> | CRUD UI for an entity | `simplix scaffold <entity> --module <name>` | hand-build list/form/detail |
>
> Full Initial path (Steps 0–8) + Update path → `scaffold/overview.md`. Generated artifacts then obey #30 (no manual DTO/hook/mock); use the live spec over stale JSON (#7). For CLI mechanics/flags see the simplix-react framework CLI documentation.
>
> **Page scaffolding** — every routed page starts from the crud-page shape; page chrome rules are invariant #31.
>
> **List screens** — paged searchable first; the mandatory backend-then-CLI recipe is invariant #32.
>
> **New-screen consistency** — post-scaffold customization of a new screen starts with the precedent check (two same-shape precedent screens read end to end); invariant #51 → `customize/precedent-check.md`.

5. **package.json `source` export** — every export entry in a generated package MUST carry a `"source"` condition for Vite dev HMR to work. Verify after every `add-module` / `scaffold`.
6. **Snapshot before regenerate** — before regenerating from OpenAPI, snapshot the current field set (entity fields, enum values). Diff after regenerate drives widget updates.
7. **Live API over local JSON** — when `simplix.config.ts` points at a live API URL, never substitute a stale local JSON: tag names and schemas can differ silently.

### Widget Composition

8. **No raw HTML layout** — NEVER write `<div className="flex ...">` / `<div className="grid ...">` / `<div className="mx-auto ...">` when framework primitives exist (`Flex`, `Stack`, `Grid`, `Container`, `Section`, `Card`). Framework primitives only.
9. **Framework components first** — before writing any custom component, check `@simplix-react/ui` and existing module code for an existing component. Propose adding a variant/feature to the framework before creating a project-local custom component.
10. **Boot enums everywhere** — boot enum fields use `resolveBootEnum()` in list columns, form defaults, detail display, AND DTO assembly — ALL four contexts. A single context missing it produces drift.
11. **SelectField async options** — gate rendering on both value AND options loading state. Never render with incomplete options. Mechanism: a Radix-backed select whose options arrive AFTER first render does not refresh its closed trigger — a value with no matching option renders an empty trigger and stays empty even once options load. Gate the whole select on EVERY contributing query (`aQuery.isLoading || bQuery.isLoading ? <Loading /> : …`), and derive a fallback selection from the row's own data rather than an effect-populated map (effect state is empty on the first render).
12. **Callback prop naming** — `onSuccess`, `onClose`, `onBack`, `onCancel`, `onEdit`, `onDeleted`. No ad-hoc callback names.

### Filter Design

13. **`maxBadges={3}`** — every `CrudList.FilterBar` you create or touch MUST set `maxBadges={3}` (active-filter badges beyond 3 collapse to `+N`, keeping the badge bar scannable). Prescriptive standard — apply it whenever you add or modify a FilterBar, even if neighbouring lists predate the rule and lack it.
14. **Boolean → toggle** — boolean fields use `type: "toggle"`, NEVER `type: "faceted"` with true/false options.
15. **Chip = special cases only** — `ChipFilter` is for bitmask fields or visual distinction; standard enum / FK uses `type: "faceted"`. One more sanctioned chip case: **narrowing WITHIN a server-forced scope** — a list locked to `field.in: "A,B"` takes a single-select `CrudList.ChipFilter` on `field.equals` (the params AND together: no chip = whole scope, chip = one state inside it). Requires the backend `@SearchableField` to allow BOTH `EQUALS` and `IN` on that field — with only one allowed, the combination fails disguised as an empty result.
16. **Filter ordering** — category order (String → Date → Number → Attribute), then by table column order. Deterministic, not aesthetic.
17. **Backend DTO verification** — after filter design is complete, verify the backend DTO supports all filter fields. Missing fields → implement them in the backend under the `simplix:backend` skill (or, when the backend is out of scope for the session, raise the gap with the exact field, operator, and screen it blocks).

### Column Design

18. **Column order** — Drag > Select > Identifier (hidden) > Relations (hidden) > Type > Text > Description > Attributes > Metrics > Schedule > Audit (hidden) > Actions. This order is mandatory, not a suggestion. (Forward-looking standard: a narrow domain exception is allowed only when a hidden category IS the entity's primary data — e.g. an audit-log entity whose actor/timestamp/field-change columns are the whole point of the list; surface those rather than hiding them. The default ordering still applies to every other entity.)
19. **User confirmation before restyling** — present analysis and get approval before modifying existing column source.
20. **Alignment rules** — fixed-length codes: center; long text: left; bounded numeric ranges: center; unbounded / large numbers: right. `CrudList.Column` has no `align` prop — apply alignment inside the cell render (the column's `children` render function) using framework primitives (`Flex`/`Stack` `align`/`justify`, or a text-align utility class), never a column-level prop.
21. **Boolean columns** — preserve existing renderers as-is; NEW boolean columns render via `Badge`.

### Commonization Audit

22. **Registry first** — before implementing an empty state, error state, loading state, or status card, check `references/audit/registry.md` for an existing shared component. NEVER write custom inline versions when a shared component exists.
23. **Shared components live in a shared package, never in `modules/` or `apps/`** — extract framework-generic, reusable patterns into the framework UI package (`@simplix-react/ui`); extract project-domain-specific shared UI (selects bound to your domains, project dialogs, labels) into the project's OWN shared UI package (e.g. a `@<prefix>/<name>-ui` package). A reusable pattern MUST NOT stay inlined in a module or app.

### Documentation

24. **Diataxis single-type** — every doc is exactly one of Tutorial, How-to Guide, Reference, Explanation. Never mix types in a single document.
25. **Language policy** — README, TSDoc, public-facing docs, CONTRIBUTING, CHANGELOG are in English. Internal notes may be Korean.
26. **Official terminology** — use project vocabulary strictly: `contract`, `entity`, `operation`, `derive`, `hook`, `mock handler`. No synonyms.
27. **Code fences are tagged** — every code block has a language tag (`ts`, `tsx`, `bash`, `json`, `md`).
28. **Result-first writing** — open with what the thing does, not how it works internally. "Generates type-safe hooks for all entities" beats "Iterates config.entities and…".

### Backend Sync (applies FIRST when backend changed — overrides category order)

29. **Backend-change gate** — when the backend OpenAPI spec has changed since the last codegen, the SCAFFOLD Update path MUST run **before** any CUSTOMIZE work. Even "just a column change" is blocked.
    - **Detect**: `pnpm --filter @<prefix>/domain-<name> run codegen` → non-empty `git status packages/domain-<name>/src/generated/` means backend moved. Alternate recipes (tag-list diff, field snapshot) → `scaffold/overview.md` §"Detection recipes".
    - **Update path** (existing domain) → `scaffold/overview.md` §"Updating an Existing Domain" Update Steps 1~7.
    - **Initial path** (new domain, `packages/domain-<name>/` absent) → `scaffold/overview.md` §"Workflow Steps" Step 0~8, starting with `simplix.config.ts` registration.

30. **No manual DTO / hook / mock** — generated TypeScript DTO types, React Query hooks, and MSW mock handlers MUST come from the `openapi` CLI. Hand-writing any of these creates drift the next codegen silently overwrites.
    - **Allowed hand-written**: Zustand stores, FSD `entities/` state, widget composition, custom editors, SSE glue, local helper types that do NOT shadow a generated DTO.
    - **Allowed manual edits to codegen output**: `src/mutator.ts` (one-time `getMutator("boot")` fix — see `scaffold/overview.md` Common Issues) and `src/mock/seeds.ts` (preserved across regenerations). Nothing else.

### Page & List Standards (apply to EVERY routed page, generated or hand-authored)

31. **Standard page chrome** — every routed page starts from the crud-page shape (copy an existing scaffolded page and strip what does not apply; never author a page from a blank file):
    a. Page title/description registered via `usePageHeader({ title, description })` — NEVER a local `Heading` rendered as the page title.
    b. Primary create action ("add X", "new request") lives in `usePageHeader`'s `actions` slot — never a local button row above the list. For tabbed pages, the header action drives the active tab's create dialog through props.
    c. No ad-hoc padding on the page root (`className="p-4"` etc.) — the app layout owns page padding.
    d. Panel-style list-detail pages render the `Stack flex` root directly — an extra `Container` breaks the flex height chain and un-pins the detail footer.
    e. **Whatever `ListDetail.Detail` renders owns the scroll.** `ListDetail.Detail` is `overflow-hidden` by design — it never scrolls its own content. Its child MUST supply the scroll container, and there are exactly two ways to do that:
       - **Read/edit surfaces → `CrudDetail` / `CrudForm`** (header slot / `overflow-auto` body slot / pinned footer). This is the default for ANY panel showing entity data, including operator consoles and action panels — a panel that runs actions is still a detail surface.
       - **Custom editors (canvas, bitmap, timeline)** → `Stack fill` root + `Stack flex overflow="auto"` body, reproducing the same chain by hand.
       A panel whose root is a bare `Stack` / `Card` / `Section` (no `fill` + `overflow`) is a DEFECT even when today's data happens to fit: the content is silently clipped at the panel's height with no scrollbar, so actions below the fold become unreachable. It also drifts visually — hand-rolled title rows and close buttons instead of the standard detail chrome.
    - Exceptions: standalone screens outside the app layout (login), and thin wrapper pages that delegate to a view component which itself owns `usePageHeader`.
    - Full detection recipes → `audit/audit-checklist.md` § Page Chrome Violations. A page whose header or create button looks different from its siblings is a defect.

32. **List screens are paged searchable — ALWAYS the first implementation method considered** — before building ANY screen that renders a list, judge whether its row count can grow (accumulating records, per-user histories, request queues — when in doubt, assume it grows). If it can: (1) the backend exposes a standardized template-based paged searchable endpoint (self-scoped/aggregated surfaces force scope conditions server-side on the same searchable params); (2) the frontend is CLI-generated then customized — `useCrudList` + `adaptOrvalList` with `CrudList.Table` / `CrudList.FilterBar` / `CrudList.Pagination`. A hand-built table over an unpaged array endpoint is NOT an acceptable list screen; a plain `Table` is reserved for provably bounded, small collections.

33. **A screen that shows a lifecycle must be able to drive it** — for every entity-scoped action the backend exposes (`@PostMapping("/{id}/<action>")` and friends), the UI must offer a way to reach it, and every state the UI shows must have an exit. Before finishing a CUSTOMIZE task, diff the module's action endpoints against the hooks the frontend actually calls, and check the states an entity can sit in for one with no affordance out of it (a submit-for-approval that only a non-existent portal calls, an assigned card whose only release path is a desk that lists today's rows, a settled week nothing can resettle). A row that is stuck is a defect even when every screen renders.

34. **A form writes what the create/update DTO accepts** — a DTO field the form never edits is a field the user cannot fill, and if it drives the entity's downstream behaviour the record is born broken (a visit whose participant list is unwritable can never be checked in). Compare `FormValues` against the generated `*CreateDTO` / `*UpdateDTO` and account for every field: edited, deliberately server-owned, or deliberately out of scope. Ids the user cannot know (an `attachmentFileId`, an entity reference) are never plain text inputs — they come from a picker or the framework file field.

35. **Edit is a state, not a button** — content that has left the draft state is what approvers decided on. Gate the edit affordance (`when:` on the row action, `onEdit` on the detail) on the same condition the server enforces, and make the server enforce it: an update that rewrites an approved request's content must be rejected there, not merely hidden in the UI.

36. **Values that come back from the server are rendered, never echoed** — a boot-enum object (`{type,value,label}`) fed into a `SelectField` renders blank and submits an object (`??` never fires — the object is truthy; use `resolveBootEnum(x) || "DEFAULT"`). An `Instant` field rendered with the default `DetailDateField` / `datePart` silently drops the time an approver needs. A raw id or ISO stamp shown to a user is a machine value leaking through. Resolve enums, format instants with `format="datetime"`, and title panels with an identifying value (a name), never an id.

37. **A time of day is a `TimeField`, and an optional one needs a gate** — a wall-clock (`LocalTime`) field is edited with `FormFields.TimeField`, never a `TextField` with `inputProps={{ type: "time" }}` and never a free-text `placeholder="HH:mm"`. `TimeField` speaks `TimeValue` (`{hours,minutes}`) while the DTO speaks `"HH:mm"`, so convert with the ONE shared helper pair in the project's shared UI package (`parseLocalTime` / `formatLocalTime`, plus `displayLocalTime` for detail rows) — a per-module copy of the conversion is a defect. The picker has no empty state (a `null` value displays as `12:00 AM`), so an optional time is only optional if a mode select or a `SwitchField` expresses "unset" and the submit path writes `undefined` there; a form that displays a time while submitting none is a defect. Keep the 12-hour default (`hour12`) unless a screen deliberately standardizes on a 24-hour clock. Full recipe → `customize/framework-components.md` § Date / time field selection.

38. **A choice the server constrains is a choice the server must publish** — when the backend narrows a set of values per record (a visit type's allowed check-in channels, a policy's permitted actions), the read/readiness DTO for that record MUST carry the narrowed set, and the UI builds its options from it. Rendering the full enum and letting the server reject the pick is a defect: the operator has no way to know which value would have worked, and the rejection message is the only feedback. Same rule for a resource pool (cards, seats): the picker offers only what is actually assignable, and an auto-pick that hits an unusable candidate retries rather than failing at the first one. And a state that ends the flow (checked out, cancelled, closed) hides the form that drives it — `presence === "X" ? A : B` is a two-state assumption that silently offers a dead action for every third state.

39. **A list filter is the operator's index, not the DTO's field dump** — the scaffold emits a filter per searchable field, including the entity's UUID and the `createdAt` / `updatedAt` audit stamps. No operator searches by those. Prune them, add the axis the persona actually searches by (the person's name, not just the owner's), and lay the survivors out in 2–3 columns (`popoverColumns` + `columnBreak`) once the form scrolls. When the search axis is a field of an internalized child (a participant's name on a visit), give the SearchDTO a `@SearchableField` over a read-only association on the parent — and NEVER name that association the same as a DTO collection the entity's create/update path maps (ModelMapper will bind transient children onto it and the save fails at flush).

40. **Failure messages are a product surface** — a user-facing exception carries a message key (`"{error.<module>.<case>}"`), resolved at the HTTP layer, with every locale filled; a literal English string thrown from a service reaches the user's dialog verbatim. Enum labels resolve through the enum resolver (`LabeledEnum#getLabel` / `EnumMessageResolver`), not the application `MessageSource` — the `messages/enums` bundles are not on its basename list. And the dialog leads with the server's concrete reason; a generic per-code line is a fallback for a message-less error, never a companion to one.

41. **One search form everywhere — `CrudList.FilterBar`, even off-list** — every screen-level query condition renders through the standard FilterBar: list screens via `useCrudList`'s `filters`, and non-CrudList surfaces (aggregation reports, dashboards, required-param queries) via the standalone `useFilterBarState` hook with params derived from `committedValues`. An inline `FormFields.*` row acting as a report's search conditions is a defect. The total badge is the FilterBar `count` prop (it renders the shared `ListTotalBadge`) — never a hand-placed badge in `leading`, which is reserved for extra summary content (aggregate totals, a pending-count badge). On a page with a status-card strip, tab bodies carry no `StatusCard`s of their own — tab aggregates live on this toolbar line. Detection recipes → `audit/audit-checklist.md` § 11.

42. **Date/time values follow the semantic-kind contract — encode by kind, decode from string components, display in an explicit zone** — every temporal field is one of: absolute instant (RFC 3339 with offset), calendar date (bare `yyyy-MM-dd`), wall-clock time (`HH:mm[:ss]`). Calendar dates are sent as bare dates — never local midnight plus the browser's offset. Site-scoped instants (validity windows, visit schedules) are built from the SITE's IANA timezone (site API `timezone`), never the browser's — the stored value must not change with the operator's location. Decoding reconstructs values from the string's own components (or an explicit display zone for instants) — never through local `Date` getters, which shift values for viewers in other zones and corrupt them on edit round-trips. Site-scoped screens label and use the site timezone; date-range filter boundaries are converted to instants in the site timezone before sending. Inclusive end dates are sent as picked — the exclusive-boundary shift (+1 day / −1 minute) is the server's contract, not the client's. Display goes through the framework date components — `DetailDateField` / `CrudList.Column format=` for field rows and columns, and the inline `InstantText` / `CalendarDateText` / `WallClockText` for cells, cards, and captions; formatting a temporal value inline (`formatDateTime(new Date(x), …)`) in a widget is a defect, and `InstantText format="date"` is the ONLY way to print an `Instant` as its zone-local date (`format="date"` on `DetailDateField` / `Column` is zone-neutral). Full rules & greps → `customize/datetime-fields.md`.

43. **Badge density parity — detail/form badges match the list** — badges on detail/form surfaces render at the SAME size as the list's. `StatusBadge` (and domain wrappers built on it) defaults to `size="sm"` (`text-xs`) — omit `size` and the three surfaces align; base `Badge` already matches. Explicit `size="xs"` only in genuinely denser contexts (legend, live strip, high-density status table). Never enlarge a detail/form badge (`size="default"`, `text-sm`/`text-base` classNames).

44. **Use the component's real prop contract — check the source before working around it** — recurring traps: `DetailTextField` has no `children` (custom-rendered detail values use `DetailFieldWrapper`); `Flex`/`Stack` `wrap` is a boolean (`wrap`, not `wrap="wrap"`); `ConfirmDialog` supports neither `children` nor `hideConfirm` (custom-content dialogs compose `Dialog`/`DialogContent` directly). A prop you expected but cannot find means read the component source — never typecast past it.

45. **A peek dialog is mounted by the app-root peek host, never by the thing that opened it** — a `DetailPeekDialog` kept inside the subtree that triggered it (a list cell, a mapped row, a card in a refetching panel) is unmounted the moment that subtree re-renders, so it closes itself within seconds of opening — the surfaces that show references are exactly the ones an activity stream keeps invalidating. Every `*PeekLabel` (user, org, site, and the module-local ones) dispatches through `usePeekHost()` from the project UI package's peek segment; the `PeekHost` provider wraps the routed tree once in the app's provider stack and renders the dialog there. Labels take no `onPeek` prop and hold no open state — there is one way to open a peek, and it is host-mounted.
    - **A new peek label follows the same shape**: export the dialog as its own component, and have the label's trigger call `peek.open({ render: ({ open, onOpenChange }) => <XPeekDialog … /> })`. The host is kind-agnostic, so a module's own entity needs no registration.
    - Hand-rolled peeks (`usePeekTarget` + `DetailPeekDialog` at a widget root) remain valid for one-off triggers that are not a reusable reference label — the state is already outside the row. Never place one inside a cell render or a `.map()` callback.
    - An app that renders peek labels mounts `PeekHost`; without it the label still renders and the click throws a message naming the missing provider.

46. **Delete is cloned from the precedent, gated, and human-named** — wire deletion by cloning an existing `useCrudDeleteWired` + `adaptOrvalDelete` + `{deleteDialog}` page, on EVERY crud-page variant (page AND panel — one-variant wiring makes deletability depend on screen shape). A detail's `onDelete` activates only when `onDeleted` exists (`onDelete={onDeleted ? del.requestDelete : undefined}` — no dead buttons on callback-less renders). The dialog names the record with a human-readable value (a resolver or a related entity's name, readable fallback), never a raw id. An irreversible purge (anonymization / PII erasure) is a visually distinct action (own icon/tone) with a type-the-name confirmation the server re-validates, and its dialog states the delete-vs-purge difference and scope. Server-side blocks (referential/legal) surface their SPECIFIC message key — what references it and how many — never a generic integrity phrase.

47. **A widened operator read never crosses the trust boundary** — when an operator surface needs the full gate picture (screening, identity verification, compliance, capacity), that widened read (e.g. a `readiness`) is NOT shared with data-subject-facing surfaces (portal / kiosk / public). Those call a narrow read listing only what the subject can act on (approval, agreements, trainings). Sharing the wide read leaks internal verdicts (watchlist hits, identity failures) to the subject, inverts `ready`-style flags into dead-end loops on conditions the subject cannot fix, and multiplies SPI/screening cost per candidate. The backend splits the two reads; each screen wires its own.

48. **Red badges mean "act now" — and land on the view they count** — a red notification badge (`Badge variant="destructive"`, round) counts ONLY a set the viewer must act on; informational counts (totals, per-status tab distribution) are muted `tabular-nums` spans. Nav, sidebar, and tab badges counting the same set share the same query figure and the same red treatment, and demote to muted at 0 (no red zero). The screen a badge leads to opens BY DEFAULT on exactly the set the badge counts — a badge of N landing on a default view showing 0 rows is a wiring defect. Tab/nav counts read `totalElements` from a `size: 1` list query (cache-shared with the list).

49. **An always-open master-detail board pins the detail and auto-selects** — an operator board whose detail must never close composes `ListDetail` with a constant `activePanel="detail"` + `listWidth` (fixed list column, detail fills the rest), and the detail panel component's `onClose` is optional and omitted — with no `onClose`, no close affordance renders. Select the first item on entry; when the selected item leaves the list (processed), fall back to the new first item, and when the list empties, clear the selection and swap to a full-width `EmptyState`. Judge selection survival by item id, never by index — index survival silently selects a different record on refetch.

50. **Reference cards hide when empty; workstation cards never do** — a read-only reference card on a detail panel (screening verdicts, declared items, vehicles — "read it if present" data) renders nothing when it has no rows; a card holding only a "none" line is noise. A card that carries actions (an assignment workstation) always renders, holding its empty-state line plus the hint that explains why its action is currently unavailable. Custom row-action buttons outside the framework action column match the row-action size (`size="xs"`) and join into ONE segmented group (`gap="none"`, `-ml-px` neighbor overlap, outer-corner-only rounding, `whitespace-nowrap`) — a run of individual `size="sm"` buttons inflates row height and wraps.

51. **Precedent-first screens — a new screen is cloned from two precedents, never designed from memory** — before implementing a NEW screen (routed page, tab body, board, report, dashboard section, custom editor, dialog flow) or structurally reshaping one, run the precedent check (`customize/precedent-check.md`): classify the screen's shape, locate TWO precedent screens of the same shape (nearest sibling + best repo-wide match, preferring the most recently modified), read their full widget set end to end, implement by cloning their structure, and finish with a row-by-row parity pass. Divergence is justified only by a domain difference — never by preference; a precedent that itself violates an invariant is fixed or flagged, never copied and never averaged into a third variant. The completion report names the shape, both precedent files, and every justified divergence — a screen whose precedents cannot be named was designed from memory, and that is a defect.

52. **Every action affordance is gated on the permission its endpoint requires** — a button that leads to a call the server will refuse must not render. Read the group from the module's `src/shared/auth/subjects.ts` (`SUBJECTS.<screenKey>`), mirroring the backend's `hasPermission('<group>', '<action>')`, and gate with `useCan("<action>", SUBJECTS.<screenKey>)` from `@simplix-react/access/react` — never a group literal inline, so a screen's gate and the server's rule move together. Create affordances: the page-header create button on BOTH header variants (page and panel — gating one leaves the other open), a tree's per-row `add-child`, and any create button composed into an action group (drop the button out of the group, not the whole `actions` entry). The scaffold emits the gate and the CLI creates an empty `subjects.ts` when a module has none, so a missing entry is a compile error on the generated page — supply the real group, never a plausible one. The audit script (`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`) fails on an ungated `showNew`.

---

## Task Router

Identify the task, Read the referenced file(s), THEN work — the routed Read happens before the first edit, not after and not in parallel. Do not preload everything. All paths below are relative to this skill's own `references/` directory.

### 1. DESIGN — Framework contracts & API layer

Trigger: defining API contracts, deriving hooks, setting up mock workers, configuring `simplix.config.ts`, debugging type derivation, writing tests with `@simplix-react/testing`.

1. Overview & philosophy → `framework/overview.md`
2. `defineApi` / `deriveEntityHooks` patterns, query builder, auth, cache → `framework/api-patterns.md`
3. Complete end-to-end recipes (new contract, new entity, adding operations) → `framework/recipes.md`
4. `simplix.config.ts`, codegen, mock worker configuration → `framework/configuration.md`
5. Project-specific learnings (staging) → `framework/learnings.md`

### 2. SCAFFOLD — Domain packages & UI modules (FIRST when backend changed — see invariant #29)

Trigger: backend OpenAPI spec changed (new endpoints / renamed fields / new enum values / new tags); new domain not in `packages/`; `add-domain` / `openapi` / `add-module` / `scaffold` CLI; route / mock / sidebar-menu wiring.

1. Overview, CLI workflow, Initial + Update paths, detection recipes → `scaffold/overview.md`
2. Route & widget scaffolding patterns → `scaffold/patterns.md`
3. Props / callback conventions across scaffolded widgets → `scaffold/props-conventions.md`
4. Post-scaffold customization of a new screen — precedent check (invariant #51) → `customize/precedent-check.md`

### 3. CUSTOMIZE — Widget modification & composition

Trigger: creating any NEW screen or structurally reshaping one (precedent check FIRST — invariant #51), modifying generated list/form/detail widgets, building custom editors, composing `CrudList` / `CrudForm` / `CrudDetail`, adding layout primitives, wiring mutations/invalidation/unsaved-changes guards, creating map pages, creating tree views.

1. Precedent check — MANDATORY before building a new or reshaped screen (invariant #51) → `customize/precedent-check.md`
2. Overview & framework-first philosophy → `customize/overview.md`
3. Available framework components (catalog) → `customize/framework-components.md`
4. Customization recipes (add column, add action, wire mutation, custom editor) → `customize/recipes.md`
5. CRUD page consistency checklist (list trim, two-column detail, cards, embedded lists, peek) → `customize/consistency-checklist.md`
6. Date/time encoding · decoding · display timezone (invariant #42) → `customize/datetime-fields.md`
7. Project-specific learnings (staging) → `customize/learnings.md`

#### 3a. CUSTOMIZE · Filters (data table filter design)

Trigger: add filter, search filter, faceted filter, toggle filter, date range, timezone, country, chip filter, FK injection, external filter sync.

1. Overview & mandatory rules (maxBadges, category order, DTO verify) → `customize/filters/overview.md`
2. All filter types reference → `customize/filters/filter-types.md`
3. Real implementation examples → `customize/filters/real-examples.md`
4. Date-range boundary & timezone rules (invariant #42) → `customize/datetime-fields.md`

#### 3b. CUSTOMIZE · Columns (list column design)

Trigger: improve list columns, style table cells, add badges/icons/flags, format dates/booleans/enums, reorder columns, alignment, drag-drop, FK relation columns, i18n.

1. Overview & mandatory column order → `customize/columns/overview.md`
2. Cell render recipes (Badge, Icon, FK, enum, date, boolean) → `customize/columns/cell-components.md`
3. Drag-drop reordering → `customize/columns/drag-drop.md`
4. Column i18n integration → `customize/columns/i18n.md`

### 4. AUDIT — Commonization compliance (customization-step, ALWAYS run after CUSTOMIZE)

Trigger: completing any CUSTOMIZE work; adding a new module or page; encountering a repeated UI pattern; extracting common inline patterns to shared components; running compliance audit on existing modules.

**This category is NOT optional after CUSTOMIZE.** After any customization work, run the audit checklist before declaring the task complete.

1. Overview & audit philosophy → `audit/overview.md`
2. Registered patterns registry — one-line index; full contracts in `audit/registry/*.md` detail files → `audit/registry.md`
3. Automated audit checklist → `audit/audit-checklist.md`

### 5. DOCUMENT — Documentation (ALWAYS cross-cutting)

Trigger: writing or editing README, TSDoc on public exports, tutorials, how-to guides, reference docs, explanations, CONTRIBUTING, CHANGELOG, or any `*.md` artifact.

**This category is cross-cutting.** Whenever a task produces ANY documentation output (including TSDoc blocks inline with code), read `docs/*` before writing.

1. Overview & Diataxis classification → `docs/overview.md`
2. Document templates per Diataxis type → `docs/document-templates.md`
3. TSDoc patterns for public exports → `docs/tsdoc-patterns.md`
4. Quality checklist (pre-merge doc review) → `docs/quality-checklist.md`

---

## Before Writing Frontend Code

- [ ] **Backend-sync gate (#29)** — run codegen; `git status packages/domain-<name>/src/generated/` is clean? If not, take the SCAFFOLD Update path FIRST.
- [ ] Identified the app / module / package the code belongs to (FSD layer determined)
- [ ] Read the existing module to pick up local patterns
- [ ] **New or reshaped screen? Precedent check done (#51)** — shape classified, TWO same-shape precedent screens read end to end, comparison sheet extracted (`customize/precedent-check.md`)
- [ ] Task Router references for this task's triggers Read BEFORE the first edit
- [ ] Decided: Scaffold path (generated artifacts — #30) or Customize-only path (application layer)?
- [ ] Scaffold path — OpenAPI spec URL reachable? field snapshot taken (#6)? `package.json` `"source"` exports verified (#5)? `mutator.ts` uses `getMutator("boot")` for `simplix-boot` profile?
- [ ] Customize-only path — framework component doesn't already solve it (#9)? registry doesn't already have the pattern (#22)? no generated artifact hand-shadowed (#30)?

After writing:

- [ ] All 52 Non-Negotiable Invariants hold
- [ ] Every action affordance gated on its endpoint's permission (#52) — both header variants, tree `add-child`, and buttons inside action groups; group read from `SUBJECTS`, never inlined
- [ ] Precedent parity pass done (new / reshaped screens — #51): comparison sheet walked row by row against both precedents, screens compared in the browser
- [ ] Completion report (in conversation — never recorded in files) names the Task Router references consulted and, for screen work, the shape + both precedent files + justified divergences (#51)
- [ ] No `generated/` drift — `git status packages/domain-<name>/src/generated/` clean, OR generated changes committed together with widget / mock seed / locale updates (#29/#30)
- [ ] `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs"` clean (0 error-level hits; review candidates judged, not bulk-rewritten)
- [ ] AUDIT run (if CUSTOMIZE touched existing modules) — `audit/audit-checklist.md`
- [ ] DOCUMENT run (if exports / APIs / user-facing surfaces changed) — `docs/quality-checklist.md`
- [ ] Backend data / translation gaps implemented or raised (if DTO gaps found)
- [ ] Build verification passed — the project typecheck / lint / build gate
- [ ] User-facing screens driven in a browser as the persona who owns them — invoke the `simplix:frontend-e2e` skill. A feature whose screens have never been walked by hand (create → act → reverse, as the operator and as the approver) is unverified, no matter how green the build is.

---

## Learnings from Trial and Error

A rule discovered while working is written down, never left in the session. Where it goes depends on how far it generalizes:

1. **Specific to the project** (its packages, its domains, its policy decisions) → the project's own reference under its `.claude/`. This skill ships read-only from the plugin install; a project fact does not belong in it.
2. **True of any simplix-react project** → the staging files here, `framework/learnings.md` and `customize/learnings.md`, written with placeholders (`<scope>`, `<domain>`, `<entity>`) and neutral example vocabulary. Contribute them upstream to the plugin — where the working tree is a checkout rather than an install, edit it in place and open the change; otherwise report the entry so it can be added.

Read both staging files when the task's category matches them — they carry rules that have not yet been folded into the main body.