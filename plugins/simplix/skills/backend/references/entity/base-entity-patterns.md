# Base Entity Patterns

`BaseEntity` and the cross-cutting concerns it enables.

> **Scope (canonical):** `BaseEntity<String>`, audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`), soft delete (`@SQLDelete` + `deleted` / `deletedAt`), domain events (`@EntityEventConfig`), lifecycle callbacks, FK string normalization. For field-level type rules see **field-types.md**; for relationships see **relationship-patterns.md**; for security/PII see **entity-security-patterns.md**.

---

## Where to Create the Entity File

Before writing the entity class, decide which domain Gradle module owns it. Entities are **not** centralized in a single `packages/domain` module — they live in aggregate-specific sub-modules.

### Path convention

```
packages/domain-{aggregate}/src/main/java/{basePackage}/domain/{module}/entity/{EntityName}.java
```

- `{aggregate}` is the Gradle module suffix (e.g. `facility-config`, `facility-runtime`, `user`).
- `{module}` is the Java package segment under `{basePackage}.domain` for the same aggregate (e.g. `facilityconfig`, `facilityruntime`, `user`). Keep it aligned with the Gradle module name, minus the hyphens.
- `{EntityName}` is the PascalCase entity class name.

### Discovering existing modules

Run either of the following to list the current domain modules before creating a new file:

```bash
ls packages/domain-*
```

```bash
cat settings.gradle.kts | grep domain
```

### How modules are usually split

| Gradle module | Typical responsibility |
|---|---|
| `domain-<area>-config` | Configuration entities of one feature area (definitions, policies, schedules) |
| `domain-<area>-runtime` | Runtime event / message entities of the same area (events, device state, sync payloads) |
| `domain-user` | User and organization entities (accounts, roles, organizations) |

Cross-cutting foundations (`domain-core`, `domain-audit`, `domain-auth`, `domain-file`, `domain-system`) ship with the stack — reuse them only when the entity genuinely belongs to that concern. Read the project's own `settings.gradle` for the modules it actually has.

### When no existing module fits

If the new entity does not belong to any existing `domain-*` module, do **not** force-fit it into the closest one. A new Gradle module may be required. Pause and **coordinate with the project owner** before creating a new module — module boundaries affect dependency graphs, build times, and publishing.

---

## BaseEntity Overview

All entities in a SimpliX project extend `BaseEntity<ID>`, which provides:
- Audit fields (createdAt, updatedAt, createdBy, updatedBy)
- Soft delete support (deletedAt)
- Optimistic locking (version)
- Domain event support
- i18n label support

### Basic Entity Structure

```java
@Entity
@Audited
@Table(name = "table_name")
@EntityEventConfig(
    onCreate = "MY_ENTITY_CREATED",
    onUpdate = "MY_ENTITY_UPDATED",
    onDelete = "MY_ENTITY_DELETED"
)
@Comment("Entity description")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MyEntity extends BaseEntity<String> {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID, generator = "uuid-v7")
    @UuidV7Generator
    @Column(name = "entity_id", nullable = false, unique = true, updatable = false)
    private String entityId;

    // ... entity-specific fields

    @Override
    public String getId() {
        return getEntityId();
    }

    @Override
    public void setId(String id) {
        setEntityId(id);
    }
}
```

---

## Audit Fields

### Automatic Fields from BaseEntity

These fields are automatically managed by Spring Data JPA:

| Field | Type | Purpose | Annotation |
|-------|------|---------|------------|
| `createdAt` | `Instant` | Creation timestamp | `@CreatedDate` |
| `updatedAt` | `Instant` | Last update timestamp | `@LastModifiedDate` |
| `createdBy` | `String` | Creator user ID | `@CreatedBy` |
| `updatedBy` | `String` | Last modifier user ID | `@LastModifiedBy` |
| `version` | `Long` | Optimistic lock version | `@Version` |

### Hibernate Envers Auditing

Add `@Audited` to enable audit history:

```java
@Entity
@Audited  // Enables audit trail in _AUD table
public class MyEntity extends BaseEntity<String> {
    // ...
}
```

To exclude specific fields from audit:

```java
@NotAudited
@Column(name = "search_index")
private String searchIndex;
```

---

## Soft Delete

> **Current pattern**: SimpliX uses the `SoftDeletable` interface with `@SQLDelete` + `@Filter`:
> ```java
> @SQLDelete(sql = "UPDATE table_name"
>     + SoftDeletable.SQL_SOFT_DELETE_SET
>     + "id = ?" + SoftDeletable.SQL_VERSION_CHECK)
> @Filter(name = SoftDeletable.FILTER_NAME,
>     condition = "deleted = :isDeleted")
> public class Entity extends BaseEntity<String> implements SoftDeletable {
>     @Builder.Default
>     private Boolean deleted = false;
>     @Builder.Default
>     private Long deletedTimestamp = -1L;
> }
> ```
> The `@FilterDef` is declared on `BaseEntity` — individual entities do NOT need it. DTO validation uses `softDeleteField = "deleted"` with `SoftDeleteType.BOOLEAN` in `@UniqueFields`.

### How It Works

- `@SQLDelete` overrides `DELETE` SQL → sets `deleted = true` and `deleted_timestamp = epoch millis`
- `@Filter` hides deleted records by default (Hibernate session filter)
- `@FilterDef` is declared once on `BaseEntity` — individual entities do NOT need it
- Service-layer soft delete is handled by `deleteById(id)` / `deleteAllByIds(ids)` from `SimpliXBaseService` — no manual `setDeleted()` needed

---

## Domain Events

### Configuration

Use `@EntityEventConfig` to define events:

```java
@EntityEventConfig(
    onCreate = "MY_ENTITY_CREATED",
    onUpdate = "MY_ENTITY_UPDATED",
    onDelete = "MY_ENTITY_DELETED"
)
public class MyEntity extends BaseEntity<String> {
    // ...
}
```

### Event Type Constants (Optional)

For modules with many entities, define constants in a `{Module}EventTypes` class:

```java
public final class MyModuleEventTypes {
    public static final String MY_ENTITY_CREATED = "MY_ENTITY_CREATED";
    public static final String MY_ENTITY_UPDATED = "MY_ENTITY_UPDATED";
    public static final String MY_ENTITY_DELETED = "MY_ENTITY_DELETED";
}
```

### Custom Event Payload

Implement `DomainEventPayloadProvider` for custom payloads:

```java
@Entity
public class MyEntity extends BaseEntity<String>
    implements DomainEventPayloadProvider {

    @Override
    public Map<String, Object> getEventPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("entityId", this.entityId);
        payload.put("name", this.name);
        payload.put("status", this.status);
        return payload;
    }
}
```

### Event Handler

```java
@Component
@RequiredArgsConstructor
public class MyEntityEventHandler {

