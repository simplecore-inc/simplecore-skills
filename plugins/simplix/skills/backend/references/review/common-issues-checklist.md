# Common Issues Checklist

Symptom → triage table. Use this to locate the right specialist file quickly when reviewing a module or chasing a bug report.

> **Scope (canonical):** symptom-based triage only. Each row lists a **few quick checks** (what to look at in the entity and the DTO) and **points to the canonical file** for the actual rule. Do not treat this file as authoritative for any annotation-level fix — the fix lives in the pointed-to file.

## How to Use

1. Find the symptom row that matches the reported bug or review finding.
2. Run the quick checks on the real entity/DTO — they eliminate the most common causes.
3. Open the pointed-to file for the authoritative rule and the fix.

## Symptom Table

| # | Symptom | Quick checks (entity/DTO) | Canonical file |
|---|---|---|---|
| 1 | **Field in entity not appearing in DTO** | Field actually declared? Private OK with Lombok `@Getter @Setter`? Field inherited from base entity? Self-reference in a tree? | `entity-to-dto-mapping.md` ([Which Entity Fields Go Where](entity-to-dto-mapping.md#which-entity-fields-go-where)) |
| 2 | **DTO field has wrong type** (e.g. `boolean` instead of `Boolean`) | Primitive → wrapper? `@ManyToOne` → ID-string vs full entity per DTO role? `@ManyToMany` excluded from Create/Update? | `entity-to-dto-mapping.md` ([Primitive → Wrapper](entity-to-dto-mapping.md#primitive--wrapper), [Relationship Handling](entity-to-dto-mapping.md#relationship-handling)) |
| 3 | **Required field accepts null / empty** | Entity has `@Column(nullable = false)`? String → `@NotBlank`, other → `@NotNull`? Entity has `@Column(length = N)` → DTO `@Length(max = N)`? | `validation-patterns.md` |
| 4 | **`@UniqueFields` / `@UniqueComposites` not enforcing** | Entity has `unique = true` (or composite `@UniqueConstraint`)? CreateDTO has `@UniqueFields` with `idField` AND `idProperty`? UpdateDTO extends CreateDTO without re-declaring? Entity has `@SoftDelete` → `softDeleteField` / `softDeleteType` set? | `validation-patterns.md` |
| 5 | **`@SearchableField` path returns nothing** | `@ManyToOne` relationship on entity? Referenced entity's `@Id` field name correct? `entityField = "relation.refIdField"` (nested, not just the ID)? `@ManyToMany` path is `collection.elementIdField`? | `searchable-field-patterns.md` |
| 6 | **`@I18nTrans` not resolving (default value shown)** | Entity has the `xxxI18n` Map companion? DTO `source = "xxxI18n"` exactly matches the Map field name (camelCase, not snake)? The Map field has `@JsonIgnore` to keep it out of responses? | `i18n-field-patterns.md` |
| 7 | **Entity reference in DTO — keep as object or flatten to ID?** | DTO role determines the answer: SearchDTO/CreateDTO/UpdateDTO → ID string; UpdateFormDTO/DetailDTO/ListDTO → full entity with `@JsonIncludeProperties({...})`. Entity has both `ref` and `refId` fields → use `refId` and skip `ref`. | `reference-field-patterns.md` |
| 8 | **Tree entity's `children` missing from ListDTO** | Entity `implements TreeEntity<Self>`? Has `@ManyToOne private Self parent;`? Has `depth` / `path`? ListDTO has `List<SelfListDTO> children`? | `reference-field-patterns.md` (self-reference) + `entity-to-dto-mapping.md` ([Tree-Entity Fields](entity-to-dto-mapping.md#tree-entity-fields)) |
| 9 | **Duplicate field in DTO (both `ref` and `refId`)** | Entity defines both `@ManyToOne ref` (insertable=false, updatable=false) and explicit `refId` → DTO should keep only `refId`. | `reference-field-patterns.md` (explicit ID + reference pattern) |
| 10 | **Controller / endpoint convention wrong** (response wrapper, @PreAuthorize, @Tag, exception type, etc.) | Response type is `SimpliXApiResponse<T>`? `@PreAuthorize` present with PascalCase entity + lowercase action? `@Tag(name)` is `{module}.{subdomain}.{Entity}` 3-segment? Endpoint annotation order is `@XxxMapping → @Operation → @PreAuthorize`? Constructor is explicit with `super(service)` (no `@RequiredArgsConstructor` in `web.*`)? | `../convention/anti-patterns.md` + SKILL.md Non-Negotiable Invariants |
| 11 | **Endpoint returns 500 at runtime** | Exception type is `SimpliXGeneralException`? (not raw `RuntimeException`/`IllegalArgumentException`) Service write method has `@Transactional`? Entity lookup returns `Optional` with proper null guard? FK reference exists in DB? | SKILL.md Invariant 3, `../convention/canonical-service.md` |
| 12 | **Endpoint returns 403 unexpectedly** | `@PreAuthorize` permission name PascalCase? (`'Building'` not `'BUILDING'`) `hasPermission('Entity', 'action')` wording exact? Permission seeded in DB? | SKILL.md Invariant 2, 9 |
| 13 | **`LazyInitializationException`** | Access happens outside `@Transactional` scope? Service class-level `@Transactional(readOnly = true)` present? Use JOIN FETCH or projection instead of lazy navigation? | `../convention/canonical-service.md` |
| 14 | **`ConstraintViolationException` on save** | Entity `@Column(nullable, length, unique)` matches DTO validation? FK reference ID exists in DB? `@UniqueFields` covers all unique constraints? | `validation-patterns.md` |
| 15 | **Unit test asserting an exception message fails — actual message is `{error.*}` or a bare key** | Test asserts resolved English prose? Placeholder messages resolve ONLY in `GlobalExceptionHandler` (HTTP layer) — `getMessage()` carries the raw key in unit scope. Fix the TEST: assert the message key (`hasMessageContaining("error.<domain>.<key>")`). `MessageUtils.get` returns the code itself (args dropped) without Spring. English assertions are valid only when the service resolves via an injected `MessageSource` the test stubs. | SKILL.md Invariant 3 |
| 16 | **New `{error.*}` key added but `ExceptionMessageTranslationTest` fails** | Key added to `apps/<app>/src/main/resources/messages/errors.properties` AND `errors_ko` AND `errors_ja`? Key spelling in source literal matches bundle exactly? Removed keys deleted from every locale (cross-locale drift check)? | SKILL.md Invariant 3 |
| 17 | **Date search/sort returns wrong order or misses rows** | Entity field is `String` instead of `Instant`/`LocalDate`? Range operators (`BETWEEN`/GT/LT) or `sortable` declared on a String date column? (VARCHAR comparison is lexicographic, not chronological) | `../entity/field-types.md` § Date/Time Fields, SKILL.md Invariant 18, AP-27 |
| 18 | **"Today" / day-boundary logic differs between environments or sites** | Argless `LocalDate.now()` or `ZoneId.systemDefault()` in the call path? Zone resolved from the site → policy → app-timezone hierarchy? Hardcoded zone literal? | `../entity/field-types.md` § Zone handling in services, AP-28 |
| 19 | **Entity `delete`/`deleteById`/`save` "runs" but the row survives (no error, tx commits)** | Same transaction also calls a `@Modifying(clearAutomatically = true)` bulk op (`deleteAllBy…`, `updateAllBy…`) AFTER the entity mutation? The mutation is `em.remove`/dirty state queued but not yet flushed, so the bulk op's context clear detaches it? Add `entityManager.flush()` before the bulk op (or make the mutation a bulk `@Query`). | `../convention/anti-patterns.md` AP-29 |

## Review Procedure

When auditing an entire CRUD module, walk it in this order:

1. **Entity first** — read the class top to bottom. List fields, annotations, base class, interfaces.
2. **For each field**, ask: type (primitive→wrapper?), constraints (`nullable`/`length`/`unique`), relationship kind (`@ManyToOne`/`@ManyToMany`/`@OneToMany`/self-ref), i18n pair, soft-delete marker.
3. **Open `{Entity}DTOs.java`** and check each DTO per its role (see `dto-type-reference.md`):
   - Is the right set of fields present for that DTO's purpose?
   - Are the types transformed correctly for that DTO's role (Search → ID, Detail → full)?
   - Are the annotations attached per the canonical rules (validation, i18n, references, searchable)?
4. **If something is off**, locate the symptom in the table above and open the canonical file for the fix.
