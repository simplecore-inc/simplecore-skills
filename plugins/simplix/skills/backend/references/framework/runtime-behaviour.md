# What the framework does that the code does not show

Behaviours of the SimpliX runtime that no file in the project states, and whose symptoms point
somewhere else. They are not conventions to follow - they are facts to know before reading a
symptom.

## Contents

1. [The token endpoint takes HTTP Basic, and the spec does not say so](#the-token-endpoint-takes-http-basic-and-the-spec-does-not-say-so)
2. [Token issue has no event - the provider is the only seam](#token-issue-has-no-event--the-provider-is-the-only-seam)
3. [Generated CRUD writes no audit event](#generated-crud-writes-no-audit-event)
4. [A create request overwrites the entity's defaults with null](#a-create-request-overwrites-the-entitys-defaults-with-null)
5. [Never run a build while the application is running](#never-run-a-build-while-the-application-is-running)
6. [A properties record does not take `@Validated`](#a-properties-record-does-not-take-validated)
7. [A `@DataJpaTest` slice does not load the project's JPA configuration](#a-datajpatest-slice-does-not-load-the-projects-jpa-configuration)
8. [A limit test needs more than one owner](#a-limit-test-needs-more-than-one-owner)
9. [Two Gradle subprojects never share a leaf name](#two-gradle-subprojects-never-share-a-leaf-name)
10. [A bare body is served bare, and the documents still say enveloped](#a-bare-body-is-served-bare-and-the-documents-still-say-enveloped)
11. [A transactional class is proxied by its interface](#a-transactional-class-is-proxied-by-its-interface)
12. [A scheduler lock needs the scheduler switched on](#a-scheduler-lock-needs-the-scheduler-switched-on)
13. [A Gradle build stops at the first red module](#a-gradle-build-stops-at-the-first-red-module)
14. [A framework snapshot is published by its owner only](#a-framework-snapshot-is-published-by-its-owner-only)
15. [Overriding `configureMessageConverters(List)` drops Spring's defaults](#overriding-configuremessageconverterslist-drops-springs-defaults)
16. [A refused search sort answers 200 with an error body](#a-refused-search-sort-answers-200-with-an-error-body)
17. [A test class with a context of its own keeps it for the whole test JVM](#a-test-class-with-a-context-of-its-own-keeps-it-for-the-whole-test-jvm)
18. [A field the request DTO lacks is dropped, never refused](#a-field-the-request-dto-lacks-is-dropped-never-refused)
19. [A public route's CORS is the handler's, and a standalone dispatcher cannot answer its preflight](#a-public-routes-cors-is-the-handlers-and-a-standalone-dispatcher-cannot-answer-its-preflight)
20. [A defaulted address makes a keyless provider read as configured](#a-defaulted-address-makes-a-keyless-provider-read-as-configured)
21. [A gate that locks only where it limits leaves its idempotency read racing](#a-gate-that-locks-only-where-it-limits-leaves-its-idempotency-read-racing)
22. [A connection pool built beside the DataSource bean is never closed and joins no transaction](#a-connection-pool-built-beside-the-datasource-bean-is-never-closed-and-joins-no-transaction)

---

## The token endpoint takes HTTP Basic, and the spec does not say so

`POST /auth/token/issue` reads the username and password from an
`Authorization: Basic` header - `SimpliXAuthSecurityConfiguration` says so in a comment on
that path's filter chain, and that comment is the only place it is written down. A **filter**
handles it, not a controller, so springdoc has no method to read and **the generated spec
carries no request body for that path** - reading the API document answers nothing about what
to send.

```bash
curl -s -u '<username>:<password>' -X POST "$API/api/v1/auth/token/issue"
```

**A JSON body comes back 401 `AUTH_INVALID_CREDENTIALS`** - the same code, the same message,
and the same user-facing sentence as a wrong password. So a wrong request **shape** and a
wrong **password** are indistinguishable from the outside, and the natural conclusion from a
run of failures is that the credentials are stale.

Two things make that conclusion look confirmed, and neither is evidence:

- **Every account fails, which reads as "the seed is broken".** Of course they do - the shape
  is wrong for all of them.
- **The log line `Unable to extract username` looks like the explanation and is not.** It comes
  from the audit handler reading the `Authorization` header of a *failed* request; a sign-in
  request legitimately has none, so that line is normal.

**Before concluding a password is wrong, send one request with `-u`.** If it returns 200 and a
token, nothing was ever wrong with the credentials.

## Token issue has no event - the provider is the only seam

`TokenAuditEventPublisher` declares `publishTokenIssueSuccess`, and **no framework code calls
it** (renewal, revocation and refusal are all published). So there is no event to subscribe to
for "a token was issued", and anything that has to happen at issue time - writing a session
row, recording a device - has nowhere to listen.

**Override the provider instead.** `SimpliXJweTokenProvider` is a plain public class whose
`createTokenPair` and `refreshTokens` are both overridable. Four things about doing it:

- **The provider class is itself an `@AutoConfiguration`**, so it registers itself as a bean. A
  `@ConditionalOnMissingBean` factory therefore never wins - **the replacement needs
  `@Primary`.** Without it the context fails to start, and **the failure message names an
  unrelated filter registration**, so the search starts in the wrong place.
- **The two tokens carry no shared claim.** Access and refresh each get their own random
  identifier and nothing links them, so a refresh request cannot be traced to the session it
  belongs to by reading the token. Whatever records the session has to store the refresh
  token's identifier itself - and a revocation check built without that link **silently blocks
  nothing**: a signed-out session refreshes back to life and its expiry moves out a month.
- **Record renewal in the provider, never from the refresh-success event.** The event the
  framework publishes on a refresh (`TokenAuditEventPublisher.publishTokenRefreshSuccess`, which
  a project may republish as a lifecycle event of its own) arrives **before** the provider has
  written the new identifier, and it carries the new one as `jti` - the previous identifier is
  only inside `additionalDetails` (`oldJti`), not a field of its own. So a listener looking the
  session up by what the event carries never finds it, and a listener that opens a new row when
  it finds nothing **adds one row per refresh**. Those extra rows carry no refresh-token
  identifier, so signing one of them out of a device list does nothing to the real session:
  the screen reports the device signed out and the device keeps working. Only the provider has
  both identifiers and the presented credential at once.
- **Issue now performs a database write**, which changes the timing of anything measuring token
  lifetime. A test that issues a token with a one-second lifetime and validates it immediately
  becomes flaky; widen the lifetime rather than the assertion.

Assert the invariant directly: after one sign-in and one refresh, the session table holds
**one** row.

## Generated CRUD writes no audit event

`SimpliXBaseService`'s create / update / delete write **nothing** to the audit table. Only a
hand-written service that records one does.

The consequence is structural rather than accidental: **a generated entity's history view is
permanently empty.** Updating the record through its own generated endpoint adds no event, so
the screen counts zero and draws zero. It is not lying - it counted - but a zero there reads as
"nobody has ever changed this", and that is the wrong sentence.

So before building a history surface over a generated entity, decide who writes the event.
Where nothing does yet, say so on the screen rather than letting an honest zero stand in for a
history.

## A create request overwrites the entity's defaults with null

A create copies the request onto a new entity: `new Entity()`, then
`modelMapper.map(createDto, entity)`. The entity's defaults (`@Builder.Default`, a field
initializer; Lombok's `@NoArgsConstructor` applies the `@Builder.Default` ones) are in place before
the copy, and a mapper that copies absent values replaces each of them with `null`.

**The framework decides it.** The mapper bean `SimpliXModelMapperAutoConfiguration` builds installs
`CreateRequestNullSkipCondition` (`dev.simplecore.simplix.web.mapping`): a `null` is skipped only
when the root object being mapped is a `*CreateDTO`, the role name the generator gives every create
request. An update request replaces the record and a `null` in it still clears a field; the
`*UpdateDTO` extends its `*CreateDTO`, and the condition reads the class of the object being
mapped, so the subclass is not mistaken for its parent. `install` wraps any property condition the
mapper already has and runs once.

- **Symptom on a framework without it:** `POST .../create` without an optional field answers 409
  with `null value in column "<col>" violates not-null constraint`, on a form that sent every field
  it has; on a nullable column the default is silently replaced by null. Bean validation passes and
  the generated service tests mock the mapper, so the screen is the first thing that sees it.
- **Never patch it per service or per project.** `if (dto.getActive() == null)
  entity.setActive(true)` in one `create` leaves every other entity with the defect, and a project
  copy of the condition duplicates the framework's. A project on an older SimpliX upgrades it.
- **Never replace the SimpliX mapper bean.** It is `@ConditionalOnMissingBean`, and a replacement
  drops the condition along with the time zone and `Map` converters.
- **Keep the classpath guard in the deployable module.** A test scans the `*DTOs` containers for
  `*CreateDTO`, maps an empty one onto `new <Entity>()` with the real bean
  (`ApplicationContextRunner` over `SimpliXModelMapperAutoConfiguration`), and fails on any
  property that was non-null before and is null after. It reads the classpath, so a DTO added later
  is covered, and it fails the build on a framework version without the condition.
- **The contract and the yml disagree here.** `yo simplix:config` writes `required: true` for
  every NOT NULL column, defaulted ones included, and the DTO template turns `required` into
  `@NotNull`. A NOT NULL column with an entity default is optional in the contract: set
  `required: false` on it in the yml, so a regeneration does not make the form demand it.
- `audit-backend.mjs` reports `create-request-overwrites-entity-default` while services map a
  create request, entities declare defaults, and neither a mapper configuration in the project nor
  the SimpliX starter jar the project resolves (the version in its build files) skips absent
  fields.

## Never run a build while the application is running

`bootRun` holds the build output open, and a `build` in the same tree replaces the classes
under it - the running application then dies with `NoClassDefFoundError` on the next class it
had not yet loaded. The error names a class and says nothing about the build that removed it,
so it reads as a missing dependency.

Stop the application, build, start it again. This is the backend half of the same rule the
frontend has for typechecking against a running dev server.

## A properties record does not take `@Validated`

A `@ConfigurationProperties` record cannot be proxied, so `@Validated` on it stops the full
application context, while a slice test that never binds the record passes. Check the values in
the record's compact constructor and throw there. The audit's `validated-properties-record` fails it.

## A `@DataJpaTest` slice does not load the project's JPA configuration

Auditing (`@CreatedDate`, `@LastModifiedDate`, the auditor) and the project's repository settings
live in its own JPA configuration class, which a slice does not scan. Import it into every
`@DataJpaTest`, or each insert fails on a null `created_at`.

## A limit test needs more than one owner

A per-account limit and a global limit refuse the same request when the test uses one account,
so a missing global gate passes. Prove a global limit with requests spread across several
accounts in parallel, and a per-user limit with one user spending from several accounts.

## Two Gradle subprojects never share a leaf name

`:modules:<a>:<name>` and `:modules:<b>:<name>` both publish `<group>:<name>` when every subproject
takes one shared group, and Gradle's conflict resolution silently substitutes one for the other on a
consumer's classpath. Where the consumer imports a type from the dropped one, the build fails with
"package does not exist". **Where it imports nothing, which is the application module depending on
feature modules, the build stays green**: the dropped module compiles, its own tests pass (they run
inside it), and its controllers answer 404 "No static resource" on the running server, missing from
the OpenAPI document and SimpliX Meta as well. Library jars named after the bare project name collide
the same way inside the boot archive.

Either give every subproject a unique last segment, or make the coordinates unique in the
convention plugin: derive `group` from the project's parent path and name each library jar after
the full path. `audit-backend.mjs` rule `gradle-subprojects-share-a-name` reads `settings.gradle` and
fails on a repeated last segment unless a build script assigns `group` from the path. A test in the
application module that loads every `@RestController` found in the included modules' sources catches
the classpath half whatever its cause.

## A bare body is served bare, and the documents still say enveloped

`SimpliXResponseBodyAdvice` ships in the starter and no configuration registers it, so an endpoint
that returns a DTO directly answers the bare DTO, while the springdoc schema customizer and SimpliX
Meta still document it inside `SimpliXApiResponse`. A client generated from those documents
unwraps a field that is not there. Return `SimpliXApiResponse` from every endpoint the generated
frontend reads; an endpoint that must answer a bare body is documented by hand and read by a
hand-written client.
Example: `public <Entity>Summary summary()` answers `{"total":5}` while Meta says `{"body":{"total":5}}`.

## The server writes without null fields, so a required nullable field is written on purpose

SimpliX's Jackson configuration leaves out every null field. A bare body held to an external schema
that requires a key and allows it to be null (`subscription: null` on the free plan, `retryUntil: null`
when nothing is known) therefore loses the key, and the client's parser refuses the body. Put
`@JsonInclude(JsonInclude.Include.ALWAYS)` on each such field, and the opposite where the schema is a
`oneOf` whose shapes forbid each other's keys: one record with every key written fails both shapes, so
that record takes `NON_NULL` and writes only its own shape's fields. A contract test reads the body
through the server's own converters (a `ServerJson`-style helper built from the same configuration),
or it measures Jackson's defaults instead; a mutant that drops one `ALWAYS` turns it red.

## A transactional class is proxied by its interface

`@Transactional` on a class that implements an interface yields a JDK proxy, so a test or a bean
that autowires the concrete class fails with `BeanNotOfRequiredTypeException`. Autowire the
interface.
Example: `@Autowired JobQueueService` fails where `@Autowired JobQueue` starts.

## A scheduler lock needs the scheduler switched on

`@SchedulerLock` locks nothing unless the domain scheduler is enabled
(`application.domain.scheduler.enabled`) so `@EnableSchedulerLock` and the lock provider load, the
JDBC lock provider is on the server's classpath, and a migration creates the `shedlock` table in
every profile (a local-profile initializer is not a migration). Enabling the domain scheduler also
starts every framework scheduler it owns, the audit purge among them; say so in the change. The
scheduler aspect records duration only, so a job that must report how many items it handled logs
that count itself.
Example: `simplix.scheduler.mode: in-memory` with the switch unset ran every `@SchedulerLock` job unlocked on each node.

## A Gradle build stops at the first red module

`./gradlew build` stops at the first module whose tests fail, so a test in another module that the
change also breaks is neither run nor reported. When a change touches a shared bundle or a shared
type, run the affected tests of every module by name (or `--continue`), and read the test XML
under `build/test-results/` for the failure text: the summary says which task failed, not why.
Example: an orphaned label key failed the entity message test in a module the first failure hid; a migration naming the wrong table showed "relation does not exist" only in the XML.

## A framework snapshot is published by its owner only

Every backend on the machine resolves the framework snapshot from `~/.m2`, so
`publishToMavenLocal` from a framework checkout changes the API every other agent builds against.
A change that needs a framework addition (a new `ErrorCode`, say) is made without it where the
project can (map the refusal in the project's advice), and the framework change goes to whoever
owns the snapshot.
Example: publishing from a framework checkout three hours ahead of the last snapshot ships three hours of unreviewed API to every build on the machine.

## Overriding `configureMessageConverters(List)` drops Spring's defaults

A `WebMvcConfigurer` that adds anything to the list in `configureMessageConverters(List)` makes
Spring MVC skip its default converters, so the resource, resource region, form and XML converters
are never registered. Every `ResponseEntity<Resource>` then answers 500 with
`HttpMessageNotWritableException: No converter for [class ...UrlResource]`, while JSON endpoints
keep working. A contract test on `MockMvcBuilders.standaloneSetup` cannot see it, because the
standalone setup carries Spring's defaults whatever the application registers. Change converters
in `extendMessageConverters(List)`, which receives the default list, and prove a download with a
test over the real auto-configuration (`@SpringBootTest` on a random port, or a
`WebApplicationContextRunner` with `webAppContextSetup`), asking for a whole file and a `Range`.
The audit's `message-converters-replaced` refuses the override.
Example: `configureMessageConverters(c) { c.add(new StringHttpMessageConverter()); }` turns every file download into a 500.

## A refused search sort answers 200 with an error body

A search request that sorts by a field its SearchDTO does not declare `sortable = true` (or filters with
an operator the field does not allow) is refused in the body: `type: ERROR` and a `SEARCH_INVALID_*` code.
The starter's `handleSearchableException` builds that body from the error code and does not set the
HTTP status, so the response is **200**, and a list that reads the status sees a page with no rows
and says "nothing found". `determineSearchableErrorCode` also tests class names containing
"Validation" before "Sort", so a refused sort can carry `SEARCH_INVALID_PARAMETER` instead of
`SEARCH_INVALID_SORT_FIELD`. A sort the screen needs is declared `sortable = true` on the field
(a boolean cannot be: AP-38), and each sort a list offers is probed with a request whose body is
read, not only its status. The status, and the order of those class-name tests, are the framework owner's
to change (`A framework snapshot is published by its owner only`).
Example: `GET .../search?page=0&size=3&sort=noSuchField.desc` answers `200 {type: ERROR, errorCode: SEARCH_INVALID_PARAMETER}`.

## A test class with a context of its own keeps it for the whole test JVM

Spring's test context cache keeps up to 32 contexts until the test JVM exits, so each class whose
configuration differs (its own `@Import`, its own nested `@TestConfiguration`, its own properties)
adds a context the heap holds beside every other one: a `@DataJpaTest` slice holds a whole JPA
metamodel and a connection pool, and Gradle starts a test JVM with 512 MB unless the module sets
`maxHeapSize`. The symptom is an `OutOfMemoryError: Java heap space` while a different, unrelated
class loads its context (often a full-application test, which needs the most), sometimes the test
executor itself dying; which class fails moves between runs.

- **Measure it, two readings in one run, from an init script** so the tree is not touched:
  `-Dlogging.level.org.springframework.test.context.cache=DEBUG` on the test JVM writes the cache's
  `size`, `hitCount` and `missCount` at every lookup into each class's result XML (the console shows
  none of it), and a loop of `jcmd <pid> GC.class_histogram` (it forces a full GC) followed by
  `GC.heap_info` gives the live heap beside the count of `org.hibernate.internal.SessionFactoryImpl`
  and `HikariDataSource` instances. A live heap that climbs with the session factory count, and a
  `missCount` close to the number of context-using classes, say the cache holds contexts nothing
  reuses.
- **Cap the cache once, in the test convention every module applies**:
  `systemProperty 'spring.test.context.cache.maxSize', '1'` on `tasks.withType(Test)`. The context
  the cache lets go is closed with its pool, consecutive classes with one configuration still share
  one, and the heap a test JVM needs no longer grows with the number of classes. Closing contexts
  class by class with `@DirtiesContext` holds only until the next class with a configuration of its
  own, and a larger heap only moves the limit.
- **`@DirtiesContext(classMode = AFTER_CLASS)` stays only where a context must close for a reason of
  its own**, such as containers no other class reads, and the javadoc names that reason.
- **A closed context can stay in that live heap through soft references, and the histogram counts
  them.** Spring Boot keeps static `ConcurrentReferenceHashMap` caches keyed by a context's
  `Environment` (`OnAvailableEndpointCondition.accessResolversCache` and
  `exposureOutcomeContributorsCache`, `DataSourcePoolMetrics$CachingDataSourcePoolMetadataProvider.cache`),
  with soft entries, so each closed full-application context stays reachable and the live heap after
  `GC.class_histogram` climbs about 30 to 50 MB per class. The JVM clears soft references before it
  throws `OutOfMemoryError`, so that climb is not a leak. Run the same measurement a second time with
  `-XX:SoftRefLRUPolicyMSPerMB=0` on the test JVM (soft references cleared at every collection) as
  the control: what stays there is strongly held. That flag is a measurement setting, never the
  convention's.
- **Read what holds a closed context from a heap dump** when the control still climbs:
  `jcmd <pid> GC.heap_dump <file>` (a JUnit `TestExecutionListener` registered through
  `META-INF/services` in the export only can take it at `testPlanExecutionFinished`), then
  `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/hprof-paths.py" <file> org.hibernate.internal.SessionFactoryImpl 20`
  for the shortest strong path from a GC root to each session factory (`soft` as the fourth argument
  follows soft referents too; `strings` as the fifth decodes pool names and JDBC URLs). A static field
  overwritten by each new context (an entity listener's injected `EntityManagerFactory` or
  `ApplicationEventPublisher`) holds one closed context at most; a pool whose housekeeper thread is
  still running holds one per class that started it, which is the cumulative kind.

## A connection pool built beside the DataSource bean is never closed and joins no transaction

A bean that builds its own pool (`DataSourceProperties.initializeDataSourceBuilder().build()`,
`DataSourceBuilder.create()...build()`, `new HikariDataSource(...)`) and hands it to a
`JdbcTemplate` or a `SqlSessionFactory` gives the application a second pool. It is not a bean, so the
context never closes it and its `HikariPool-N:housekeeper` thread outlives every context; and it is
not the DataSource the JPA transaction manager binds, so every statement through it autocommits: a
`TransactionTemplate` around `jdbcTemplate.update(...)` rolls nothing back. The starter's own
`JdbcTemplate` takes the DataSource bean (`@ConditionalOnSingleCandidate(DataSource.class)`: with
several DataSources the primary one, with several and no primary none, and the application declares
its own).

- **The sign** is two `HikariPool-N - Starting` lines for one context in the log, the second on the
  first `JdbcTemplate` call, with only the first ever reaching `Shutdown completed`.
- **The proof** is a context test: `jdbcTemplate.getDataSource()` is the `DataSource` bean, a
  `JdbcTemplate` write inside a `TransactionTemplate` that sets rollback-only leaves no row, and after
  the context closes the pool the template used reports `isClosed()`.
- The audit's `data-source-built-beside-the-bean` flags each build outside a method returning the
  DataSource bean.

**And a class that failed runs first on the next Gradle run**, which is when a test that leaves rows
in the shared test database breaks another class that reads a whole table (`findAll()`): the order
that hid it is gone. A class that writes to the migrated test database removes its own rows in an
`@AfterEach`, by the keys it wrote, so no later class sees them whatever the order.

## A field the request DTO lacks is dropped, never refused

The SimpliX `ObjectMapper` (`SimpliXJacksonAutoConfiguration`, the primary mapper the MVC
converter is built from) disables `FAIL_ON_UNKNOWN_PROPERTIES`. A body carrying a field its DTO
does not declare binds without it and the request answers as if the field were never sent: no 400,
no log line.

- **So a value the server owns is kept from the client by leaving it out of the request DTO**, and
  a server-derived value (an expiry, a status, an owner) needs no refusal branch. A field added to
  the DTO "to reject it" invites a later edit that starts honouring it.
- **A test that proves the client cannot set it reads the body through the application's own
  mapper**, the primary `ObjectMapper` bean `SimpliXJacksonAutoConfiguration` registers, never a
  reader the test builds. A hand-built `new ObjectMapper()` carries Jackson's defaults, so what it
  proves is Jackson, not this application's configuration, and it still passes when the
  application's mapper is replaced by a stock one. The test reads the body twice with that bean:
  once through `mapper.copy().enable(FAIL_ON_UNKNOWN_PROPERTIES)`, which must throw
  `UnrecognizedPropertyException` naming the field (the DTO has no such property), and once as the
  bean stands, after which the written row carries the server's value and not the supplied one.
  Name the test for what happens (`..._is_ignored_...`), since nothing is refused. Prove the test
  discriminates by swapping the bean for `new ObjectMapper()` once: the second read must fail.
- **A `@DataJpaTest` slice has no Jackson auto-configuration, so the test adds it**:
  `@ImportAutoConfiguration(SimpliXJacksonAutoConfiguration.class)` on the class and
  `@Autowired ObjectMapper`. The slice needs no web layer for this.
- **The flip side is a client typo**: a misspelt optional field is silently absent too, and the
  server applies its default. A screen that sends a field the DTO lacks is found by comparing the
  request body with the DTO (the frontend's generated request type), never by a server error.

## A public route's CORS is the handler's, and a standalone dispatcher cannot answer its preflight

A security chain that never calls `.cors(...)` adds no CORS filter, so a route under it answers a
browser origin with no `Access-Control-Allow-Origin` at all, whatever `simplix.auth.cors` lists:
that setting reaches only the chains that configure it. The way to open one public route to one
browser origin is the handler's own mapping, `@CrossOrigin(origins = "${<property>}")` on the
controller, which Spring MVC applies after the security chain has let the request through. An origin
it does not list is refused by Spring's CORS processor with 403 and no allow header, a request with
no `Origin` (a desktop client, an installer) is untouched, and the global origins stay off the route.

- **A standalone `MockMvc` serves the GET and cannot serve the preflight.** `standaloneSetup`
  registers only the annotated-controller adapter, so an `OPTIONS` with
  `Access-Control-Request-Method` fails with `No adapter for handler [...PreFlightHttpRequestHandler]`.
  Prove the allowed and refused GET there (resolve the placeholder with `addPlaceholderValue`), and the
  preflight through the running server (`@SpringBootTest(webEnvironment = RANDOM_PORT)` and an HTTP
  client), which also proves the security chain lets `OPTIONS` through.
- **The refusal has two halves**: the foreign origin answers 403 and carries no allow header. A 403
  alone can be any other refusal.

## A signed-in route's CORS is the chain's source, and a handler's `@CrossOrigin` cannot widen it

The resource-server chain calls `.cors(cors -> cors.configurationSource(corsConfigurationSource))` with
the bean SimpliX builds from `simplix.auth.cors` for `/**`, so its `CorsFilter` answers every
preflight before any handler runs: an origin the shared list lacks is refused with 403 there, and a
`@CrossOrigin` on the controller is never reached. The bean is `@ConditionalOnMissingBean(name =
"corsConfigurationSource")`, so a project opens one path to one browser origin by declaring a bean of
that name that answers the path's own configuration and delegates every other request to
`SimpliXCorsConfigurations.source(auth.getCors())`.

- **The path's configuration replaces the shared one, it does not merge with it.** It names its
  origin, its methods, every request header the client sends (a custom token header included) and
  every response header the script must read (`Retry-After`), or the browser refuses them.
- **A development profile's `allowed-origin-patterns: "*"` does not reach the path**, so a foreign
  origin is refused there locally too; elsewhere `"*"` still answers, which is why a local curl alone
  proves nothing about the other paths.
- **Prove it through the running server** (`RANDOM_PORT`): the preflight from the origin (200, its
  allow headers), the same preflight from another origin (403), a plain request carrying the expose
  header, and a control path outside the replaced one refusing the origin. A mutant that drops the
  registration, the custom header or the expose header each turns one of those red.

## A held read parks as a `DeferredResult`, and a standalone `MockMvc` needs the async dispatch

A read the client lets the server hold (`wait` seconds until something arrives) returns a
`DeferredResult`, so it holds neither a request thread nor a database connection: each read is its own
short transaction, run when the read arrives, again when the write path reports after its commit that
something was stored for it, and a last time when the wait ends. The last read is what keeps it
correct where the wake cannot reach (another node, a missed notification): the read then answers late,
never wrong. The read that a wake runs is off the request thread, so the account it reads for is
captured when the read arrives; it never reads the security context. Bound the reads per account and
in total, and give the slot back on every way a read ends (answered, failed, the client gone).

- **A `DeferredResult` already set when the handler returns still starts async processing.** A
  standalone `MockMvc` then answers an empty response with `isAsyncStarted()`; the body exists only
  after `mvc.perform(asyncDispatch(result))`. A test helper dispatches whenever async started.
- **`MvcResult.getAsyncResult(ms)` throws `IllegalStateException` when nothing set the result**, which
  is the assertion that a read is still held. `MockAsyncContext` fires no timeouts, so the end of the
  wait is driven by the code's own scheduler, never by the container's async timeout; give the
  `DeferredResult` a timeout past the wait as a backstop only.
- **An exception set with `setErrorResult` is resolved on the async dispatch** by the same
  `@ControllerAdvice`, so a contract-shaped error body holds for a held read as for any other.
- **SimpliX Meta publishes the value a held read answers with, never the wrapper.** `DeferredResult`,
  `WebAsyncTask`, `Callable` and a `CompletionStage` (a `CompletableFuture` included) unwrap the way
  `ResponseEntity` does, nested in either order. A Meta document that names `DeferredResult` as a type
  was produced by a framework build without that unwrap: publish the framework again, restart the API
  and regenerate, rather than declaring the DTO some other way.
- **In-memory repositories have no row lock.** Two held reads of one queue woken together both take
  the same rows there; prove "taken once" on Postgres, and run the in-memory test's wakes on one thread.

## A defaulted address makes a keyless provider read as configured

An adapter for a self-hosted server with no key (an OpenAI-compatible speech or text server on the
developer's machine) usually judges itself configured by a non-blank base URL. When the property
carries a default (`${X_BASE_URL:http://127.0.0.1:<port>/v1}`, or `@DefaultValue` on the record), that
test can never fail: a server nobody named reads as configured, the fail-fast before the credit hold
passes, and the call that follows fails as unreachable. The client then sees the provider-failed
answer (502) after a hold was taken and released, where the contract promised the not-configured one
(503) with nothing held.

- **An address the operator must state has no default**, in the yml and in the properties record
  alike; the instruction for the developer's own server goes in the README and the env sample.
- **Do not answer it with a reachability probe in the configured check**: that turns an outage of a
  configured server into "not configured", which a client never retries.
- **The test builds the adapter with a blank address** (the test fixture that constructs adapters,
  not only the selector's properties, since the selector reads only the provider's name) and asserts
  503 and no hold on every path that reaches it: each kind of voice or model, and each purpose.

## A gate that locks only where it limits leaves its idempotency read racing

A monthly allowance gate commonly takes a per-person advisory lock (`pg_advisory_xact_lock`) and then
counts, and returns early when the plan sets no limit. When the same transaction then looks the
request's idempotency key up and inserts a row for it, the early return leaves that lookup unguarded
on exactly the unlimited plans: two requests carrying one key both find nothing, both insert, and the
second fails on the unique constraint instead of answering the replay.

- **Take the lock before the early return.** It costs one call per request and serialises every
  request of the person, so the second reads the first one's row.
- **The test needs a person on an unlimited plan** (a live subscription to a plan whose allowance
  column is null), two threads with one key, the first holding its transaction open between the
  lookup and the insert. Expect one row, one writer and one reader; with the lock after the return it
  fails on the unique constraint.


## The application zone also sets how every instant is written on the wire

`simplix.date-time.default-timezone` is more than the zone calendar dates are computed in.
`SimpliXDateTimeAutoConfiguration` sets the JVM default zone to it and configures the JSON converters
with it, so an `Instant` field leaves the server written with that zone's offset: with `UTC` it reads
`2026-11-06T00:00:00Z`, with `Asia/Seoul` the same instant reads `2026-11-06T09:00:00+09:00`. Stored
values (`timestamp with time zone`) do not change, and RFC 3339 `date-time` allows either form.

- **Set the server zone to the zone the apps draw dates in** (the frontend's `VITE_APP_TIME_ZONE` or
  its equivalent), from one deployment variable both read, and keep a repository check that fails when
  the two disagree. A server left on `UTC` while the screens read `Asia/Seoul` writes a consent given at
  08:10 in Seoul as the day before, and every `LocalDate` the server derives (a trial's last day, the
  day an allowance renews) is off the same way. A string a service derives with `Instant.toString()`
  stays `Z` whatever the zone, so one response can carry both forms.
- **Changing the zone of a running deployment changes the wire form of every instant at once.** Tell
  the clients' owners before the restart: a client or a test that matches a trailing `Z`, or compares
  timestamps as strings, sees the change though no value moved. A test that pins the wire form
  configures the mapper with an explicit zone (as a contract test's `ServerJson.configuration("UTC")`
  does), so it keeps passing and proves nothing about the deployment's zone.
- **A zone kept in a settings table is a second source.** An `ApplicationZone`-style resolver that
  reads a site or installation setting seeded from the property at first boot keeps the old zone after
  the property changes; say which readers use which source.

## A size cap is judged before the body is bound, not after

`@RequestBody` reads the whole body into the DTO before the method runs, and nothing in the
servlet stack limits a JSON body by default, so a cap checked in the service has already paid for the
memory and the parse. An endpoint whose contract answers 413 for an oversized body (a diagnostic
bundle, a pasted log) takes the request stream instead and reads it bounded.

- **Refuse on the declared `Content-Length` first, then read at most cap + 1 bytes**
  (`InputStream.readNBytes(cap + 1)`) and refuse when the read came back longer; only then parse with
  the application's `ObjectMapper` and validate with the injected `jakarta.validation.Validator`.
  Measure the cap in bytes, not characters: a log tail under the contract's character limit in a
  three-byte script (Korean) is three times the bytes.
- **Keep the OpenAPI shape on the operation**: `@Operation(requestBody = @RequestBody(content =
  @Content(schema = @Schema(implementation = <Dto>.class))))` with the OpenAPI annotation, and a
  one-line class javadoc saying why the body is a stream. The audit's `request-body-without-validated`
  leaves that attribute alone.
- **Prove both refusals separately.** A test with an oversized body and a `Content-Length` passes even
  without the length check, because the bounded read refuses it too; the length check is proven by a
  body stream that counts its reads and must read zero bytes. The bounded read is proven by a body with
  no declared length, which must stop one byte past the cap.
- **A contract test's refusal loop asserts which rule refused.** A schema validator that reports a
  keyword it does not implement (`maxItems`) as a violation makes every "the contract refuses this"
  assertion pass for the wrong reason; assert the violations hold none of the validator's own
  "unsupported" messages, and teach the validator the keyword.

## A refusal the security chain sends picks its body by the handler, never by a path list

A project that serves a second error shape beside the SimpliX envelope (a client contract with bare
bodies, marked by an annotation its controller advice is scoped to) has two places that write a
refusal: the advice, for errors inside a controller, and the security chain's entry point and
access-denied handler, for the 401 and 403 sent before any controller runs. When the chain picks the
shape from a configured list of paths, the list falls behind the annotation the first time a
controller joins the contract: its unauthenticated calls answer the envelope while its own refusals
answer the contract, and nothing fails, because each half is correct for the paths it knows.

- **Derive the chain's set from the handler mappings.** Read every `RequestMappingInfoHandlerMapping`
  bean's `getHandlerMethods()`, keep the entries whose bean type carries the marker annotation
  (`AnnotatedElementUtils.hasAnnotation`), and match a request's path against their
  `getPatternValues()`, which already include a prefix added with `PathMatchConfigurer.addPathPrefix`.
  The mappings are built after the security beans, so read them on the first request that needs them
  and cache only a non-empty answer. There is then no property to keep beside the annotation.
- **Hold it to the contract document with a test, not to itself.** Read the contract's operations that
  are not `security: []`, and assert each path is served by a marked controller or sits in a named,
  closed list of paths the server answers elsewhere, so a newly served path fails until it leaves the
  list. Then send each served operation through the running chain without a token and with a token no
  issuer signed, and assert the contract's 401 body, with a control path that keeps the envelope.
- **A chain that asks only for a sign-in never sends its 403 on those paths**: an authenticated caller
  is refused inside the controller, where the advice answers. Drive the context's access-denied handler
  bean directly for the 403 a later chain rule would send, and say that is what the test does.

## A re-sent request is proven idempotent with different content, never the same

A test that posts one body twice and asserts one stored row and a success passes as well when the
second post replaces the first, because a replacement also leaves one row. Re-send the same key (a
sequence number, an idempotency key) with a different body and assert the stored or returned content
is the first one; a replace-on-duplicate then fails it.

## A person's own setting written through a versioned read fails the later of two writes

A self-service write (`PATCH /me/locale`, the profile, notification preferences) that reads the
account with `findById`, sets a field and saves it relies on the row's `@Version`. Screens send such
writes several at a time: a language picker mounted in more than one place, a sign-in that
synchronises the stored choice while a tool sets another. Two that read the row together both pass
their own checks; the later commit fails with `ObjectOptimisticLockingFailureException`, which the
global handler answers as 500, and a pair that does not collide leaves the row with whichever
committed last while a side effect inside the transaction (an identity-provider sync) may hold the
other.

- **Read the row under its lock for the person's own writes**: a repository method
  `@Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select u from <Entity> u where u.<id> = :id")`, used
  by every self-write. Concurrent writes then run in turn, each answers 200, and the row and the side
  effect agree. Keep `findById` for reads, and keep the versioned write plus re-read for background
  writers (a first-call provisioning) that must never wait on a user's request.
- **Count before fixing**: the server log's `server_failure status=500 ... OptimisticLockException`
  lines name the path, and the request mappings logged in the same millisecond name the second
  writer.
- **The test drives two writes on the migrated schema and holds both inside the transaction** (a
  latch in the side effect that waits for the other write or a timeout), then asserts both succeed,
  the version moved twice, and the row equals the side effect's last value; with `findById` it fails
  with the production exception. Seed the field with a third value: a write equal to the stored value
  is no change, issues no UPDATE and cannot collide, so a seed equal to one of the two writes lets the
  unlocked version pass.
- **A write with no side effect is held in a collaborator it calls after the read**: the catalogue
  that judges an opt-out, or the clock a counted limit reads after its lock. A clock that counts down
  a latch of the number of writers and waits for it (or a fraction of a second) lets every writer
  that counts without the lock count before any commits, while writers under the lock read it one
  after another.
- **A slice that runs a service mapping an entity with `ModelMapper` imports the framework's mapper
  configuration** (`@ImportAutoConfiguration(SimpliXModelMapperAutoConfiguration.class)`). A plain
  `new ModelMapper()` refuses a DTO whose `<reference>Id` field matches both the entity's id column
  and its reference's id ("matches multiple source property hierarchies"), while the framework's
  configured mapper maps it.
- **An encrypted column makes such a slice test order-dependent.** `AesEncryptionConverter` keeps its
  service in a static field that only a full application context sets, so a slice that loads the
  entity passes after a `@SpringBootTest` class ran in the same JVM and fails alone. Give the
  converter a service with a key of the class's own in `@BeforeAll` (`SimpleKeyProvider` with a
  static key, `ReflectionTestUtils.setField(AesEncryptionConverter.class, "encryptionService", ...)`),
  restore the previous value in `@AfterAll`, and run the class alone once before trusting it.
