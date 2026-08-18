---
name: frontend
description: MANDATORY handbook for ALL frontend work in a simplix-react project — a repository with `simplix.config.ts`, `@simplix-react/*` dependencies, or CLI-generated `packages/domain-*`; skip it for stock React/Next repositories with none of those markers. Invoke on the session's first frontend-touching task, before reading, writing, reviewing, refactoring, or explaining any TSX, TS, CSS, or documentation file there — its conventions diverge from stock React/Next patterns, so working from memory produces defects. Trigger on ANY cue implying frontend work: component, widget, page, hook, list, form, detail, dialog, badge, column, filter, table, CrudList, CrudForm, CrudDetail, FilterBar, defineApi, OpenAPI, scaffold, add-domain, add-module, TSDoc, README, Diataxis, FSD — or a task touching apps/, modules/, packages/, or producing `*.md` / TSDoc. Never skip on "this is simple"; simple changes are where convention drift happens. Once invoked in a session, do not re-invoke.
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
6. **A change that touches a screen is not finished until its screens have been driven in a browser** under `simplix:frontend-e2e` — states, empty and error paths, and the screens either side of it. Green typecheck and a correct-reading diff are not evidence a screen works. Plan for that pass when you plan the change, not after you have called it done. Anything past a single screen is delegated to one `simplix:screen-auditor` per cluster, so the browser turns never land in the session doing the implementation.
7. **Check the project's wiring once per session** (see below) and offer `/simplix:init` when a piece is missing.

### Project wiring — check on load, offer once

