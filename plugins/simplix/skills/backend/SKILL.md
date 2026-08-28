---
name: backend
description: MANDATORY handbook for ALL Java work in a SimpliX Spring Boot project — a repository whose classes extend `SimpliXBase*`, whose endpoints return `SimpliXApiResponse`, or which has a `.simplix/` generator directory; skip stock Spring Boot repositories with none of those markers. Invoke on the session's first backend-touching task, before reading, writing, reviewing, or explaining any Java file there — SimpliX deviates from stock Spring Boot in subtle ways (response wrapper, base classes, DTO shape, exception types, permission names, annotation order), so working from memory produces defects. Trigger on ANY cue implying Java work: controller, service, entity, DTO, repository, CRUD, endpoint, REST, JPA, `@RestController`, `@Entity`, `@PreAuthorize`, `@SearchableField`, `yo simplix` — or a request to add a field, fix an endpoint, add a filter, review DTOs, or run the generator. Never skip on "this is simple". Once invoked in a session, do not re-invoke.
version: 1.0.0
---

# SimpliX Backend Development Handbook

Single source of truth for backend Java work in a SimpliX project. SimpliX is a Spring Boot extension framework providing the base classes that generated code extends: `SimpliXBaseController` (a thin `@SimpliXStandardApi`-annotated base that holds the service — the **11 CRUD endpoints are emitted into the concrete subclass by the generator controller template, not inherited from the base class**), `SimpliXBaseService` (entity operations + search), `SimpliXBaseRepository` (enhanced JPA), and `SimpliXApiResponse` (standard API envelope). All conventions below enforce consistency with this framework.

## How to Use