    @EventListener
    @Async
    public void handleMyEntityCreated(DomainEvent event) {
        if ("MY_ENTITY_CREATED".equals(event.getEventType())) {
            // Handle creation event
        }
    }
}
```

---

## Lifecycle Callbacks

### @PrePersist / @PreUpdate

Use for computed fields like search index:

```java
@Entity
public class MyEntity extends BaseEntity<String> {

    @Column(name = "name")
    private String name;

    @Type(JsonType.class)
    @Column(name = "name_i18n", columnDefinition = "TEXT")
    private Map<String, String> nameI18n;

    @Column(name = "search_index", columnDefinition = "TEXT")
    @NotAudited
    private String searchIndex;

    @PrePersist
    @PreUpdate
    private void generateSearchIndex() {
        this.searchIndex = SearchIndexBuilder.create()
            .text(name)
            .i18n(nameI18n)
            .build();
    }
}
```

### Common Use Cases

| Callback | Use Case |
|----------|----------|
| `@PrePersist` | Generate computed fields before insert |
| `@PreUpdate` | Update computed fields before update |
| `@PostLoad` | Initialize transient fields after load |
| `@PostPersist` | Send notifications after insert |

---

## i18n Support

### Entity Label

BaseEntity provides `getEntityLabel()` for display names:

```java
// Returns localized entity name from messages.properties
String label = entity.getEntityLabel();
```

### Field Label

For field names:

```java
// Returns localized field name
String fieldLabel = entity.getFieldLabel("status");
```

### Message Properties

Location: `modules/domain/.../resources/messages/entities/{module}/`

```properties
# entities-cms-messages.properties
entities.CmsChannel=Channel
entities.CmsChannel.name=Name
entities.CmsChannel.channelCode=Channel Code
entities.CmsChannel.active=Active
```

---

## Required Annotations Checklist

| Annotation | Purpose | Required |
|------------|---------|----------|
| `@Entity` | JPA entity marker | Yes |
| `@Audited` | Hibernate Envers audit | Recommended |
| `@Table(name = "x")` | Table name | Yes |
| `@EntityListeners(EntityEventPublishingListener.class)` | Event support (already declared in BaseEntity) | Not needed |
| `@EntityEventConfig` | Event types | When using events |
| `@Comment` | Column/table description | Recommended |
| `@Getter @Setter` | Lombok accessors | Yes |
| `@NoArgsConstructor @AllArgsConstructor` | Constructors | Yes |
| `@Builder` | Builder pattern | Recommended |

---

## FK String Normalization (Empty String to NULL)

### The Problem

In SQL, empty strings (`''`) and `NULL` are different values:
- `'' IS NULL` returns `FALSE`
- `NULL IS NULL` returns `TRUE`

This causes issues with:
1. **Check constraints** that use `IS NULL` conditions
2. **JPA EAGER fetch** trying to load entities with empty string IDs (EntityNotFoundException)
3. **FK lookups** failing to find entities with empty string IDs

### Solution: FkNormalizer Utility

Use `FkNormalizer` utility class to normalize empty strings to null:

```java
import {basePackage}.domain.core.util.FkNormalizer;