Two halves make this handbook hold: the routing block in the project's instruction file, and the gate config in `<subproject>/.claude/simplix.json` that lets the plugin's hooks enforce it. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json` and read `routedBy` and each match's `skillGate` / `e2eGate`.

| Missing | What goes unenforced |
| --- | --- |
| `routedBy` | a session that starts elsewhere in the repository never learns this handbook binds |
| `skillGate` | an edit written from memory is not refused, so drift lands before anyone reads a reference |
| `e2eGate` | a session can change screens and end with none of them opened in a browser |

When anything is missing, say so in one sentence per piece — the user has no reason to know this wiring exists — and offer `/simplix:init`. It shows what it will write and writes nothing without agreement. Offer once per session; if declined, continue and do not raise it again.

### Handbook-skip red flags (each of these thoughts means: stop and route)

| Thought | Reality |
| --- | --- |
| "This change is small — no need to open the references" | Small changes are where drift accumulates. The Task Router names a file for every trigger; read it before the first edit. |
| "I remember this convention from a previous session" | Conventions evolve with every promoted learning; memory is stale by definition. The reference is the current state. |
| "The scaffold / framework output is already consistent" | Generated output is generic. Project decisions live in these references and in precedent screens. |
| "I'll make it consistent with the siblings afterwards" | Post-hoc alignment = review churn. The precedent check (#51) and routed reads come FIRST. |
| "This screen is a special case — no precedent applies" | Special cases still classify into a shape in `customize/precedent-check.md`, and chrome / filters / columns / mutations always have precedents. |

### Path conventions in this file

1. Paths inside the **Task Router** and in invariant pointers (`invariants.md`, `customize/datetime-fields.md`, `audit/audit-checklist.md`, …) are relative to this skill's own `references/` directory.
2. Every other path is relative to the **frontend project root** — the directory holding `simplix.config.ts`. In a monorepo, prefix the subproject name when the working directory is the repository root.
3. Where an invariant points at a project-owned document (FSD rules, development workflow, policy tables), read whatever the project keeps under its own `.claude/`; when it keeps none, the rule stated here stands on its own.
4. Scripts shipped with this plugin are addressed through `${CLAUDE_PLUGIN_ROOT}` and run from the frontend project root (or with `--root=<dir>`).

---

## Scope — What This Handbook Covers

In scope: the five **Task Router** categories below — framework contracts and the API layer,
domain scaffolding, widget customization (with filters and columns as its specializations),
commonization audit, and documentation. The router names the reference file for each.

Out of scope (handled elsewhere):

1. FSD layer rules and import direction — the project's own architecture reference
2. MCP server priority (code-graph / UI-component MCPs, when available — capability-level, no hardcoded servers)
3. Project policies (package-first, design reference interpretation, backend request templates, pattern-first) — the project's own policy reference
4. Build / lint / typecheck / dev-server commands — the project's own development-workflow reference
5. Backend work → the `simplix:backend` skill

---

## Non-Negotiable Invariants

These invariants apply to **every** frontend file you touch. Treat each as inviolate unless the invariant itself names an exception. Compressed invariants keep their number in `references/invariants.md`, which carries the full mechanism, failure story, and code for each — **read the full form before debugging a violation, arguing an exception, or implementing that pattern for the first time.**

> **When the backend OpenAPI spec has changed since the last codegen, jump to invariant #29 (Backend Sync) FIRST — it supersedes every invariant below it.** A CUSTOMIZE task on stale generated/ code produces silent bugs that compile cleanly.

### Framework & Contracts

1. **Contract-first** — every domain has ONE API contract; on the codegen path hooks are generated by **Orval** and re-exported from a single hooks file (`src/hooks/`) per domain package (Orval output lives in `src/generated/`). When the framework's own deriver is referenced it is `deriveEntityHooks` (NOT `deriveHooks`) — see the simplix-react framework documentation for those mechanics. Never hand-write hooks alongside the generated ones.
2. **Boot mutator** — API calls go through each domain's `src/mutator.ts` with `getMutator("boot")`, which unwraps the Boot envelope so React Query `data` IS the plain DTO. Never bypass the mutator, never hand-roll fetch, and never re-access `data.body` after unwrap (it is `undefined`). Envelope shape and the one-time fix → `framework/overview.md` § Mutator, `invariants.md` #2.
3. **Query builder / params** — NEVER hand-assemble query strings: the generated request params produce them on the codegen path, `simpleQueryBuilder` on the hand-authored path. Paged list reads send `page` and `size` TOGETHER. → `invariants.md` #3.
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
10. **Boot enums everywhere** — boot enum fields use `resolveBootEnum()` in list columns, form defaults, detail display, AND DTO assembly — ALL four contexts. A single context missing it produces drift. A detail row is its own trap, because the badge's tone is looked up by the raw value — invariant #53.
11. **SelectField async options** — gate the whole select on EVERY contributing query's loading state; a Radix select whose options arrive after first render keeps an empty trigger even once they load. Mechanism and the fallback-selection rule → `invariants.md` #11.
12. **Callback prop naming** — `onSuccess`, `onClose`, `onBack`, `onCancel`, `onEdit`, `onDeleted`. No ad-hoc callback names.

### Filter Design

13. **`maxBadges={3}`** — every `CrudList.FilterBar` you create or touch MUST set `maxBadges={3}` (active-filter badges beyond 3 collapse to `+N`, keeping the badge bar scannable). Prescriptive standard — apply it whenever you add or modify a FilterBar, even if neighbouring lists predate the rule and lack it.
14. **Boolean → toggle** — boolean fields use `type: "toggle"`, NEVER `type: "faceted"` with true/false options.
15. **Chip = special cases only** — `ChipFilter` is for bitmask fields, visual distinction, narrowing WITHIN a server-forced scope, or a narrowing that also has to reach the tab counts / a census / a sibling list; standard enum / FK uses `type: "faceted"`. A facet reaches the list's request and nothing else, so converting the fourth case silently leaves the counts unnarrowed above narrowed rows. The test — does anything but the list hook read this filter's value? — the forced-scope recipe, and its backend `@SearchableField` requirement → `invariants.md` #15.
16. **Filter ordering** — category order (String → Date → Number → Attribute), then by table column order. Deterministic, not aesthetic.
17. **Backend DTO verification** — after filter design is complete, verify the backend DTO supports all filter fields. Missing fields → implement them in the backend under the `simplix:backend` skill (or, when the backend is out of scope for the session, raise the gap with the exact field, operator, and screen it blocks).

### Column Design

18. **Column order** — Drag > Select > Identifier (hidden) > Relations (hidden) > Type > Text > Description > Attributes > Metrics > Schedule > Audit (hidden) > Actions. Mandatory, not a suggestion; the one domain exception → `invariants.md` #18.
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

31. **Standard page chrome** — every routed page starts from the crud-page shape, never a blank file: title and primary create action registered through `usePageHeader` (never a local heading or button row), no ad-hoc page padding, and whatever `ListDetail.Detail` renders owns the scroll — `CrudDetail` / `CrudForm`, or `Stack fill` + `Stack flex overflow="auto"` for custom editors; a panel without that chain silently clips its actions below the fold. Sub-rules, exceptions and detection recipes → `invariants.md` #31, `audit/audit-checklist.md` § Page Chrome Violations.

32. **List screens are paged searchable — ALWAYS the first implementation method considered** — if the row count can grow (when in doubt, it grows), the backend exposes the standard paged searchable endpoint and the frontend is CLI-generated then customized (`useCrudList` + `adaptOrvalList` + `CrudList.*`). A hand-built table over an unpaged array endpoint is NOT an acceptable list screen. → `invariants.md` #32.

33. **A screen that shows a lifecycle must be able to drive it** — every entity-scoped action endpoint is reachable from the UI, and every state the UI shows has an exit; a stuck row is a defect even when every screen renders. The endpoint-vs-hooks diff recipe → `invariants.md` #33.

34. **A form writes what the create/update DTO accepts** — account for every DTO field: edited, deliberately server-owned, or deliberately out of scope. Ids the user cannot know come from a picker or the framework file field, never a text input. → `invariants.md` #34.

35. **Edit is a state, not a button** — content that has left the draft state is what approvers decided on. Gate the edit affordance (`when:` on the row action, `onEdit` on the detail) on the same condition the server enforces, and make the server enforce it: an update that rewrites an approved request's content must be rejected there, not merely hidden in the UI.

36. **Values that come back from the server are rendered, never echoed** — resolve enums (`resolveBootEnum(x) || "DEFAULT"` — the object is truthy, so `??` never fires), format instants with `format="datetime"`, title panels with a name and never an id. Trap catalogue → `invariants.md` #36.

37. **A time of day is a `TimeField`, and an optional one needs a gate** — a wall-clock (`LocalTime`) field is edited with `FormFields.TimeField`, never a `TextField` with `inputProps={{ type: "time" }}` and never a free-text `placeholder="HH:mm"`. Convert `TimeValue` ⇄ `"HH:mm"` through the ONE shared helper pair in the project's shared UI package; a per-module copy of the conversion is a defect. The picker has no empty state (a `null` value displays as `12:00 AM`), so an optional time is only optional if something expresses "unset" and the submit path writes `undefined` there — a form that displays a time while submitting none is a defect. Helpers, the 12-hour default, and the picker's geometry → `customize/framework-components.md` § Date / time field selection.

38. **A choice the server constrains is a choice the server must publish** — the read/readiness DTO carries the narrowed set and the UI builds its options from it; rendering the full enum and letting the server reject the pick is a defect. Resource-pool pickers and end-state gating (`presence === "X" ? A : B` is a two-state assumption) → `invariants.md` #38.

39. **A list filter is the operator's index, not the DTO's field dump** — prune the UUID and audit-stamp filters the scaffold emits, add the axis the persona actually searches by, and lay long popovers out in 2–3 columns. The internalized-child search axis and its ModelMapper trap → `invariants.md` #39.

40. **Failure messages are a product surface** — a user-facing exception carries a message key resolved at the HTTP layer with every locale filled; enum labels resolve through the enum resolver, and the dialog leads with the server's concrete reason. → `invariants.md` #40.

41. **One search form everywhere — `CrudList.FilterBar`, even off-list** — every screen-level query condition renders through the standard FilterBar (`useCrudList` on lists, `useFilterBarState` elsewhere); the total badge is the `count` prop, never a hand-placed badge in `leading`. → `invariants.md` #41, detection → `audit/audit-checklist.md` § 11.

42. **Date/time values follow the semantic-kind contract** — every temporal field is exactly one of absolute instant, calendar date, wall-clock time. Encode by kind (site timezone, never the browser's), decode from the string's own components (never local `Date` getters), display through the framework date components (`InstantText format="date"` is the ONLY zone-local instant date). Full rules, per-kind tables and greps → `customize/datetime-fields.md`.

43. **Badge density parity** — detail/form badges render at the list's size: omit `size` on `StatusBadge` (defaults `sm`), never enlarge; explicit `size="xs"` only in genuinely denser contexts. → `invariants.md` #43.

44. **Use the component's real prop contract — check the source before working around it** — a prop you expected but cannot find means read the component source, never typecast past it. The recurring traps → `invariants.md` #44.

45. **A peek dialog is mounted by the app-root peek host, never by the thing that opened it** — a dialog kept inside the subtree that triggered it unmounts on that subtree's next re-render and closes itself; every `*PeekLabel` dispatches through `usePeekHost()`, holds no open state, and takes no `onPeek` prop. New-label shape and the one sanctioned hand-rolled case → `invariants.md` #45.

46. **Delete is cloned from the precedent, gated, and human-named** — clone `useCrudDeleteWired` + `adaptOrvalDelete` + `{deleteDialog}` on EVERY crud-page variant; `onDelete` activates only when `onDeleted` exists; the dialog names the record with a human-readable value, never an id. Purge distinction and server-block messages → `invariants.md` #46.

47. **A widened operator read never crosses the trust boundary** — a `readiness`-style wide read stays on operator surfaces; subject-facing surfaces (portal / kiosk / public) call a narrow read listing only what the subject can act on. What sharing it leaks → `invariants.md` #47.

48. **Red badges mean "act now" — and land on the view they count** — destructive-red counts only a set the viewer must act on, demotes to muted at 0, and the screen it leads to opens by default on exactly the set it counts. Query wiring → `invariants.md` #48.

49. **An always-open master-detail board pins the detail and auto-selects** — constant `activePanel="detail"` + `listWidth`, `onClose` omitted so no close affordance renders, first-item selection whose survival is judged by id, never by index. → `invariants.md` #49.

50. **Reference cards hide when empty; workstation cards never do** — read-only cards render nothing without rows; action-carrying cards always render with their empty-state hint. Segmented row-action groups → `invariants.md` #50.

51. **Precedent-first screens — a new screen is cloned from two precedents, never designed from memory** — before implementing a NEW screen (routed page, tab body, board, report, dashboard section, custom editor, dialog flow) or structurally reshaping one, run the precedent check (`customize/precedent-check.md`): classify the screen's shape, locate TWO precedent screens of the same shape (nearest sibling + best repo-wide match, preferring the most recently modified), read their full widget set end to end, implement by cloning their structure, and finish with a row-by-row parity pass. Divergence is justified only by a domain difference — never by preference; a precedent that itself violates an invariant is fixed or flagged, never copied and never averaged into a third variant. The completion report names the shape, both precedent files, and every justified divergence — a screen whose precedents cannot be named was designed from memory, and that is a defect.

52. **Every action affordance is gated on the permission its endpoint requires** — a button that leads to a call the server will refuse must not render. Gate with `useCan("<action>", SUBJECTS.<screenKey>)`, never an inline group literal; both header variants, a tree's per-row `add-child`, and buttons inside action groups. The audit script fails on an ungated `showNew`. Full wiring → `invariants.md` #52.

53. **A detail row's enum goes through `DetailBadgeField`, with its value resolved before it is passed** — the tone lookup uses the RAW `value`, so the boot-enum object makes every lookup miss and the badge silently renders `default`. Pass `value={resolveBootEnum(x) ?? ""}`; the scaffold emits the unresolved form, so every generated detail needs this fixed. Nullable-enum rows → `invariants.md` #53.

54. **The scaffold emits fields that say nothing — remove them at customization time** — strip `deleted` / `deletedTimestamp`, the entity PK, and the audit quartet from the columns, cards, detail, form, and filters; `CrudDetail`'s `auditData` slot already carries the audit values, and hiding means removing from source. → `invariants.md` #54.

55. **A message that tells the reader to reach a contact is written twice, and one hook picks between them** — `<key>` and `<key>NoContact`, chosen in ONE shared hook that owns the settings read. The check when writing any such string: does this page render the address it just told them to use? → `invariants.md` #55.

56. **A shared catalogue is edited key by key; a whole-file write re-reads inside the same step** — locale catalogues (`modules/<domain>/src/locales/**/*.json`) and codegen output are appended to by many tasks that never otherwise touch the same file. The hazard is not two writers at one moment; it is ONE writer that reads the file early, works for a while, and writes the whole file late. Everything added in between is silently gone — the keys vanish, the widgets naming them stay, and the screens print `<namespace>.<key>`; nothing errors, and git shows a plausible small diff because the lost keys were never committed. When a whole-file write is genuinely needed (a scripted bulk edit, a sort, a reformat), re-read the file inside the same step that writes it. A sudden crop of the audit's `missing-translation-key` error across files you did not touch is this, not somebody forgetting their keys.

57. **A client-generated idempotency key is scoped to the payload it guards, never to the screen or the record it was reached from** — a key scoped to something coarser (the plan, the entity, the tab) survives the user going back and CHANGING the form, so the server answers the new basket with the old record and the screen after the submit shows values nobody typed: a cross-screen disagreement no test catches, because both screens are individually correct. Derive the stored key from the submitted values, keep it under a scope string built from them, and release it once the record it wrote can no longer move (paid, closed, cancelled) so a second identical purchase is a second record. The release half is the one that gets written and never wired — a `clearX`-style helper with no importer means the flow does not have it.

58. **`overflow` on one axis silently makes the other `auto` — so measure the geometry, never hide the scrollbar** — a wrapper that only wanted sideways scrolling paints a vertical scrollbar the moment its content overflows the block direction by one pixel, and the element reporting the overflow is often not the one the reader points at. Locate it, then fix the arithmetic (`outer height − borders − vertical padding ≥ child height`), proving it with numbers rather than by eye. Hiding it (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`, an `overflow-y: hidden` patch) leaves the content clipped with no way to reach it, and for a framework component the geometry is wrong in the framework, not in the consumer that made the symptom visible. Locator snippet and the full arithmetic → `customize/framework-components.md` § Overflow and scroll geometry.

