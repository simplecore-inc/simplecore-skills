# Non-CRUD Controller Convention

Controllers that do NOT extend `SimpliXBaseController`. Cover action triggers, aggregation endpoints, monitoring dashboards, dev/test endpoints.

> **Scope (canonical):** class declaration (no base-class extension, `@SimpliXStandardApi`), constructor pattern (no `super`), response wrapping (`SimpliXApiResponse` still mandatory), `@PreAuthorize` still mandatory. The Non-Negotiable Invariants in SKILL.md apply equally here. For CRUD controllers, see the main SKILL.md + `../review/` for the DTO side.

---

## When to Use Non-CRUD Controllers

| Reason | Example |
|--------|---------|
| Action/trigger endpoint | `SyncExecutionController`, `FullDownloadController` |
| Multi-entity aggregation | `EventStatisticsRestController`, `DashboardBootstrapController` |
| No backing DB entity | `MonitoringDashboardController` (in-memory cache) |
| `@MapsId` entity (no independent lifecycle) | `SyncStateRestController` |
| User-self management | `CurrentUserRestController` |
| Dev/test only | `ErrorTestRestController` |

---

## Class Declaration Template

```java
@RestController
@RequestMapping("/request-path")
@Tag(name = "{module}.{subdomain}.{Purpose}", description = "Description of the controller")
@SimpliXStandardApi
public class PurposeController {

    private final SomeService someService;
    private final AnotherService anotherService;

    public PurposeController(SomeService someService,
                             AnotherService anotherService) {
        this.someService = someService;
        this.anotherService = anotherService;
    }
```

### Key Differences from CRUD Controller:

| Aspect | CRUD Controller | Non-CRUD Controller |
|--------|----------------|---------------------|
| Inheritance | `extends SimpliXBaseController<E, ID>` | No inheritance |
| `@SimpliXStandardApi` | Method-level (on specific endpoints) | **Class-level** |
| Constructor | `super(service); this.service = service;` | `this.service = service;` only |
| Lombok | NO `@RequiredArgsConstructor` | Explicit constructor preferred |

### `@SimpliXStandardApi` Placement Rule:

```java
// CRUD Controller — method level only (on special endpoints like updateOrder)
@PatchMapping("/order")
@SimpliXStandardApi
@PreAuthorize("hasPermission('Entity', 'edit')")
public SimpliXApiResponse<...> updateOrder(...)

// Non-CRUD Controller — class level
@RestController
@RequestMapping("/path")
@Tag(...)
@SimpliXStandardApi          // HERE
public class SomeController {
```

---

## Method Template

```java
/**
 * Executes the sync pipeline for a specific controller.
 *
 * @param controllerId the target controller ID
 * @return response containing the execution result
 */
@PostMapping("/{controllerId}/execute")
@Operation(summary = "Execute sync pipeline",
        description = "Creates deliveries for pending changes")
@PreAuthorize("hasPermission('SyncExecution', 'create')")
public SimpliXApiResponse<SyncExecutionResult> execute(
        @PathVariable String controllerId) {
    return SimpliXApiResponse.success(syncExecutionService.execute(controllerId));
}
```

### Method Annotation Order:

1. `@XxxMapping` (HTTP method + path)
2. `@Operation` (OpenAPI documentation)
3. `@PreAuthorize` (Security — MANDATORY)
4. Method signature

---

## Response Patterns (Same as CRUD)

```java
// Success with body
return SimpliXApiResponse.success(result);

// Success with message (void operations)
return SimpliXApiResponse.success(null, "Operation completed successfully");

// Failure
return SimpliXApiResponse.failure(null, "Entity not found");
return SimpliXApiResponse.failure(result, "Operation already in progress");

// Conditional success/failure
if (!service.exists(id)) {
    return SimpliXApiResponse.failure(null, "Entity not found");
}
return SimpliXApiResponse.success(service.process(id));
```

---

## Complex Parameter Pattern

For endpoints with multiple query parameters, use `@Parameter` annotations:

```java
@GetMapping("/stats")
@Operation(summary = "Get event statistics",
        description = "Returns time-bucketed event counts")
@PreAuthorize("hasPermission('EventStatistics', 'list')")
public SimpliXApiResponse<List<EventBucketDTO>> getStats(
        @RequestParam @Parameter(description = "Start time (ISO-8601, inclusive)") Instant from,
        @RequestParam @Parameter(description = "End time (ISO-8601, exclusive)") Instant to,
        @RequestParam @Parameter(description = "Time bucket granularity") TimeGranularity granularity,
        @RequestParam(required = false) @Parameter(description = "Filter by site") String siteId) {
    return SimpliXApiResponse.success(
            statisticsService.getEventStats(from, to, granularity, siteId));
}
```

---

## Non-CRUD Service Pattern