@Entity
public class MyEntity extends BaseEntity<String> {

    @Column(name = "parent_id")
    private String parentId;

    @Column(name = "category_id")
    private String categoryId;

    @PrePersist
    @PreUpdate
    private void prePersistAndUpdate() {
        // Normalize FK fields
        normalizeFkFields();

        // Other lifecycle logic (search index, etc.)
    }

    /**
     * Normalizes empty/blank string FK fields to null.
     */
    private void normalizeFkFields() {
        this.parentId = FkNormalizer.normalize(this.parentId);
        this.categoryId = FkNormalizer.normalize(this.categoryId);
    }

    // Custom setter for direct setter calls
    public void setParentId(String parentId) {
        this.parentId = FkNormalizer.normalize(parentId);
    }
}
```

### When to Apply FK Normalization

Apply to fields that are:
1. **Nullable FK fields** (parentId, categoryId, authorId, etc.)
2. **Fields used in @Check constraints** with `IS NULL` conditions
3. **Self-referencing tree fields** (parentId in TreeEntity)
4. **Optional relationship fields** that may receive empty strings from forms/APIs

### FkNormalizer API

```java
// Single value normalization
String normalized = FkNormalizer.normalize(value);
// Returns: null if value is null/empty/blank, otherwise original value

// Batch normalization
String[] normalized = FkNormalizer.normalizeAll(val1, val2, val3);

// Check if effectively null
boolean isNull = FkNormalizer.isEffectivelyNull(value);
```

### Check Constraint Example

For entities with @Check constraints:

```java
@Check(
    constraints = "active IN (true, false) AND " +
        "((target_type = 'ROLE' AND role_id IS NOT NULL AND user_id IS NULL) OR " +
        "(target_type = 'USER' AND user_id IS NOT NULL AND role_id IS NULL))"
)
public class AuthRolePermission extends BaseEntity<String> {

    @Column(name = "role_id")
    private String roleId;

    @Column(name = "user_id")
    private String userId;

    @PrePersist
    @PreUpdate
    private void prePersistAndUpdate() {
        normalizeFkFields();
    }

    private void normalizeFkFields() {
        // CRITICAL: Empty string '' != NULL
        // Check constraint requires IS NULL, not empty string
        this.roleId = FkNormalizer.normalize(this.roleId);
        this.userId = FkNormalizer.normalize(this.userId);
    }
}
```

### Why Both Setter AND @PrePersist?

1. **Custom Setter**: Handles direct calls to setter methods
2. **@PrePersist/@PreUpdate**: Handles `@Builder` which bypasses setters

```java
// @Builder bypasses setters - goes directly to fields
MyEntity entity = MyEntity.builder()
    .parentId("")  // Empty string goes directly to field
    .build();

// Without @PrePersist normalization, this would fail:
// - Check constraints expecting IS NULL
// - EAGER fetch trying to load parent with empty ID
```

---

## See Also

- [Field Types](field-types.md) - All field type patterns
- [Relationship Patterns](relationship-patterns.md) - FK and relationships
- [Tree Entity Patterns](tree-entity-patterns.md) - Hierarchical structures