59. **A preference that outlives a session gets its own namespace, outside any token-store prefix** — `localStorageStore(prefix)` / `sessionStorageStore(prefix)` clear by sweeping every key starting with `prefix`, and signing out calls that clear. A stay-signed-in preference written to `"<prefix>remember-me"` is therefore erased by the one act it has to outlive: the box comes back unchecked on the sign-in screen the operator was just returned to. Nothing errors and the token handling is correct throughout — the key is simply inside the blast radius of a prefix sweep. Give any preference that outranks a session its own namespace (`"<app>.prefs:<name>"`), and when reading a store's `clear()`, ask what else lives under that prefix. Same trap for any non-token value parked beside the tokens for convenience: a last-used tenant, a remembered sign-in address, a "do not show again" flag.

60. **A context-owning package resolves to ONE copy — name the framework packages in `resolve.dedupe`, and prove it after every resolution change** — pnpm splits one version into two physical copies whenever two importers' peer sets differ, and a provider rendered from one copy is invisible to a consumer importing the other: chrome vanishes with a clean build and correct-reading source. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-duplicate-contexts.mjs"` after any change to dependency resolution, and run it FIRST when chrome is missing — one command rules out the resolution half of that symptom. Full mechanism, the two-cause missing-chrome triage, the linked-checkout variant, and the RN/Metro caveat → `invariants.md` #60.

