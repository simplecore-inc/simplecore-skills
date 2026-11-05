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

Spring's test context cache keeps every context it built until the test JVM exits, so each class
whose configuration differs (its own `@Import`, its own nested `@TestConfiguration`, its own
properties) adds a context the heap holds beside every full-application test. One more schema-test
class is enough to tip it: the symptom is an `OutOfMemoryError` while a different, unrelated class
loads its context (a resource download test, an actuator test), and which class fails moves between
runs. Measure it by excluding the new class with an init script
(`tasks.withType(Test) { filter { excludeTestsMatching '*<NewClass>' } }`); when the suite is green
without it, close the class's context after it runs with
`@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)`.

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

