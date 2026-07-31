# Anti-Patterns Reference

Common mistakes with corrected examples. Every anti-pattern listed has been observed in actual Claude-generated code.

> **Scope (canonical):** the full catalogue of anti-patterns across Controllers, Services, Repositories, DTOs, Exceptions, Logging, date/time handling, transactions, security scope, delete lifecycle, and i18n, with before/after examples. The SKILL.md summary table lists the top ones for quick reference. For annotation order rules see **annotation-ordering.md**; for non-CRUD controller specifics see **non-crud-controller.md**.

> ## Staleness Triggers
> Re-audit this catalogue when: (a) generator template changes, (b) SimpliX framework version upgrade, (c) new entity types introduced (PII, tree, @MapsId), (d) new annotations added to canonical pattern. Each entry documents an anti-pattern observed in actual Claude-generated code.

---

## AP-1: ResponseEntity Instead of SimpliXApiResponse

```java
// WRONG
@GetMapping("/{id}")
public ResponseEntity<EntityDTO> get(@PathVariable String id) {
    return service.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}

// CORRECT
@GetMapping("/{id}")
@Operation(summary = "Get EntityName")
@PreAuthorize("hasPermission('EntityName', 'view')")
public SimpliXApiResponse<EntityNameDetailDTO> get(@PathVariable String id) {
    return service.findById(id, EntityNameDetailDTO.class)
        .map(SimpliXApiResponse::success)
        .orElse(SimpliXApiResponse.failure(null, "EntityName not found"));
}
```

---

## AP-2: @RequiredArgsConstructor on Controller/Service

```java
// WRONG
@RestController
@RequiredArgsConstructor
public class EntityNameRestController extends SimpliXBaseController<EntityName, String> {
    private final EntityNameService service;
    // Missing super(service) call — will not compile
}

// CORRECT
@RestController
@RequestMapping("/entity-name")
@Tag(name = "{module}.{subdomain}.EntityName", description = "...")
public class EntityNameRestController extends SimpliXBaseController<EntityName, String> {
    private final EntityNameService service;

    public EntityNameRestController(EntityNameService service) {
        super(service);        // Required for SimpliXBaseController
        this.service = service;
    }
}
```

**Why**: CRUD controllers/services extending `SimpliXBaseController`/`SimpliXBaseService` require `super(service)` in the constructor — `@RequiredArgsConstructor` cannot generate `super()` calls. For non-CRUD controllers (no `super()`), explicit constructors are used for consistency so all controllers follow the same pattern.

---

## AP-3: Missing @PreAuthorize

```java
// WRONG
@PostMapping("/create")
@Operation(summary = "Create EntityName")
public SimpliXApiResponse<EntityNameDetailDTO> create(@RequestBody @Validated EntityNameCreateDTO dto) {
    return SimpliXApiResponse.success(service.create(dto));
}

// CORRECT
@PostMapping("/create")
@Operation(summary = "Create EntityName")
@PreAuthorize("hasPermission('EntityName', 'create')")    // MANDATORY
public SimpliXApiResponse<EntityNameDetailDTO> create(@RequestBody @Validated EntityNameCreateDTO dto) {
    return SimpliXApiResponse.success(service.create(dto));
}
```

---

## AP-4: @Data on SearchDTO

```java
// WRONG — generates equals/hashCode which breaks search conditions
@Data
public static class EntityNameSearchDTO {
    @SearchableField(...)
    private String name;
}

// CORRECT — @Getter @Setter only
@Getter
@Setter
public static class EntityNameSearchDTO {
    @Schema(description = "Name")
    @FieldLabel("{entities.EntityName.name}")
    @SearchableField(entityField = "name", operators = {EQUALS, CONTAINS}, sortable = true)
    private String name;
}
```

**Why**: Lombok `@Data` generates `equals()`/`hashCode()` based on all fields. SearchDTO fields are nullable filter parameters — two SearchDTOs with all-null fields would be `equals()`, causing issues with Spring's parameter binding and caching. `@Getter @Setter` uses identity-based equality, avoiding these problems.

---

## AP-5: Separate DTO Files