61. **Hiding a surface is not the same as not asking for it — the gate belongs beside the request** — a hook runs wherever it is written, so a screen that gates only its JSX still fires the read the server refuses, and the user gets a bare "access denied" dialog over a panel with nothing on it to explain the refusal. Put the condition where the request is (the hook's `enabled`, the shared factory's `useEnabled`), never only at the route or the parent that composes it — a caller that forgets is then impossible rather than merely unlikely. Check the framework for an existing gate channel before inventing one. And drop the affordance too: a filter or picker left standing with an empty option list reads as "failed to load", not as "you did not buy this". Symptom catalogue, the three shapes it takes, and why this is not a script rule → `invariants.md` #61.

62. **A screen with no list beside it still lays out in columns** — the two-column rule is written for a `CrudDetail` panel a few hundred pixels wide, and a settings page, a single-record editor, a preferences tab or a wizard step has no panel to be narrow. At 1440px a stack of short fields draws each input a thousand pixels wide for a value of twenty characters. Give the content columns, cap the measure, and **judge by the rendered input rather than by the component name** — a screen that never imports `FormFields` is still a form when it draws `<Label>` + `<Input>` pairs or a bare `<select>`, and a survey counting framework component names walks straight past the one screen most likely to be laid out wrong. Full rule → `customize/consistency-checklist.md` § 2b.
63. **Tab strip, chip filter and rows sit together, in that order, with nothing between them** —
    and **anything** means anything: a tile row, a banner, a help card, a rule, a heading, a
    caption, a view-mode button. Both controls narrow the same set, so read down the screen they
    are the two cuts in the order they apply — the tab picks the set, the chips pick inside it —
    and the rows follow immediately under the last thing that changed which rows they are. Chips
    drawn *above* the strip are a second strip with nothing saying which of the two the reader is
    inside.
    - **A number that counts one set directly above a table showing another reads as counting that
      table**, and the caption written to explain the difference is the layout confessing: a
      sentence saying why two figures on one screen disagree means the arrangement is wrong, and
      the fix is to make the figures agree, to label what each counts, or to move the tiles out —
      never to add the sentence.
    - **A message the chip selection needs goes to the right of the chips, on their row** —
      `<Flex align="center" gap="sm"><ChipFilter …/><Text size="caption" tone="muted">…</Text></Flex>`,
      never a line of its own under the chips and never a band over the table. The row is one flex
      line, so whatever else belongs beside the chips (an unbuilt layer, a count) sits there too;
      that is the one place the rule leaves open, and it is open because a note beside the control
      it describes is read as belonging to that control.
    - **A notice true of one tab only goes under that tab's rows**, not over them — a footnote is
      read after the thing it annotates. A notice true of every tab goes above the strip.
    - **A heading inside a tab panel repeating the tab's own name is deleted, not moved.** The tab
      the reader just pressed already said it.
    - **Sibling tab panels and the list's own states are not "between".** `TabsContent` /
      `PageTabPanel` siblings are alternatives, and the arms of the conditional that draws the rows
      (`{isLoading ? <Skeleton/> : rows.length === 0 ? <EmptyState/> : <Table/>}`) replace the table
      rather than stand over it.