Services that don't extend `SimpliXBaseService`:

```java
@Service
@Transactional(readOnly = true)
public class MonitoringDashboardService {

    private final StatusPointRepository statusPointRepository;
    private final HealthStateManager healthStateManager;

    public MonitoringDashboardService(
            StatusPointRepository statusPointRepository,
            HealthStateManager healthStateManager) {
        this.statusPointRepository = statusPointRepository;
        this.healthStateManager = healthStateManager;
    }

    // Read methods — inherit class-level @Transactional(readOnly = true)
    public DashboardSnapshot getSnapshot() { ... }

    // Write methods — explicit @Transactional
    @Transactional
    public void acknowledge(String alarmId) { ... }
}
```

### When `@RequiredArgsConstructor` is Acceptable:

Only for non-SimpliX services that are:
- Configuration classes (`@Configuration`)
- Infrastructure classes (`@Component` in `app` package)
- Beans declared via `@Bean` method (no explicit class annotations)

NEVER on:
- Controllers (CRUD or non-CRUD)
- SimpliX-based services
- Classes that need `super()` calls

---

## Real Examples from Codebase

### Action Trigger Controller

```java
// SyncExecutionController — triggers sync pipeline
@RestController
@RequestMapping("/sync")
@Tag(name = "facility.sync.SyncExecution", description = "Sync execution pipeline operations")
@SimpliXStandardApi
public class SyncExecutionController {

    @PostMapping("/{controllerId}/execute")
    @Operation(summary = "Execute sync pipeline")
    @PreAuthorize("hasPermission('SyncExecution', 'create')")
    public SimpliXApiResponse<SyncExecutionResult> execute(
            @PathVariable String controllerId) { ... }
}
```

### Dashboard/Aggregation Controller

```java
// MonitoringDashboardController — aggregates multiple data sources
@RestController
@RequestMapping("/monitoring/dashboard")
@Tag(name = "facility.monitoring.Dashboard", description = "Monitoring dashboard")
@SimpliXStandardApi
public class MonitoringDashboardController {

    @GetMapping("/safety-snapshot")
    @Operation(summary = "Get safety snapshot")
    @PreAuthorize("hasPermission('MonitoringDashboard', 'view')")
    public SimpliXApiResponse<SafetySnapshotDto> getSafetySnapshot() { ... }
}
```

### User-Self Controller

```java
// CurrentUserRestController — different auth pattern (self-access)
@RestController
@RequestMapping("/me")
@Tag(name = "user.self.CurrentUser", description = "Current user operations")
@SimpliXStandardApi
public class CurrentUserRestController {

    @GetMapping
    @Operation(summary = "Get current user info")
    @PreAuthorize("isAuthenticated()")    // Different permission pattern
    public SimpliXApiResponse<UserInfoDTO> getCurrentUser() { ... }
}
```

### Dev/Test Controller

```java
// ErrorTestRestController — dev environment only
@RestController
@RequestMapping("/dev/test/errors")
@Tag(name = "dev.ErrorTest", description = "Error handling test endpoints")
@SimpliXStandardApi
public class ErrorTestRestController {

    @GetMapping("/not-found")
    @Operation(summary = "Simulate 404")
    @PreAuthorize("hasPermission('DevTest', 'view')")
    public SimpliXApiResponse<Void> testNotFound() { ... }
}
```

### Dev/Test Controller Exception Policy

Dev/test controllers (`@Profile({"local", "dev"})`) still MUST follow all conventions:
- `@PreAuthorize` required (use `hasPermission('DevTest', 'view')` or `permitAll()`)
- `SimpliXApiResponse<T>` required (not `ResponseEntity`)
- `@Operation` on every endpoint

**Exception**: `ErrorTestRestController` intentionally throws various exception types to test the global error handler. This is the ONLY controller allowed to use `ResponseEntity` and throw `RuntimeException`/`ResponseStatusException` directly, because its purpose is to verify error handling behavior. Mark such controllers with a class-level JavaDoc: `/** Error handling test — intentionally violates response conventions. */`

---

## Checklist for Non-CRUD Controllers

- [ ] `@RestController` + `@RequestMapping` + `@Tag` + `@SimpliXStandardApi` at class level
- [ ] Explicit constructor (no `@RequiredArgsConstructor`)
- [ ] Every method returns `SimpliXApiResponse<T>`
- [ ] Every method has `@PreAuthorize`
- [ ] Every method has `@Operation(summary = "...")`
- [ ] Method annotation order: `@XxxMapping` → `@Operation` → `@PreAuthorize`
- [ ] No `ResponseEntity`, no raw return types
- [ ] No `@Autowired`

## See Also

- Annotation ordering (class + method level) → `annotation-ordering.md`
- Common anti-patterns to avoid → `anti-patterns.md`
- JavaDoc formatting → `javadoc.md`