```java
// WRONG — separate files per DTO type
// EntityNameCreateDTO.java
// EntityNameUpdateDTO.java
// EntityNameDetailDTO.java

// CORRECT — all DTOs as inner classes in a single file
// EntityNameDTOs.java
public class EntityNameDTOs {
    public static class EntityNameSearchDTO { ... }
    public static class EntityNameCreateDTO { ... }
    public static class EntityNameUpdateDTO extends EntityNameCreateDTO { ... }
    public static class EntityNameUpdateFormDTO extends EntityNameUpdateDTO { ... }
    public static class EntityNameBatchUpdateDTO { ... }
    public static class EntityNameDetailDTO { ... }
    public static class EntityNameListDTO { ... }
}
```

---

## AP-6: JpaRepository Instead of SimpliXBaseRepository

```java
// WRONG
@Repository
public interface EntityNameRepository extends JpaRepository<EntityName, String> { }

// CORRECT
@Repository
public interface EntityNameRepository extends SimpliXBaseRepository<EntityName, String> { }
```

---

## AP-7: Standard Java Exceptions

```java
// WRONG
throw new IllegalArgumentException("Entity not found: " + id);
throw new RuntimeException("ID mismatch");
throw new ResponseStatusException(HttpStatus.NOT_FOUND);

// CORRECT
throw new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND,
    messageSource.getMessage("error.entity.not.found",
        new Object[]{"EntityName", id}, "EntityName not found: " + id,
        LocaleContextHolder.getLocale()), null);

throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT,
    messageSource.getMessage("error.id.cannot.change", null,
        "ID cannot be changed", LocaleContextHolder.getLocale()), null);
```

---

## AP-8: Primitive boolean in DTOs

```java
// WRONG — generates isActive() getter, breaks ModelMapper
private boolean active;

// CORRECT — generates getActive() getter
private Boolean active;
```

This applies to ALL DTOs. Entity can use primitive `boolean` with `@Builder.Default`, but DTOs must always use wrapper `Boolean`.

---

## AP-9: Missing @FieldLabel

```java
// WRONG — no i18n label
@Schema(description = "Name")
@NotBlank
private String name;

// CORRECT — includes @FieldLabel for validation error i18n
@Schema(description = "Name")
@FieldLabel("{entities.EntityName.name}")
@NotBlank
@Length(max = 100)
private String name;
```

`@FieldLabel` is required on:
- SearchDTO fields (after `@Schema`)
- CreateDTO fields (after `@Schema`)
- BatchUpdateDTO fields (after `@Schema`)

### Which message key to use

`@FieldLabel` keys come from one of two namespaces:

| Field kind | Key namespace | Example |
|---|---|---|
| Entity-backed field (maps to a column on this DTO's entity) | `{entities.<Entity>.<field>}` | `{entities.AccessPointHardware.strikeOutput}` |
| Genuinely generic, entity-agnostic field | `{field.<name>}` | `{field.id}`, `{field.email}` |

**Virtual / derived / projection fields** — a DTO field with no column of its own, populated from a *real* field on another entity (e.g. a paired/slave record, an aggregate, a join) — MUST reuse that **source entity's existing label key**, NOT invent a new `{field.*}` key:

```java
// WRONG — a domain-specific virtual field parked in the generic field.* bucket.
// Forces a brand-new key + a translation per locale AND pollutes the generic namespace.
@Schema(description = "Virtual field: slave ACR number for paired reader")
@FieldLabel("{field.exitAcrNumber}")
private Integer exitAcrNumber;

// CORRECT — point at the real source field's existing entity key.
// exitAcrNumber is populated from the slave AccessPoint.acrNumber, so reuse its label.
@FieldLabel("{entities.AccessPoint.acrNumber}")
private Integer exitAcrNumber;
```

Why: `{field.*}` is reserved for truly generic field names. A virtual field that mirrors `SomeEntity.someField` already has a translated label at `{entities.SomeEntity.someField}` in every locale — reuse it. This avoids a duplicate key, an i18n gap (the generic `{field.*}` namespace is frequently missing the non-default locale bundles), and a misclassified domain term in the generic bucket. To find the source field, follow the populating mapper/service (e.g. `populateExitFieldsFromSlave` → `slave.getAcrNumber()` ⇒ `{entities.AccessPoint.acrNumber}`).

---

## AP-10: Skipping Generator for CRUD Entity

```java
// WRONG — writing CRUD manually
// Claude: "I'll create the service, controller, and DTOs for you..."

// CORRECT workflow:
// 1. Create Entity class in packages/domain-*/
// 2. Add i18n messages
// 3. ./gradlew :packages:domain-<aggregate>:test
// 4. yo simplix:config EntityName --force
// 5. Edit .simplix/entity/EntityName.yml
// 6. yo simplix:generate EntityName --force
// 7. yo simplix:promote EntityName --force
// 8. Customize promoted code
```

---

## AP-11: Debug Logs by Default

```java
// WRONG — adding logs without being asked
@Slf4j
@Service
public class EntityNameService extends SimpliXBaseService<EntityName, String> {

    @Transactional
    public EntityNameDetailDTO create(EntityNameCreateDTO dto) {
        log.debug("Creating entity: {}", dto);           // FORBIDDEN
        EntityName entity = new EntityName();
        modelMapper.map(dto, entity);
        log.info("Entity created: {}", entity.getId());  // FORBIDDEN
        return saveAndGetProjection(entity);
    }
}

// CORRECT — no logs unless explicitly requested
@Service
@Transactional(readOnly = true)
public class EntityNameService extends SimpliXBaseService<EntityName, String> {

    @Transactional
    public EntityNameDetailDTO create(EntityNameCreateDTO dto) {
        EntityName entity = new EntityName();
        modelMapper.map(dto, entity);
        return saveAndGetProjection(entity);
    }
}
```

---

## AP-12: Missing @Tag on Controller

```java
// WRONG — no @Tag
@RestController
@RequestMapping("/entity-name")
public class EntityNameController { ... }

// CORRECT
@RestController
@RequestMapping("/entity-name")
@Tag(name = "{module}.{subdomain}.EntityName", description = "Entity description")
public class EntityNameRestController extends SimpliXBaseController<EntityName, String> { ... }
```

---

## AP-13: @Autowired Field Injection

```java
// WRONG
@RestController
public class EntityNameController {
    @Autowired
    private EntityNameService service;
}

// CORRECT — constructor injection
@RestController
@RequestMapping("/entity-name")
@Tag(name = "{module}.{subdomain}.EntityName", description = "...")
public class EntityNameRestController {
    private final EntityNameService service;

    public EntityNameRestController(EntityNameService service) {
        this.service = service;
    }
}
```

---

## AP-14: Verbose @Schema Descriptions

```java
// WRONG — too verbose, includes constraints
@Schema(description = "Required. The name of the site. Maximum 100 characters.")
@NotBlank
@Length(max = 100)
private String name;

// CORRECT — concise, constraints are in annotations
@Schema(description = "Site name")
@FieldLabel("{entities.Site.name}")
@NotBlank
@Length(max = 100)
private String name;
```

---

## AP-15: Wrong Section Separator Style

```java
// WRONG
// ==================== Search ====================
// === Section ===
/* Section */
// ---------- Section ----------

// CORRECT (in Service/Controller)
//----------------------------------
// Search
//----------------------------------

// CORRECT (audit field separator in DTOs)
//----------

// CORRECT (in Entity only — entity-specific style)
// ==================== Soft Delete ====================
```

---

## AP-16: Missing @Operation on Endpoint

```java
// WRONG — no OpenAPI documentation
@GetMapping("/{id}")
@PreAuthorize("hasPermission('EntityName', 'view')")
public SimpliXApiResponse<EntityNameDetailDTO> get(@PathVariable String id) { ... }

// CORRECT
@GetMapping("/{id}")
@Operation(summary = "Get EntityName", description = "Retrieves EntityName by ID")
@PreAuthorize("hasPermission('EntityName', 'view')")
public SimpliXApiResponse<EntityNameDetailDTO> get(@PathVariable String id) { ... }
```

---

## AP-17: Wrong Annotation Order on Methods

```java
// WRONG — @PreAuthorize before @Operation
@GetMapping("/{id}")
@PreAuthorize("hasPermission('EntityName', 'view')")
@Operation(summary = "Get EntityName")
public SimpliXApiResponse<EntityNameDetailDTO> get(@PathVariable String id) { ... }

// CORRECT — @XxxMapping → @Operation → @PreAuthorize
@GetMapping("/{id}")
@Operation(summary = "Get EntityName", description = "Retrieves EntityName by ID")
@PreAuthorize("hasPermission('EntityName', 'view')")
public SimpliXApiResponse<EntityNameDetailDTO> get(@PathVariable String id) { ... }
```

---

## AP-18: Missing Audit Fields in DTO

```java
// WRONG — DetailDTO/ListDTO missing audit fields
@Data
public static class EntityNameDetailDTO {
    private String id;
    private String name;
    // Missing: createdBy, createdAt, updatedBy, updatedAt
}

// CORRECT
@Data
public static class EntityNameDetailDTO {
    private String id;
    private String name;

    //----------

    @Schema(description = "Created by")
    private String createdBy;

    @Schema(description = "Created at")
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm")
    private Instant createdAt;

    @Schema(description = "Updated by")
    private String updatedBy;

    @Schema(description = "Updated at")
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm")
    private Instant updatedAt;
}
```

---

## AP-19: @JsonIncludeProperties Missing on Entity References

```java
// WRONG — exposes all lazy fields, risks LazyInitializationException
@Data
public static class EntityNameDetailDTO {
    private ParentEntity parent;    // Dangerous: all fields serialized
}

// CORRECT — project standard
@Data
public static class EntityNameDetailDTO {
    @JsonIncludeProperties({"parentId", "parentName"})
    private ParentEntity parent;
}
```

Include contextually useful fields (ID + name + any fields the frontend needs for display/navigation).

---

## AP-20: Wrong UpdateDTO Inheritance

```java
// WRONG — UpdateDTO does not extend CreateDTO
@Data
public static class EntityNameUpdateDTO {
    private String id;
    private String name;
    private String description;
    // Duplicates all CreateDTO fields
}

// CORRECT — extends CreateDTO, adds only ID
@Data
@EqualsAndHashCode(callSuper = true)
public static class EntityNameUpdateDTO extends EntityNameCreateDTO {
    @Schema(description = "Entity ID")
    @FieldLabel("{entities.EntityName.id}")
    @NotBlank(message = "ID is required")
    private String id;
}
```

---

## AP-21: hasRole() Instead of hasPermission()

```java
// WRONG — role-based guard, breaks the project's permission model
@PreAuthorize("hasRole('ADMIN')")
public SimpliXApiResponse<AuditEntryDTO> getAuditEntry(...)

// WRONG — arbitrary authority string
@PreAuthorize("hasAuthority('SUPER_USER')")

// CORRECT — entity-action permission (matches generator output + seed data)
@PreAuthorize("hasPermission('ControlAudit', 'view')")
```

**Why**: the project's permission infrastructure is seeded from `@PreAuthorize("hasPermission(Entity, action)")` annotations at startup. Role-based guards (`hasRole`, `hasAuthority`) bypass that registry, leaving permissions unmanageable through the admin UI and breaking the frontend permission-sync automation.

**Only acceptable non-`hasPermission` expressions**: `permitAll()` (public endpoint) and `isAuthenticated()` (user-self access). Everything else is a violation.

---

## AP-22: Non-String @PathVariable Type

```java
// WRONG — breaks ID convention (UUID v7 stored as String)
@GetMapping("/{commandId}/audit")
public SimpliXApiResponse<AuditEntryDTO> getAuditEntry(@PathVariable UUID commandId) { ... }

@GetMapping("/{id}")
public SimpliXApiResponse<Dto> get(@PathVariable Long id) { ... }

// CORRECT — String everywhere, parse internally if a typed form is needed
@GetMapping("/{commandId}/audit")
public SimpliXApiResponse<AuditEntryDTO> getAuditEntry(@PathVariable String commandId) { ... }
```

**Why**: Invariant 4/5 and the CRUD Layer Stack table (SKILL.md:139-145) mandate `String` for every ID. Accepting `UUID`/`Long` at the edge forces binding-layer conversion, diverges from generator output, and makes the URL shape inconsistent across endpoints.

---

## AP-23: `@ApiResponses` Block Alongside `@Operation`

```java
// WRONG — verbose, not produced by any SimpliX template
@GetMapping("/{id}")
@Operation(summary = "Get entity")
@PreAuthorize("hasPermission('Entity', 'view')")
@ApiResponses({
    @ApiResponse(responseCode = "200", description = "OK"),
    @ApiResponse(responseCode = "404", description = "Not found")
})
public SimpliXApiResponse<Dto> get(@PathVariable String id) { ... }

// CORRECT — @Operation alone; the global ResponseEntityExceptionHandler documents errors
@GetMapping("/{id}")
@Operation(summary = "Get entity", description = "Retrieves entity by ID")
@PreAuthorize("hasPermission('Entity', 'view')")
public SimpliXApiResponse<Dto> get(@PathVariable String id) { ... }
```

**Why**: the generator templates — both `EntityRestController.java.template` and the Non-CRUD examples in `non-crud-controller.md` — never emit `@ApiResponses`. `@Operation` is the single source of truth; HTTP status codes are derived from the response wrapper's `success`/`failure` variants and from `ErrorCode` (via the global exception handler). An explicit `@ApiResponses` block both duplicates that contract and risks drift between the annotation and the actual error envelope.

---

## AP-24: URL Prefix Hardcoded on `@RequestMapping`

```java
// WRONG — prefix baked into every controller; generator never emits this
@RequestMapping("/api/v1/admin/control")
@RequestMapping("/api/v1/facility/control")

// CORRECT — short resource path; the /api/v1/ prefix lives in Spring config
@RequestMapping("/admin/control")
@RequestMapping("/facility/control")
```

**Why**: generator templates produce `@RequestMapping("/<%= templatePath %>")` — a single path segment. The `/api/v1/` prefix belongs to `spring.mvc.servlet.path` or a server-level context, so it can be versioned or rebased without touching every controller. Hardcoding it inside `@RequestMapping` couples the class to a specific deployment layout and makes refactors noisy.

---

## AP-25: Missing `@SimpliXStandardApi` on Non-CRUD Controller

```java
// WRONG — non-CRUD without the marker; SimpliX middleware can't
// recognize it for standard-response post-processing
@RestController
@RequestMapping("/path")
@Tag(name = "...")
public class XxxController {  // no @SimpliXStandardApi, no extends SimpliXBaseController

// CORRECT — non-CRUD must declare @SimpliXStandardApi at class level
@RestController
@RequestMapping("/path")
@Tag(name = "module.subdomain.Xxx")
@SimpliXStandardApi
public class XxxController {
```

**Why**: SimpliX applies its response envelope and error-handling filters based on two markers — `extends SimpliXBaseController` (CRUD) **or** `@SimpliXStandardApi` (non-CRUD). A non-CRUD controller missing both is invisible to the middleware and behaves like a raw Spring MVC controller, undoing the project's convention uniformly. See `non-crud-controller.md` §Class Declaration Template.

---

## AP-26: Dual Constructors for Test Overrides

```java
// WRONG — two constructors, test-only hook drifts away from generator shape
@Service
public class XxxService {
    public XxxService(Dep a, Dep b) {            // production — inlines the variable dependency
        this(a, b, Clock.systemUTC());
    }
    XxxService(Dep a, Dep b, Clock clock) {      // test hook — package-private
        this.clock = clock;
        ...
    }
}

// CORRECT — single explicit constructor; externalize the variable dependency as a @Bean
@Service
public class XxxService {
    public XxxService(Dep a, Dep b, Clock clock) {
        this.a = a;
        this.b = b;
        this.clock = clock;
    }
}

// XxxConfig.java
@Configuration
public class XxxConfig {
    @Bean
    public Clock systemClock() { return Clock.systemUTC(); }
}
```

**Why**: the canonical generator output is **one public explicit constructor** per class. A second package-private constructor for tests (1) breaks that shape, (2) trips IntelliJ's Spring plugin into "Class doesn't contain a matching constructor for autowiring" false-positive warnings, and (3) hides the service's full dependency list from the DI graph. If a test needs to substitute a non-bean value (clock, cache, ticker), expose it as a `@Bean` and let the test construct the service with a custom instance directly — no second constructor required.

**Rule of thumb**: if you find yourself writing a second constructor "just for tests," stop — make the thing a bean, then construct the class with any value in the test.

## AP-27: String Column for an Offset-Carrying Date/Time

```java
// WRONG — RFC 3339 string stored verbatim, with range search declared on it
@Column(name = "activation_date")
@Comment("RFC 3339 with client offset")
private String activationDate;

// SearchDTO
@SearchableField(entityField = "activationDate", operators = {BETWEEN, GREATER_THAN, LESS_THAN}, sortable = true)
private String activationDate;

// CORRECT — semantic type stored; the wire string is produced at the SU mapper
@Column(name = "activation_date")
private Instant activationDate;
```

**Why**: searchable-jpa derives SQL semantics from the entity attribute type — a String column gets lexicographic VARCHAR comparison, which is chronologically wrong the moment stored offsets or formats vary (mixed `+09:00`/`Z`, DST zones, fractional seconds). A String date column also loses input validation (any garbage reaches the DB and can fail open in expiry checks), loses the OpenAPI `format: date-time` hint the frontend codegen needs, and cannot serve multi-zone sync — one string carries one offset, but unscoped entities (holidays, schedules) sync to controllers in several site timezones that each need their own offset. Store the semantic type (invariant #18, `../entity/field-types.md` § Date/Time Fields) and format at the transmission boundary.

## AP-28: JVM-Default-Zone APIs in Domain Logic

```java
// WRONG — the container's TZ decides "today" and the day boundary
LocalDate today = LocalDate.now();
Instant dayStart = date.atStartOfDay(ZoneId.systemDefault()).toInstant();

// CORRECT — resolve the zone from the hierarchy (site → policy → app timezone)
ZoneId zone = policyResolver.resolveTimeZone(userAccountId);
LocalDate today = LocalDate.now(zone);
Instant dayStart = date.atStartOfDay(zone).toInstant();
```

**Why**: date attribution ("which day does this punch/visit/review belong to") must follow the SITE's clock, not the server container's. Argless `now()` and `ZoneId.systemDefault()` silently change results between deployments (cloud containers default to UTC) and are wrong for every site whose timezone differs from the server's. `Instant.now()` is zone-free and always fine. This rule binds ALL Java code including schedulers and infrastructure — invariant #18 is not covered by the infra exemption. Zone hierarchy and the timezone-literal ban: `../entity/field-types.md` § Zone handling in services.

## AP-29: Entity Mutation Discarded by a `clearAutomatically` Bulk Op

```java
// WRONG — entity removes are queued (em.remove, not yet flushed); the next bulk op clears the
// persistence context and silently drops them, so the DELETE/soft-delete never reaches the DB
accessControlUnitRepository.delete(controller);          // em.remove — deferred to the flush
controllerSyncStateRepository.deleteById(controllerId);  // em.remove — deferred to the flush
syncDeliveryRepository.deleteAllByControllerId(id);      // @Modifying(clearAutomatically = true)
                                                         //   → EntityManager.clear() detaches the two removes above

// CORRECT — flush the entity mutations BEFORE the clearing bulk op
accessControlUnitRepository.delete(controller);
controllerSyncStateRepository.deleteById(controllerId);
entityManager.flush();                                   // the queued removes are issued now
syncDeliveryRepository.deleteAllByControllerId(id);      // safe: context clear discards nothing pending
```

**Why**: `@Modifying(clearAutomatically = true)` runs `EntityManager.clear()` after its bulk statement. Any entity mutation queued earlier in the SAME transaction but not yet flushed — `repository.delete(entity)` / `deleteById` (both `em.remove`), a `save`, or a dirty-check update — is detached by that clear and silently dropped: no SQL is issued and no error is raised. Entity mutations are deferred to the flush, while `@Modifying @Query` bulk ops execute immediately, so a clearing bulk op sitting between the two loses the deferred work. Relying on the outermost commit flush does not save it — the context is already cleared, and a framework transaction manager that flushes only at `prepareForCommit` makes the window wider. Rule: when one transaction mixes entity mutations with a `@Modifying(clearAutomatically = true)` bulk op, call `entityManager.flush()` before the bulk op (or convert the entity mutations to bulk `@Query` DELETE/UPDATE). Symptom is a delete/save that "runs" (method returns, transaction commits) yet the row survives. Audit: `grep -rn "clearAutomatically" packages modules --include="*.java"`, then for each hit confirm every caller that also mutates entities in the same transaction flushes first.

## AP-30: Broadened Operator-Facing Read Reaching a Data-Subject Caller

```java
// WRONG — one readiness() computes operator-only verdicts (background check, identity,
// compliance, capacity) AND is called by subject-facing self-service and per-row listings
public Readiness readiness(String applicantId) {
    ...
    blockers.addAll(backgroundCheckService.preview(...));   // internal verdict
    blockers.addAll(identityProvider.verify(...));          // external SPI call
    blockers.addAll(capacityRule.reached(...) ? ... : ...);
    return new Readiness(blockers);
}
// self-service portal + candidate listing both call readiness().ready() / .blockers()

// CORRECT — the broad read stays operator-only; the subject-facing path gets a narrow read
public Readiness readiness(String applicantId) { ... }     // operator controller ONLY

/** Steps the applicant can act on: approval, agreement, training. No SPI, no background check. */
public List<String> selfServiceMissingSteps(String applicantId) { ... }
```

**Why**: a read method broadened to serve an operator (full gates: background check, identity SPI, compliance, capacity) must not be shared by data-subject-facing callers (self-service portal, public surface, or any per-row listing). Sharing it produces three distinct failures: **(1) privacy** — an internal verdict (`"flagged by background check"`, `"ID document missing"`) is rendered on the subject's own screen; **(2) semantic flip** — `ready()`/`isEmpty()` now goes false for conditions the subject cannot fix, so a self-service flow dead-ends or loops (re-issuing a token for a block the applicant can never clear); **(3) cost + side-effect** — a listing that calls the broad method per candidate fires the identity SPI and the background check N× per page. Rule: when you broaden a read to add operator-only gates, `grep` its callers and give every subject-facing caller a narrow variant that emits only subject-actionable items. Audit: for the broad method, confirm the ONLY caller is the operator controller (`grep -rn "\.readiness(" modules --include=*.java`).

## AP-31: Fail-Open Jurisdiction / Scope Resolution

```java
// WRONG — null means "all sites"; a manager with no active scope row falls into the null
// branch and sees EVERYTHING
public Set<String> permittedSiteIds() {
    List<ManagerScope> scopes = repo.findByManagerAndActiveTrue(actor());
    return scopes.isEmpty() ? null : scopes.stream().map(ManagerScope::getSiteId).collect(toSet());
}
if (permittedSiteIds() == null) { /* no filter — all sites */ }

// CORRECT — resolve to an explicit view; absence of a grant means NOTHING (fail-closed)
public ScopeView resolve() {
    if (permissionEvaluator.hasPermission(auth(), RESOURCE, "manage")) return ScopeView.allSites();
    Set<String> sites = repo.findByManagerAndActiveTrue(actor()).stream()
            .map(ManagerScope::getSiteId).collect(toSet());
    return new ScopeView(false, sites);   // empty set → sees nothing
}
```

**Why**: a null-means-unlimited contract **fails open** — the absence of a grant reads as unlimited access, so a mis-seeded or newly-created scoped account silently gains company-wide visibility. Scope resolution must fail CLOSED: no grant → empty set → sees nothing. The all-sites bypass belongs to a distinct, heavier permission (`manage`, held by admin/system), registered in the catalog, **not** to the default `view`. Converting a fail-open resolver to fail-closed is **not a local edit**: `grep` the source accessor symbol repo-wide and convert EVERY consumer — prerequisite work grows the caller count beyond any number the task names, and each un-migrated caller keeps a fail-open path. Removing the old accessor and confirming zero references (`grep -rn "permittedSiteIds" modules packages | grep -v /build/` → 0) is what proves the sweep is complete. Add a test that a `manage`-holder still sees all sites (the conversion must not break the admin path) and a no-grant account sees nothing.

## AP-32: Delete Without a Reference Guard, or a Guard/Side-Effect That Runs Too Late

```java
// WRONG — no reference check (dangles FKs), OR the guard/side-effect runs AFTER the delete
public void delete(String id) {
    deleteById(id);                          // orphans references; or…
    revokeToken(findById(id)...);            // row is GONE — findById empty, revoke no-ops/NPEs
    auditRecorder.record(DELETE, ...);       // records against a vanished row
}

// CORRECT — guard + irreversible side-effects BEFORE the row is removed
public void delete(String id) {
    rejectIfInUse(id);                        // concrete reason, message key, before delete
    revokeTokenIfPresent(findById(id));       // token id unrecoverable once the row is gone
    auditRecorder.record(DELETE, "Entity", id, {...});
    deleteById(id);
}
public void batchDelete(List<String> ids) {
    ids.forEach(this::rejectIfInUse);         // guard every id BEFORE the bulk delete
    ...
    deleteAllByIds(ids);
}
private void rejectIfInUse(String id) {
    long refs = childRepo.countByParentId(id);
    if (refs > 0) throw new SimpliXGeneralException(GEN_CONFLICT,
            messageSource.getMessage("error.<module>.entityInUse", new Object[]{refs}, ...), null);
}
```

**Why**: four rules converge here. **(1) "If there is no reason to block, ALLOW."** A delete guard exists only where a real reference or a legal/audit reason blocks it; "just in case" is not a reason — a screen missing its delete because nobody wired it is a defect, not caution. **(2) Concrete reason, not generic.** The block message names WHAT references it and HOW MANY (`"signed by {0} members and required by {1} plan types"`), args-bearing, resolved via `messageSource.getMessage` at throw time (clone the established `rejectIfInUse` precedent), every locale filled — a generic integrity message strands the operator. **(3) Order — before the delete.** A reference guard, a token revoke, and the audit record all read the row or its ids; after `em.remove`/`deleteById` those values are gone, so the revoke/audit targets a vanished row and silently no-ops or NPEs. Guard and record BEFORE `deleteById`; `forEach(rejectIfInUse)` BEFORE `deleteAllByIds`. **(4) A record that must never be user-deleted** (a legal signature, an audit row) removes its DELETE endpoint entirely — full removal only via the anonymization/purge path — rather than guarding a delete that should not exist. Symptom of a too-late side-effect: the delete succeeds but the token stays live / the audit trail has no removal event.

## AP-33: Orphaned i18n Keys on Entity/Enum Removal; Unsafe Homonym Deletion

```bash
# WRONG — delete the entity/enum Java in one commit, its message bundles in the next:
#   EntityMessageTranslationTest / EnumMessageTranslationTest go RED the instant the class is
#   gone while entities.X.* / enums.Y.* keys remain (orphan keys), so the intermediate commit
#   cannot build.
# WRONG — a feature-removal grep of a polysemous term matches unrelated features:
grep -ri delivery         # hits sync "delivery", email "delivered", push "delivery failed" …

# CORRECT — precise, symbol-scoped pattern with an explicit keep-list; bundle removal in the
# SAME commit as the Java deletion
grep -rEn 'DeliveryRecord|deliveryRecord|delivery_records|[Dd]eliveryMatcher' \
  --include='*.java' --include='*.properties' | grep -vE '/build/|/generated/'
```

**Why**: the orphan-key translation tests treat every `entities.*` / `enums.*` key with no backing `@FieldLabel` / enum value as an orphan and fail the build. So a removal that splits the Java change (entity/enum class) from the message-bundle change into separate commits cannot produce a green intermediate — it violates "never commit a broken build". Fold the bundle removal into the same commit as the class deletion; symmetrically, a NEW enum value needs its `enums/*.properties` label in every locale in the same commit that adds the value, or `EnumMessageTranslationTest` fails. For feature removal, a polysemous identifier (a word used by several features) makes a bare `grep -ri` report false positives from siblings; use a symbol-precise `grep -E` (never `-i`), exclude `/build/` `/generated/` and plan docs, and enumerate the homonyms to KEEP before deleting — the only safe basis for judging "fully removed" is a pattern that matches the target and nothing else.

## AP-34: A `@NaturalId` Column the Update Path Still Accepts

```java
// WRONG — the generated update maps the whole DTO onto the entity, natural id included:
@Transactional
public XDetailDTO update(X entity, XUpdateDTO dto) {
    if (!Objects.equals(entity.getXId(), dto.getXId())) { /* id guard only */ }
    modelMapper.map(dto, entity);          // rewrites xCode, which is @NaturalId
    return saveAndGetProjection(entity);
}

// CORRECT — refuse the change before the mapper, with a key that names the field
if (dto.getXCode() != null && !Objects.equals(entity.getXCode(), dto.getXCode())) {
    throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "{error.<domain>.xCodeImmutable}", null);
}
```

**Why**: `@NaturalId` defaults to immutable, so Hibernate refuses the write at flush — as a
`GEN_INTERNAL_SERVER_ERROR` naming no field. The generated CRUD service has no guard for it and
the generated form renders the column as an ordinary editable text field, so an operator who
retypes a code gets an internal error with nothing on screen saying which field caused it. Every
`@NaturalId` column therefore needs three things in the same change: the service guard above, a
message key in every locale, and the field **disabled on edit** in the form with that reason as
its `description` (a create form leaves it open and required). The generated happy-path service
test also has to stop changing the code — it sets a different value by default and will start
failing the moment the guard lands.

**Detection** (run from the repository root):
```bash
# every natural id, and whether its service refuses the change
grep -rn -A4 "@NaturalId" --include='*.java' packages modules | grep -A3 "private String"
grep -rn "Immutable}" --include='*Service.java' modules
```