64. **Every chip carries a mark, and the mark says whether this chip is on** — a chip row and a
    tab strip are the same shape at a glance and a reader cannot tell which one narrows, so the
    row has to say before it is pressed both that pressing narrows and which option is narrowing
    now. An empty ring when the chip is off and a check when it is on carries both in one mark;
    the pill shape (`rounded-full`, muted ground, solid when chosen) is what separates the row
    from the strip above it. **A chip supplying its own icon gives that up** — a colour dot or a
    count replaces the mark — so pass one only where the chip's own colour already says whether
    it is on.
    - **The chips flow from the left at their label's width and wrap**, never stretched to divide
      the row evenly. Stretched, an option's width is decided by how many options happen to sit
      beside it: the same filter is a segmented control on one screen and chips on the next, and a
      two-option filter draws two half-page buttons.

65. **Actions belong to the panel footer, in two rows when one will not hold them** — a button row
    in the panel body is a region the reader has to find, and the footer is pinned where the eye
    already ends. Where the count outgrows one row, the second row carries the secondary verbs and
    the committing verb stays on the last.

66. **A field that names another record peeks at it, never travels to it** — a detail field, list cell or panel row whose value is another record's NAME renders that name plus the peek trigger, and the trigger opens that record in the host-mounted dialog (#45); the dialog's go-to is the only way out of the screen. Two shapes break it, and the second does not even navigate: a `<Link>` in a field, and a link-styled button wired to the panel's own `onSelect` — which replaces the record under the reader, same panel, same chrome, different subject. A link is right only when the destination is a screen rather than a record, and then it belongs in the action row. Peeks stack. **The failure mode is disuse**: build the machinery, use it once, and every screen written afterwards reaches for a link because nothing fails when it does — so the rule needs a detector in the project's own gate script, never a paragraph. → `invariants.md` #66.