1. Use the **Task Router** below to find your task category → Read the referenced files
2. **Before writing ANY controller/service/DTO, run the generator-first gate (invariant #15).** It is the top-priority decision: any REST surface backed by a single entity MUST be scaffolded via `yo simplix:generate` → `promote` → customize — never hand-written from scratch. Only entity-less/aggregation surfaces may be hand-authored. This check comes FIRST, before you consider annotations, DTOs, or anything else.
3. **Past the generator (customizing, or a permitted hand-authored surface), run the precedent gate (invariant #19)** — locate two same-shape precedent surfaces and read them end to end before writing.
4. Then review the rest of the **Non-Negotiable Invariants** — especially #2 (`@PreAuthorize`), #8 (constructor).
5. After writing, verify all 20 invariants hold per the **After Writing** checklist.
6. **Check the project's wiring once per session** (see below) and offer `/simplix:init` when a piece is missing.

### Project wiring — check on load, offer once

Two halves make this handbook hold: the routing block in the project's instruction file, and the gate config in `<subproject>/.claude/simplix.json` that lets the plugin's hooks enforce it. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json` and read `routedBy` and this subproject's `skillGate`.

Without `routedBy`, a session that starts elsewhere in the repository never learns this handbook binds. Without `skillGate`, an edit written from memory is not refused, and drift lands before anyone reads a reference.

When either is missing, say so in one sentence each — the user has no reason to know this wiring exists — and offer `/simplix:init`. It shows what it will write and writes nothing without agreement. Offer once per session; if declined, continue and do not raise it again.

---

## Scope — What This Handbook Covers

These Invariants apply to **REST controllers, their services, repositories, and DTOs**. Out of scope — covered by separate Spring configuration, not this handbook:

- **View/Template controllers** (`@Controller` returning view names or `ModelAndView`) — protected via `HttpSecurity` URL-pattern rules, not method-level `@PreAuthorize`. They do not return `SimpliXApiResponse`.
- **Infrastructure beans** — `@Configuration`, `@Component`, `@Bean` factory methods, `@EventListener` handlers, Spring Data listeners, Quartz/ShedLock scheduler jobs, payload/DTO records, and JWT/security filters. Located in `app.*` packages as the default, but also permitted in `web.*.{scheduler,config,listener,factory,helper,stream}.*` when the feature owns its own infra. For these, `@RequiredArgsConstructor` is acceptable and the generator-shape invariants (1–17) do not apply. Invariant 18 (date/time typing & timezone policy) is NOT exempt — its zone rules bind all Java code including schedulers and infrastructure. REST-surface invariants kick back in the moment the class becomes a `@RestController`/`@Service` extending SimpliX base classes.
- **Schedulers/Listeners** that consume domain events — no HTTP surface; response-wrapper and `@PreAuthorize` rules are moot.

When unclear whether a class is REST or View, check: does it return `SimpliXApiResponse<T>` / a DTO, or a `String` view name / `ModelAndView`? The return type decides.

---

## Non-Negotiable Invariants

Apply and enforce these on every controller, service, repository, and DTO you touch. Treat each as inviolate unless the invariant itself names an exception.

1. **Response wrapper** — return `SimpliXApiResponse<T>`, never `ResponseEntity<T>`. **Two exceptions only**:
   - **Binary streaming** — `ResponseEntity<Resource>` for image/file bytes. On the binary path, error cases must still route through `throw new SimpliXGeneralException(ErrorCode.xxx, ...)` — NOT `ResponseEntity.notFound().build()` — so the global handler produces the standard `SimpliXApiResponse` error envelope.
   - **Async command (202 Accepted + Location)** — `ResponseEntity<SimpliXApiResponse<T>>` is acceptable ONLY for fire-and-poll commands that must return 202 and a `Location` header pointing to a polling endpoint (RFC 7231 §6.3.3). Outside this pattern, `ResponseEntity<SimpliXApiResponse<T>>` is a double-wrap violation.
2. **Security** — every endpoint has `@PreAuthorize`. Public? → `permitAll()`. User-self? → `isAuthenticated()`. Dev/test profile is NOT a substitute.
3. **Exceptions** — throw `SimpliXGeneralException(ErrorCode.xxx, message, null)`. Never `IllegalArgumentException`, `RuntimeException`, or `ResponseStatusException`.
   - **Message = `{error.<domain>.<key>}` placeholder, resolved ONLY at the HTTP layer.** The dominant convention passes the literal placeholder (e.g. `"{error.channel.publishNotAllowed}"`); `GlobalExceptionHandler` (app-core) resolves it to the request locale when building the response envelope. The exception constructor performs NO resolution, so `getMessage()` carries the raw key **by design** — everywhere below the HTTP layer, including logs and tests.
   - **Error key bundles** live in `apps/<app>/src/main/resources/messages/errors*.properties` — add every new key to EVERY locale the project ships. `ExceptionMessageTranslationTest` (in the app module) scans source for `"{error.*}"` literals and `MessageUtils.get(...)` calls and fails the build on any key missing a translation or any cross-locale bundle drift — it is the single owner of message-text coverage.
   - **Unit tests assert the message KEY, never resolved English prose** — `hasMessageContaining("error.channel.publishNotAllowed")`, not `hasMessageContaining("Publish")`. Mockito service tests have no Spring context: `{key}` placeholders stay raw, and `MessageUtils.get(key, args)` returns the code itself with args dropped (its static `MessageSource` is never initialized). English-prose assertions are valid ONLY for the minority pattern where the service resolves at throw time via an injected `MessageSource` that the test stubs (`when(messageSource.getMessage(...)).thenReturn(...)`).
4. **Repository** — `extends SimpliXBaseRepository<E, String>`. Never plain `JpaRepository`.
5. **DTOs** — entity-backed DTOs MUST be static inner classes of `{Entity}DTOs` (one container file per entity). **Exception for DTOs with no matching `.simplix/entity/*.yml`** (projections, statistics, aggregation results, inter-service payloads): MAY be defined either (a) as separate top-level DTO files or (b) grouped in a feature container `{Feature}DTOs`. Prefer the container when the DTOs share a feature and lifecycle; use separate files when they are independent or reused across features.
6. **SearchDTO Lombok** — `@Getter @Setter`. Never `@Data` (SearchDTO is a search-condition container, not an identity-bearing object; `@Data` generates equals/hashCode that cause framework-internal comparison issues on large DTOs).
7. **Boolean in DTO** — `Boolean` wrapper. Never primitive `boolean` (getter-naming breaks framework lookups — `isXxx()` vs expected `getXxx()`).
8. **Constructor** — explicit. CRUD classes call `super(...)` from the constructor body. Never `@RequiredArgsConstructor` or `@Autowired` field injection in `web` package. Acceptable ONLY in `app` package infrastructure (`@Component`, `@Configuration`).
9. **Permission name** — UPPER_SNAKE feature-area group in `hasPermission('GROUP', 'action')` (e.g. `'CONTENT_CHANNEL'`, `'FACILITY_HARDWARE'`). Related controllers share ONE group target; per-entity PascalCase targets are forbidden. Grep the existing `hasPermission('` targets before inventing one, and pick the group already covering the feature area; add a new group only when a genuinely new feature area appears. When the project keeps an authoritative group table (a policy reference under its own `.claude/`), that table wins. Actions are limited to the nine the evaluator resolves: `list`/`view`/`create`/`edit`/`delete`/`export`/`import`/`approve`/`manage` — any other verb can never be granted.
10. **`@Tag(name)`** — domain-based namespace (`facility.identity.Credential`). Never Java-package-based (`{basePackage}.web.Monitoring`).
11. **`@Operation`** — every endpoint has `@Operation(summary = "...", description = "...")`. Concise API-consumer summary; do not duplicate validation constraints.
12. **`@FieldLabel`** — required on every SearchDTO and CreateDTO field (`@FieldLabel("{entities.Entity.field}")`), so validation errors use the translated label. **Exception**: audit fields (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`) are BaseEntity auto-managed and excluded from `@FieldLabel`. **Virtual/derived fields** (populated from another entity's field, no column of their own) reuse that source entity's existing key `{entities.<SourceEntity>.<originalField>}` — never a new `{field.*}` key; `{field.*}` is only for genuinely generic field names. See AP-9 in `convention/anti-patterns.md`.
13. **`@Validated`** on `@RequestBody` — follow the generator's pattern: single DTO (Create/Update/UpdateForm/BatchUpdate) → yes; `List<OrderUpdateDTO>` → yes; `SearchCondition<SearchDTO>` → yes; bare `Set<UpdateDTO>` (multiUpdate) → no (validation cascades per element anyway).
14. **No debug logs by default** — no `@Slf4j` + `log.debug/info` in controllers or services unless explicitly requested. The global exception handler logs errors; controllers/services do not. For business-event recording (user action, state change, security event), write an `AuditEvent` entity — not a log statement. Credential-adjacent flows (password verify/change, token issuance) must NOT log any identifier, hash, or length via `log.debug/info` — even at DEBUG level, this is a data-leak risk.
15. **Generator-first, always — this is the TOP-PRIORITY gate; run it BEFORE writing any controller/service/DTO.** For every entity you add, and every REST surface you build, the FIRST question is "can the generator produce this?" — not "how do I write this class?". Skipping the generator is the single most common way this module drifts, so it is checked before all other invariants.

    **Why this is the top rule:** the generated OpenAPI contract is what the frontend's CLI codegen turns into a full `CrudList` screen (list → search → view → edit → delete). Hand-written backend endpoints produce no such contract shape, so the frontend must build every screen by hand. Generator-first is therefore load-bearing for the whole full-stack pipeline, not a backend style preference.

    **① Decision procedure (run once per new REST surface, before typing any Java):**
    - **A `@Entity` with its own table that any admin/user screen lists, views, or edits** (CRUD, or an action/read surface over one entity — e.g. an `Order`, an `AssetAssignment`, an `IncidentEvent`, an audit table like `InspectionResult`, an invitation/delegation/credential row) → **MUST** `yo simplix:config` → edit yml → `yo simplix:generate` → `yo simplix:promote --module <m>` → THEN customize (add actions, trim endpoints). Never hand-write it from scratch. Even a "non-CRUD, action-only" or read-only-audit surface over one entity is generate-then-trim.
    - **Internalized child entity** (managed only through its parent's editor, no independent list/search — `entity/child-entity-patterns.md`; e.g. `OrderLine`↔`Order`, `ChecklistEntry`↔`Inspection`) → no controller, and **delete its `.simplix/entity/*.yml`** so it is never generated. This is the ONLY `@Entity` exemption.
    - **Not a `@Entity`** (a JSON-column value object / POJO, e.g. a step-spec inside a JSON field) → cannot be generated; no table exists.
    - **Entity-less or multi-entity aggregation** (no single backing table — dashboards, reports, cross-entity actions, token/device-authenticated portals) → hand-authoring in canonical non-CRUD shape is permitted (there is no entity to scaffold from), and invariant #17 governs the shape. Document the reason in a one-line class JavaDoc.
    - When unsure which bucket, default to generate-then-trim. "It's just a read/audit surface" is NOT a reason to hand-write — generate it read-only.

    **② Three rules govern the generate → promote → trim path itself**, and each fails silently when skipped: the **pre-generation collision check** (`promote` overwrites `src/` without asking, so a hand-authored `XService` is clobbered by the generated one), **manual trimming verified after each cut** (a script that bulk-deletes endpoints eats the constructor), and **the promoted `*ServiceTest` going stale with the service it tests**. Full rules → `generator/promote-workflow.md`.

    **③ Two contract rules bind every generated surface:**
    - **List-serving endpoints must be paged searchable.** Any endpoint that feeds a frontend list whose row count can grow (accumulating records, per-user histories, request queues — when in doubt, assume it grows) MUST expose the standard searchable surface from the controller template: `@SearchableParams(SearchDTO.class) Map<String, String>` → `service.search(params)` → `Page<ListDTO>`. Self-scoped or aggregated surfaces keep the same shape and force their scope conditions server-side on top of the client params (overwrite the scoped keys; client filters may only narrow). Returning an unpaged `List<T>` for such data is a defect — the frontend pairs every list screen with CLI-scaffolded `CrudList` pagination/filtering, which requires this contract. This backend-first, template-based path is ALWAYS the first implementation method considered for list screens.
    - **SearchDTO PK must be sortable AND accept `IN`.** Every SearchDTO's entity-ID field MUST carry `@SearchableField(operators = {EQUALS, IN}, sortable = true)`, and the scaffold emits neither half. Without `sortable` the scaffolded list's very first request fails, because the frontend's default list sort is `<entityId>.desc`. Without `IN` the list's own filter for that entity is dead: it resolves the labels of what is selected by asking the entity's own search endpoint for those ids at once (`<entityId>.in=a,b,c`), and the whole request is refused the moment a value is picked — on every list that offers the filter, including other modules', since the filter is shared. The asymmetry that hides it: the same id declared as a FOREIGN key elsewhere is routinely `{EQUALS, IN}` and works, so only the entity's own list carries the defect. Details, both verification requests, and a spec-wide sweep → `review/searchable-field-patterns.md` § PK Contract.
16. **i18n mandatory** — every entity (for labels) and every LabeledEnum (for values) has properties files in every locale the project ships, before domain tests pass. **LabeledEnum message keys are `enums.{SimpleName}.{CONSTANT}` and are merged globally across the classpath, so every LabeledEnum simple class name MUST be globally unique** — two enums sharing a simple name (even in different packages/modules) collide on the merged key and silently mistranslate. Resolve any collision by renaming one enum (and migrating its keys in every locale) or, if both model the same concept, merging into a single enum.
17. **Match generator shape, even when writing by hand** — any controller, service, repository, or DTO authored manually MUST be indistinguishable in shape from what `yo simplix:generate` would have produced:
    a. Extend correct base class: CRUD → `extends SimpliXBaseController<E, String>`; Non-CRUD → `@SimpliXStandardApi` at class level
    b. Annotation order: `@RestController → @RequestMapping → @Tag → class`
    c. URL shape: no `/api/v1/` prefix on `@RequestMapping`
    d. `@PreAuthorize("hasPermission('Entity', 'action')")` — exact wording
    e. `@PathVariable String` — never `UUID` or `Long`
    f. Return type: `SimpliXApiResponse<T>` (or documented binary/202-async exceptions only)
    g. No `@ApiResponses` block
    h. Unexplained deviation → one-line class-level JavaDoc required
18. **Date/time semantic typing** — every temporal field belongs to exactly one semantic kind, and the kind fixes the Java type: absolute instant → `Instant`, calendar date → `LocalDate`, wall-clock time → `LocalTime`, calendar period → fixed-width `yyyy-MM` String (validated). NEVER a String column carrying an offset/RFC 3339 datetime, and never `LocalDateTime`/`OffsetDateTime`/`ZonedDateTime` entity fields (SimpliX's auto-applied converters UTC-normalize them). SearchDTOs use the same temporal types — range operators and `sortable` on a String date column are forbidden (VARCHAR comparison is lexicographic, not chronological). Wire/SDK date strings are produced at the transmission boundary (SU mappers, site timezone), never stored. Timezone-dependent logic never reads the JVM default zone (argless `LocalDate.now()`, `ZoneId.systemDefault()`, …) — resolve a `ZoneId` explicitly in this order: site (`Site.timezone`, IANA ID) → domain operation-policy default zone → app timezone (configured; never a hardcoded zone literal). This zone rule applies to ALL Java code including schedulers/infra. Field patterns and the full zone-resolution rules: `entity/field-types.md` § Date/Time Fields; violations catalogued as AP-27/AP-28.

19. **Precedent-first for everything past the generator — customization and hand-authored surfaces are cloned from the newest same-shape precedent, never designed from memory.** The generator fixes the CRUD shape (#15/#17); this invariant fixes everything the generator does not: trimming a generated controller into an action/read surface, adding lifecycle endpoints, a self-scoped searchable, a readiness/preview endpoint, an aggregation/report controller, an approval-flow integration, an SSE/activity channel. Before writing one, locate TWO precedent surfaces of the same shape in this codebase (grep the pattern: `@SimpliXStandardApi` non-CRUD controllers, forced-scope `search(params)` overrides, existing `/{id}/<action>` groups), prefer the most recently modified, read them end to end (controller + service + DTOs + messages), and clone their structure — naming, error keys, permission mapping, DTO roles, test shape. Divergence is justified only by a domain difference; a precedent that violates an invariant is fixed or flagged, never copied. The completion report names both precedent classes and every justified divergence. This mirrors the frontend skill's invariant #51 — the two ends of one contract must drift-proof the same way.

20. **A read that takes a workplace, organisation, or tenant identifier FROM THE CALLER is judged against the caller's own grants before the first query — and where a helper does the judging, the helper is named in the method's javadoc.** A `@PreAuthorize` is not this check: it asks whether the account may perform the action at all, never whether this particular scope value is one the account was granted. The two questions look identical at the call site and are not, so an endpoint carrying `hasPermission('GROUP','view')` and taking `@RequestParam String siteId` has answered only the first.

    **The second half is the half that pays.** This defect is an ABSENCE — a guard line missing where nothing marks its place — so it is invisible to any audit script, and its neighbours make it worse rather than better: a guarded method and an unguarded one over the same subject are identical in signature, annotations, and repository calls, differing only in a line that is not there. Naming the guard in the javadoc (`the workplace is judged by {@code requireVisible} before anything is read`, or `scoped through {@code range()}`) is what makes a reviewer able to see the absence, and it costs one line. Where the method is deliberately installation-wide, say so in the same place with the reason — a bare absence and a considered exemption must not read the same.

    **Verify it with a request, not a rule.** The guard is usually one or two frames down a private helper, so a regex over the method body has a false-positive rate that makes it useless, and following the calls is a call-graph analysis with the same floor. But the ENUMERATOR is exact where the guard is not: `@RequestParam … String <scopeField>` on a controller method is lexically obvious and mechanically complete. So list the endpoints mechanically and ask each one with real requests from a scoped account — the answer is unambiguous in a way no source read is. **Assert both directions**: an out-of-scope value is refused AND an in-scope value is answered, because a suite proving only the refusal passes a build whose guard refuses everybody, and the next person "fixes" that by deleting the check. Where a surface narrows within an already-bounded set instead of refusing, assert that its answer for an out-of-scope value is identical to its answer for a value that does not exist — and that an in-scope value differs from it, or the assertion is also satisfied by an endpoint that ignores the parameter.

    **A count leaks as much as a record.** Judge by what the answer tells the caller, not by whether entities cross the boundary: 「220 people are registered at that workplace」 is information about a workplace the caller was not granted, and no list-scoping test on any screen will ever see it. The figure that hides longest is the one on a tile whose neighbours are all correctly narrowed — a number right in five places and wrong in the sixth reads as a scoped screen.

    **Where a static rule CAN reach this, it is comparative — two neighbours over one subject disagreeing about whether to check.** An absolute rule (「a read taking a scope identifier must check it」) drowns, because whether a given read should be scoped is a product question: a shared catalogue is the installation's and everyone reads all of it. But a class that already narrows one read has imported the range, named it, and decided which axis the subject sits on — so a second read in the same class taking the same kind of identifier and never mentioning it is one decision left half-applied. That rule judges nothing about what is legitimate; it only asks why two neighbours disagree, which is why it can be written at all. **Three exclusions make the difference between usable and useless**, and each is a false-positive class somebody will otherwise re-derive by widening the rule: overloads (a name-keyed call graph resolves a short form's call to its long form back to the caller itself), controllers (they reach the range through the service by design), and the scope classes themselves (they define the vocabulary rather than call it).

    **Give the read side its own vocabulary rather than the write side's.** A write refuses ONE record, so it always ends at a `require…`; a read far more often BOUNDS A SET and lets the caller's identifier narrow inside it. A rule that inherits the write vocabulary calls every correctly bounded count a defect. And drop any bare `narrow*`-shaped word from the read list: on a write path it is nearly always the range, while on a read path it is routinely a filter resolver — one such method made a whole class read as scope-aware while it resolved every value against a caller-named identifier with no range anywhere in the file.

    **The blind spot ships with the rule, as its own warning.** A rule comparing a class against itself is silent on a class that never heard of scope — and that is where the worst instance lives, because there is no neighbour to disagree with. Report it separately and grade it a warning, since a legitimate class produces the same finding and only a person settles it. Green over the hole the rule cannot see is worse than no rule at all: everybody stops looking.

---

## Task Router

Identify the task, Read the referenced file(s), then work. Do not preload everything — lazy-load on demand. All file paths below are relative to this skill's own `references/` directory.

※ **New entity with CRUD API**: follow DESIGN → GENERATE → WRITE in order.
※ **Multi-category task**: identify all relevant Router entries first, then batch-Read all files in a single parallel call.

1. **DESIGN** — Entity structure
   - New entity from scratch → `entity/base-entity-patterns.md`
   - Field type (String, Boolean, Enum, i18n, JSON, PII, date, number, sort) → `entity/field-types.md`
   - Relationship (`@ManyToOne`, `@ManyToMany`, `@OneToMany`) → `entity/relationship-patterns.md`
   - Hierarchical / tree entity → `entity/tree-entity-patterns.md`
   - Child entity internalized (no independent API) → `entity/child-entity-patterns.md`
   - PII / encryption / GDPR → `entity/entity-security-patterns.md`
   - Repository interface → `entity/repository-patterns.md`
   - `.simplix/entity/*.yml` → `entity/yml-configuration.md`

2. **GENERATE** — Scaffold & promote (`yo simplix:*` is a Yeoman-based code generator; run from project root)
   - First-time config + generate → `entity/yml-configuration.md`
     1. Design entity 2. Write i18n for every locale 3. Run domain tests
     4. `yo simplix:config` 5. `yo simplix:generate` 6. Build & review
     7. `yo simplix:promote` 8. Customize within Invariants
   - Promote generated → src → `generator/promote-workflow.md`
   - Edit `.java.template` → `generator/template-customization.md`
   - Generator error → `generator/troubleshooting.md`

3. **WRITE** — Author controller, service, DTO
   - **STOP — run invariant #15's generator-first gate BEFORE reading these.** Backed by one entity → generate → promote → customize (never hand-write). Only entity-less/aggregation surfaces are hand-authored. And run the pre-generation collision check: if a hand-authored `X{Service,RestController}` already exists, rename it or don't generate `X` — `promote` overwrites silently.
   - New CRUD controller + service → `convention/canonical-controller.md` + `convention/canonical-service.md`
     ※ MUST scaffold via generator first — generate → promote → customize
   - New non-CRUD controller → `convention/non-crud-controller.md`
     ※ Backed by one entity → generator-then-trim (generate as CRUD → promote → trim → add `@SimpliXStandardApi`). Hand-authoring is permitted ONLY for genuinely entity-less/multi-entity surfaces: no backing DB entity, multi-entity aggregation, token/device-authenticated portal, dev/test-only controller. `@MapsId` dependent entity and user-self-over-one-entity are still generate-then-trim.
   - Add endpoint to existing controller → Read `convention/canonical-controller.md` for the endpoint template; for binary/async exceptions additionally verify invariant 1
   - Modify existing code → Read surrounding code first. For convention drift, also check `convention/anti-patterns.md` + `review/common-issues-checklist.md`. Invariants apply.

4. **REVIEW** — Validate DTO, annotation, code quality
   - DTO structure / 8 DTO roles → `review/dto-type-reference.md`
   - Entity → DTO field mapping → `review/entity-to-dto-mapping.md`
   - Validation (`@NotBlank`, `@UniqueFields`) → `review/validation-patterns.md`
   - FK / entity ref (`@JsonIncludeProperties`) → `review/reference-field-patterns.md`
   - i18n pairs (`@I18nTrans`, `@JsonIgnore`) → `review/i18n-field-patterns.md`
   - `@SearchableField` on SearchDTO → `review/searchable-field-patterns.md`
   - "Something is wrong" — triage → `review/common-issues-checklist.md`

5. **CHECK** — Convention or quality lookup
   - Annotation ordering (class + method) → `convention/annotation-ordering.md`
   - JavaDoc formatting → `convention/javadoc.md`
   - Common anti-patterns → `convention/anti-patterns.md`

6. **SYNC** — Cross-subproject coordination (after the OpenAPI contract changes)
   - Trigger: new / renamed / removed endpoint, DTO field, enum value, or `@Tag`.
   - **Flag — do not execute — the frontend update.** The frontend subproject derives `packages/domain-*/src/generated/` from this service's OpenAPI spec; stale generated code produces silent UI bugs. When your PR alters the contract, state the delta in the PR description so the frontend session can take its SCAFFOLD Update path (see the `simplix:frontend` skill, invariant #29). No frontend edits from this skill.

7. **RUNTIME** — What the framework does that the code does not show → `framework/runtime-behaviour.md`
   - Trigger: sign-in / token / session work, an audit-history surface over a generated entity, or a symptom whose cause is not in any file you can read — a 401 on correct credentials, a context that fails to start naming an unrelated bean, a session row that multiplies, a `NoClassDefFoundError` from a running application.
   - Read it **before** concluding a credential, a seed, or a dependency is wrong: every entry there is a case where the obvious reading was the wrong one.

---

## CRUD Layer Stack

| Layer | Base class | Package |
|---|---|---|
| Entity | `extends BaseEntity<String>` | `{basePackage}.domain.{aggregate}` |
| Repository | `extends SimpliXBaseRepository<E, String>` | `{basePackage}.domain.{aggregate}` |
| Service | `extends SimpliXBaseService<E, String>` | `{basePackage}.web.{feature}` |
| Controller | `extends SimpliXBaseController<E, String>` | `{basePackage}.web.{feature}` |
| DTOs container | `public class {Entity}DTOs {` | `{basePackage}.web.{feature}.dto` |

`<String>` is the ID type — every entity uses `String` (UUID v7 stored as VARCHAR).

Terminology (placeholders used throughout this handbook — the concrete values come from the project you are in, never from this document): `{basePackage}` = the project's Java base package, written dotted in code and as directories in a path (`dev.example.app` → `dev/example/app`). `{aggregate}` = Gradle module name suffix (e.g., `domain-facility-config`). `{feature}` = package path in the web layer (e.g., `facility/spatial`). `{module}` = domain subdirectory (e.g., `facility`). `{subdomain}` = feature package segment within a module (e.g., `spatial`, `identity`). New entities go in the appropriate `packages/domain-*` module; check existing modules with `ls packages/domain-*`.

Example names in this handbook (`CmsChannel`, `Building`, `facility.identity.Credential`, `FACILITY_HARDWARE`) are illustrative. Read the project's own entities, modules, and permission groups and follow those.

---

## Canonical Shapes (Controller & Service)

The generator produces the canonical shapes. Manual controllers and services must be indistinguishable from generated code (invariant 17). Full annotated code → lazy-loaded references below.

> **Authoritative source of truth**: the generator templates at `.simplix/templates/**/*.template`. When this doc diverges from the template, the template wins — update the doc, not the generated output. Controller template: `.simplix/templates/controller/rest/EntityRestController.java.template`.

### Controller shape skeleton

```
@RestController → @RequestMapping("/{entity}") → @Tag(name = "{module}.{subdomain}.{Entity}") → class extends SimpliXBaseController<E, String>
  constructor: super(service); this.service = service;
  11 endpoints (order per generator template):
    1. POST   /create           create
    2. PUT    /{id}             update
    3. PATCH                    multiUpdate
    4. DELETE /{id}             delete
    5. GET    /{id}             get
    6. GET    /{id}/edit        updateForm
    7. PATCH  /batch            batchUpdate
    8. DELETE /batch            batchDelete
    9. PATCH  /order            updateOrder    (optional — only entities with displayOrder)
    10. GET   /search           simpleSearch
    11. POST  /search           search
  Every endpoint: @XxxMapping → @Operation(summary, description) → @PreAuthorize("hasPermission('Entity', 'action')")
  Returns: SimpliXApiResponse<T> always. URL convention: POST /create (not POST /)
```

**Permission mapping**: `create` → `'create'` | `update/multiUpdate/batchUpdate/updateOrder` → `'edit'` | `delete/batchDelete` → `'delete'` | `get/updateForm` → `'view'` | `simpleSearch/search` → `'list'`

### Service shape skeleton

```
@Service → @Transactional(readOnly = true) → class extends SimpliXBaseService<E, String>
  constructor: super(repository, entityManager); + related repos + messageSource
  Required: create, update (ID-mismatch check mandatory), delete, batchDelete, search(Map), search(SearchCondition)
  Optional: multiUpdate, batchUpdate, updateOrder, buildDetailDTO (only when enrichment needed)
  Private: saveAndGetProjection(entity, fkId) — save + FK resolution + projection lookup
```

For full annotated code with all 11 endpoints, existence-check patterns, `@Validated` placement, base-class helpers, and required method signatures → Read `convention/canonical-controller.md` and `convention/canonical-service.md` via the Task Router above

---

## DTO Convention Summary

All DTOs are **static inner classes** of `{EntityName}DTOs`. For the 8 DTO roles (SearchDTO, CreateDTO, UpdateDTO, UpdateFormDTO, BatchUpdateDTO, DetailDTO, ListDTO, OrderUpdateDTO) with their exact Lombok annotations, extends relationships, and per-field annotation rules → see `references/review/dto-type-reference.md`.

---

## Annotation Ordering (summary)

| Target | Order |
|---|---|
| Entity class | `@Entity` → `@Audited` → `@Table` → `@Comment` → `@EntityEventConfig` → `@SQLDelete` → `@Filter` → Lombok 5 (`@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`) → class |
| CRUD Controller class | `@RestController` → `@RequestMapping` → `@Tag` → class `extends` |
| Non-CRUD Controller class | `@RestController` → `@RequestMapping` → `@Tag` → `@SimpliXStandardApi` → class |
| Service class | `@Service` → `@Transactional(readOnly = true)` → class `extends` |
| Repository | `@Repository` → interface `extends` |
| DTOs container | `public class {Entity}DTOs {` (no annotation) |
| Controller endpoint | `@XxxMapping` → `@Operation` → `@PreAuthorize` → method |
| Service write | `@Transactional` → method |

Exhaustive ordering + rationale → `references/convention/annotation-ordering.md`.

---

## Before Writing Backend Code

- [ ] Identified the subproject and Gradle module the code belongs to
- [ ] Read the module's existing code to pick up local conventions
- [ ] Decided: Generator Path or Manual Path?
- [ ] Generator Path — does the entity exist? do i18n messages exist in every locale? do domain tests pass?
- [ ] Manual Path — confirmed the case falls under a valid exception (see Task Router → WRITE)
- [ ] Customization / hand-authored surface — TWO same-shape precedent surfaces located and read end to end (#19)
- [ ] Any read taking a caller-supplied scope identifier judges it before the first query, and says in its javadoc which helper does (#20)

After writing:

- [ ] `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs"` clean — 0 error-level hits; review candidates judged against the rule's stated exceptions, not bulk-rewritten
- [ ] All 20 Non-Negotiable Invariants hold — the audit covers the mechanically visible subset, never all of them
- [ ] Completion report names the precedent classes cloned from, with justified divergences (#19 — customization / hand-authored surfaces)
- [ ] Annotation ordering matches `references/convention/annotation-ordering.md`
- [ ] No anti-patterns from `references/convention/anti-patterns.md`
- [ ] Build succeeds (`./gradlew compileJava`)
- [ ] Existing tests pass

---

## The audit script, and what it cannot see

`${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs` holds the machine-checkable subset of the
invariants above. Run it from the backend project root, or point it with `--root=<dir>`; it exits
1 on any error-level hit and prints review candidates without failing.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs"            # every rule
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --list     # what it carries
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --selftest # prove every rule both ways
```

**A rule enters it only once `--selftest` proves it in both directions.** Each rule carries a
`broken` and a `fixed` sample and the selftest asserts it fires on the first and stays silent on
the second — a rule proved one way has not been proved, because a check that can never fire
reports exactly what a clean tree reports. The selftest also proves the two escape hatches, for
the same reason.

**Where a genuine exception exists, mark the line rather than widen the rule**:

```java
// simplix-audit-ignore[repository-not-simplix-base]: schema-step bookkeeping, read only by the
// runner before the entity stack is usable; it has no list and no search surface.
```

The reason is required — a marker with an empty reason suppresses nothing, because a bare opt-out
is how a gate quietly stops holding anything. The marker covers its own line and the whole
statement after it, and every run prints how many lines were suppressed.

**Three things it deliberately does not do.** It never hardcodes a project's paths, class names or
exception lists — a rule true only of one repository belongs in that project's own gates, never
here. It does not judge what needs a person: generator-first (#15①), precedent parity (#19), scope
guarding (#20 — the guard is usually a helper call one or two frames down, so a body regex is all
false positives; verify it with a request instead), and
whether a permission group is the *right* group are read by eyes. And it does not start a server,
so the two verification requests in `review/searchable-field-patterns.md` § PK Contract are still
run by hand; what it does recover statically is the entity's own `@Id` field, which makes the PK
rule exact rather than a guess.