---

## Task Router

Identify the task, Read the referenced file(s), THEN work — the routed Read happens before the first edit, not after and not in parallel. Do not preload everything. All paths below are relative to this skill's own `references/` directory.

### 1. DESIGN — Framework contracts & API layer

Trigger: defining API contracts, deriving hooks, setting up mock workers, configuring `simplix.config.ts`, debugging type derivation, writing tests with `@simplix-react/testing`.

1. Overview & philosophy → `framework/overview.md`
2. `defineApi` / `deriveEntityHooks` patterns, query builder, auth, cache → `framework/api-patterns.md`
3. Complete end-to-end recipes (new contract, new entity, adding operations) → `framework/recipes.md`
4. `simplix.config.ts`, codegen, mock worker configuration → `framework/configuration.md`

### 2. SCAFFOLD — Domain packages & UI modules (FIRST when backend changed — see invariant #29)

Trigger: backend OpenAPI spec changed (new endpoints / renamed fields / new enum values / new tags); new domain not in `packages/`; `add-domain` / `openapi` / `add-module` / `scaffold` CLI; route / mock / sidebar-menu wiring.

1. Overview, CLI workflow, Initial + Update paths, detection recipes → `scaffold/overview.md`
2. Route & widget scaffolding patterns → `scaffold/patterns.md`
3. Props / callback conventions across scaffolded widgets → `scaffold/props-conventions.md`
4. Post-scaffold customization of a new screen — precedent check (invariant #51) → `customize/precedent-check.md`

### 3. CUSTOMIZE — Widget modification & composition

Trigger: creating any NEW screen or structurally reshaping one (precedent check FIRST — invariant #51), building a settings page / single-record editor / preferences tab that has no list beside it (invariant #62), modifying generated list/form/detail widgets, building custom editors, composing `CrudList` / `CrudForm` / `CrudDetail`, adding layout primitives, wiring mutations/invalidation/unsaved-changes guards, creating map pages, creating tree views.

1. Precedent check — MANDATORY before building a new or reshaped screen (invariant #51) → `customize/precedent-check.md`
2. Overview & framework-first philosophy → `customize/overview.md`
3. Available framework components (catalog) → `customize/framework-components.md`
4. Customization recipes (add column, add action, wire mutation, custom editor) → `customize/recipes.md`
5. CRUD page consistency checklist (list trim, two-column detail, cards, embedded lists, peek) → `customize/consistency-checklist.md`
6. Date/time encoding · decoding · display timezone (invariant #42) → `customize/datetime-fields.md`

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

- [ ] All 66 Non-Negotiable Invariants hold
- [ ] Every action affordance gated on its endpoint's permission (#52) — both header variants, tree `add-child`, and buttons inside action groups; group read from `SUBJECTS`, never inlined
- [ ] Precedent parity pass done (new / reshaped screens — #51): comparison sheet walked row by row against both precedents, screens compared in the browser
- [ ] Completion report (in conversation — never recorded in files) names the Task Router references consulted and, for screen work, the shape + both precedent files + justified divergences (#51)
- [ ] No `generated/` drift — `git status packages/domain-<name>/src/generated/` clean, OR generated changes committed together with widget / mock seed / locale updates (#29/#30)
- [ ] `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs"` clean (0 error-level hits; review candidates judged, not bulk-rewritten)
- [ ] Dependency resolution changed this task (version bump, new dependency, link-profile switch, any `pnpm install` that rewrote the lockfile)? → `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-duplicate-contexts.mjs"` clean (#60)
- [ ] AUDIT run (if CUSTOMIZE touched existing modules) — `audit/audit-checklist.md`
- [ ] DOCUMENT run (if exports / APIs / user-facing surfaces changed) — `docs/quality-checklist.md`
- [ ] Backend data / translation gaps implemented or raised (if DTO gaps found)
- [ ] Build verification passed — the project typecheck / lint / build gate
- [ ] User-facing screens driven in a browser as the persona who owns them — invoke the `simplix:frontend-e2e` skill. A feature whose screens have never been walked by hand (create → act → reverse, as the operator and as the approver) is unverified, no matter how green the build is.

---

## A Rule Discovered While Working Goes Straight Into Its Home

Never left in the session, and never staged — a staging area is where an entry waits to be
promoted and instead gets read past. Where it lands depends on how far it generalizes and
what kind of thing it is:

| The discovery is | It becomes |
| --- | --- |
| Specific to this project (its packages, its domains, its policy decisions) | an entry in the project's own reference under its `.claude/` — this skill ships read-only from the plugin install, so a project fact does not belong in it |
| True of any simplix-react project, and mechanically detectable | a rule in `${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`, proved to fire on the defect and stay silent on the fix |
| True of any simplix-react project, and a judgment call | a new **invariant** here when it binds every task, otherwise a section in the reference that owns the topic — `framework/*` for contracts and the install, `customize/*` for widget work, `audit/*` for commonization, `docs/*` for documentation |

Write it with placeholders (`<scope>`, `<domain>`, `<entity>`) and neutral example
vocabulary. Where the plugin is a checkout rather than an install, edit it in place and say
which file changed; otherwise report the entry so it can be added.