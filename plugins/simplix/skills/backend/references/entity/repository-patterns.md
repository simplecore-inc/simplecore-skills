# Repository Patterns Reference

Spring Data JPA repositories in SimpliX.

> **Scope (canonical):** `SimpliXBaseRepository<E, String>` (NOT plain `JpaRepository`), custom query methods, `@Query` usage, tree traversal helpers. For the `@SearchableField` / `SearchCondition` dynamic search infrastructure that sits on top of the repository, see `../review/searchable-field-patterns.md`, plus any searchable-JPA reference the project keeps under its own `.claude/`.

---

## Basic Structure

### Standard Repository

```java
package {basePackage}.domain.{module}.repository;

import {basePackage}.domain.{module}.entity.{EntityName};
import dev.simplecore.simplix.core.repository.SimpliXBaseRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface {EntityName}Repository extends SimpliXBaseRepository<{EntityName}, String> {
    // Custom query methods
}
```

### Composite Keys — FORBIDDEN

`@IdClass` and `@EmbeddedId` composite keys are **prohibited**. Every entity — including junction tables, time-series points, sync-state tuples, monitoring snapshots, and history tables — uses a single `@Id String id` (UUID v7) and expresses the business uniqueness of the composite columns as a `@Table(uniqueConstraints = @UniqueConstraint(columnNames = {...}))`.

```java
// CORRECT — single String id + unique composite index
@Entity
@Table(
    name = "user_group_member",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_group_member",
        columnNames = {"user_id", "group_id"}
    )
)
public class UserGroupMember extends BaseEntity<String> {
    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String groupId;
}

@Repository
public interface UserGroupMemberRepository
        extends SimpliXBaseRepository<UserGroupMember, String> {
    List<UserGroupMember> findByGroupId(String groupId);
    Optional<UserGroupMember> findByUserIdAndGroupId(String userId, String groupId);
}
```

**Why**: SKILL.md:133 mandates `<String>` ID for every entity. Composite keys break `SimpliXBaseService<E, String>` and `SimpliXBaseController<E, String>`, which cannot be specialized to a composite id class. The only exception is a **framework-imposed** alternative (e.g., Hibernate Envers `@RevisionEntity` requires `Long`) — and even that is confined to audit infrastructure.

### Tree Repository (Hierarchical Entities)

For entities implementing `TreeEntity` interface:

```java
package {basePackage}.domain.{module}.repository;

import {basePackage}.domain.{module}.entity.{EntityName};
import dev.simplecore.simplix.core.repository.SimpliXTreeRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface {EntityName}TreeRepository extends SimpliXTreeRepository<{EntityName}, String> {
    // Tree operations handled by TreeService
}
```

---

## Method Naming Convention

Spring Data JPA generates queries from method names.

### Basic Patterns

| Pattern | SQL Equivalent | Example |
|---------|---------------|---------|
| `findBy{Field}` | `WHERE field = ?` | `findByName(String name)` |
| `findBy{Field}And{Field2}` | `WHERE field = ? AND field2 = ?` | `findByNameAndActive(String name, Boolean active)` |
| `findBy{Field}Or{Field2}` | `WHERE field = ? OR field2 = ?` | `findByNameOrCode(String name, String code)` |
| `existsBy{Field}` | `SELECT COUNT(*) > 0` | `existsByEmail(String email)` |
| `countBy{Field}` | `SELECT COUNT(*)` | `countByStatus(Status status)` |
| `deleteBy{Field}` | `DELETE WHERE field = ?` | `deleteByExpiredAtBefore(Instant time)` |

### Comparison Operators

| Keyword | SQL | Example |
|---------|-----|---------|
| `Is`, `Equals` | `= ?` | `findByActiveIs(Boolean active)` |
| `Not` | `<> ?` | `findByStatusNot(Status status)` |
| `IsNull` | `IS NULL` | `findByDeletedAtIsNull()` |
| `IsNotNull` | `IS NOT NULL` | `findByPublishedAtIsNotNull()` |
| `LessThan` | `< ?` | `findByAgeLessThan(Integer age)` |
| `LessThanEqual` | `<= ?` | `findByPriceLessThanEqual(BigDecimal price)` |
| `GreaterThan` | `> ?` | `findByCountGreaterThan(Integer count)` |
| `GreaterThanEqual` | `>= ?` | `findByScoreGreaterThanEqual(Integer score)` |
| `Between` | `BETWEEN ? AND ?` | `findByCreatedAtBetween(Instant start, Instant end)` |
| `Like` | `LIKE ?` | `findByNameLike(String pattern)` |
| `Containing` | `LIKE %?%` | `findByNameContaining(String keyword)` |
| `StartingWith` | `LIKE ?%` | `findByNameStartingWith(String prefix)` |
| `EndingWith` | `LIKE %?` | `findByNameEndingWith(String suffix)` |
| `In` | `IN (?)` | `findByStatusIn(List<Status> statuses)` |
| `True` / `False` | `= true/false` | `findByActiveTrue()` |
| `IgnoreCase` | `LOWER() = LOWER()` | `findByEmailIgnoreCase(String email)` |

### Ordering

```java
// Single field
List<Entity> findByActiveOrderByCreatedAtDesc(Boolean active);

// Multiple fields
List<Entity> findByStatusOrderBySortOrderAscNameAsc(Status status);

// With Sort parameter
List<Entity> findByActive(Boolean active, Sort sort);
```

### Limiting Results

```java
// First N results
List<Entity> findTop10ByOrderByUsageCountDesc();
Entity findFirstByOrderByCreatedAtDesc();

// With Pageable
Page<Entity> findByStatus(Status status, Pageable pageable);
```

### Nested Property Access

Access related entity fields using camelCase:

```java
// Entity.channel.channelId
List<Content> findByChannelChannelId(String channelId);

// Entity.tagGroup.tagGroupId AND Entity.name
Optional<Tag> findByTagGroupTagGroupIdAndNormalizedName(String tagGroupId, String name);

// Entity.channel IS NULL
List<Category> findByChannelChannelIdAndParentIsNull(String channelId);
```

---

## @Query Custom Queries

For complex queries that cannot be expressed with method names.

### JPQL Queries

```java
@Query("SELECT p FROM AuthPermission p WHERE p.managementType = 'SYSTEM_MANAGED'")
List<AuthPermission> findSystemManagedPermissions();
```

### Parameter Binding with @Param

```java
@Query("SELECT p FROM AuthPermission p WHERE p.permissionCode IN :codes")
List<AuthPermission> findByPermissionCodes(@Param("codes") List<String> codes);

@Query("SELECT c FROM CmsContent c WHERE c.channelId = :channelId AND c.status = :status")
List<CmsContent> findByChannelAndStatus(
    @Param("channelId") String channelId,
    @Param("status") CmsContentStatus status
);
```

### Multi-line JPQL (Java 15+ Text Blocks)

```java
@Query("""
    SELECT p FROM AuthRolePermission p
    WHERE p.active = true
    ORDER BY p.targetType, p.priority
    """)
List<AuthRolePermission> findAllOrderedByPriority();
```

### Complex JOIN Queries

```java
@Query("SELECT t FROM CmsTagEntry t WHERE t.tagGroup IN " +
       "(SELECT tg FROM CmsTagGroup tg JOIN tg.channels c " +
       "WHERE c.channelId = :channelId AND tg.active = true) " +
       "AND LOWER(t.name) LIKE LOWER(CONCAT('%', :name, '%'))")
List<CmsTagEntry> findByChannelIdAndNameContaining(
    @Param("channelId") String channelId,
    @Param("name") String name
);
```

### Native SQL Queries

Use sparingly, only when JPQL is insufficient:

```java
@Query(value = "SELECT * FROM users WHERE username = :username", nativeQuery = true)
Optional<UserAccount> findByUsernameNative(@Param("username") String username);
```

---

## @Modifying Queries

For UPDATE and DELETE operations.

### Update Query

```java
@Modifying
@Query("UPDATE AuthPermission p SET p.usageCount = 0 WHERE p.managementType = 'SYSTEM_MANAGED'")
int resetSystemManagedUsageCounts();

@Modifying
@Query("UPDATE User u SET u.lastLoginAt = :now WHERE u.userId = :userId")
int updateLastLogin(@Param("userId") String userId, @Param("now") Instant now);
```

### Delete Query

```java
@Modifying
@Query("DELETE FROM AuditEvent a WHERE a.occurredAt < :cutoffTime")
int deleteOldAuditEvents(@Param("cutoffTime") Instant cutoffTime);
```

**Important**: `@Modifying` queries require a transaction. Typically called from `@Transactional` service methods.

---

## Advanced Patterns

### Aggregate Functions

```java
// MAX for sort order calculation
@Query("SELECT COALESCE(MAX(c.sortOrder), 0) FROM CmsContent c WHERE c.channel.channelId = :channelId")
Integer findMaxSortOrderByChannelId(@Param("channelId") String channelId);

// COUNT with grouping
@Query("SELECT a.action, COUNT(a) FROM AuditEvent a " +
       "WHERE a.occurredAt BETWEEN :startTime AND :endTime " +
       "GROUP BY a.action")
List<Object[]> getAuditStats(@Param("startTime") Instant startTime, @Param("endTime") Instant endTime);
```

### Hash-Based Lookup (Security)

For encrypted fields, search by hash:

```java
// Find by hashed email
Optional<UserAccount> findByEmailHashed(String emailHashed);

// Check uniqueness excluding current entity
boolean existsByEmailHashedAndUserIdNot(String emailHashed, String userId);

// Find by hashed mobile
Optional<UserAccount> findByMobileHashed(String mobileHashed);
```

### Fetch JOIN (Performance)

Avoid N+1 queries by eager loading relationships:

```java
@Query("SELECT u FROM UserAccount u LEFT JOIN FETCH u.roles WHERE u.userId = :userId")
Optional<UserAccount> findByIdWithRoles(@Param("userId") String userId);

@Query("SELECT c FROM CmsContent c LEFT JOIN FETCH c.tags WHERE c.contentId = :contentId")
Optional<CmsContent> findByIdWithTags(@Param("contentId") String contentId);
```

### Time-Based Queries

```java
// Scheduled content ready to publish
@Query("SELECT c FROM CmsContent c WHERE c.status = :status AND c.publishAt <= :now AND c.deletedAt IS NULL")
List<CmsContent> findScheduledContentsReadyToPublish(
    @Param("status") CmsContentStatus status,
    @Param("now") Instant now,
    Pageable pageable
);

// Expired sessions
List<Session> findByExpiresAtBefore(Instant cutoff);
```

### Audit Log Queries

```java
// Find by actor
List<AuditEvent> findByActorId(String actorId);

// Entity history
@Query("SELECT a FROM AuditEvent a WHERE a.entityType = :entityType AND a.entityId = :entityId ORDER BY a.occurredAt DESC")
List<AuditEvent> findEntityHistory(
    @Param("entityType") String entityType,
    @Param("entityId") String entityId
);
```

---

## File Location

```
packages/domain-{moduleRoot}/src/main/java/{basePackage}/domain/{module}/repository/{EntityName}Repository.java
packages/domain-{moduleRoot}/src/main/java/{basePackage}/domain/{module}/repository/{EntityName}TreeRepository.java
```

**Package Structure** (`{module}` segment precedes `repository`, mirroring the entity package):
- `facility/identity/repository/` - Members, credentials, identity records
- `facility/spatial/repository/` - Sites, buildings, floors, access areas
- `facility/access/repository/` - Access levels, schedules
- `auth/repository/` - Authentication/authorization
- `user/repository/` - User management
- `audit/repository/` - Audit logging

---

## Checklist

When creating a new Repository:

- [ ] Extend correct base interface (`SimpliXBaseRepository` or `SimpliXTreeRepository`)
- [ ] Add `@Repository` annotation
- [ ] Use correct package path matching entity module
- [ ] Add JavaDoc for complex query methods
- [ ] Use `@Param` for all named parameters in `@Query`
- [ ] Add `@Modifying` for UPDATE/DELETE queries
- [ ] Consider fetch join for frequently accessed relationships
- [ ] Use hash-based lookup for encrypted fields

---

## See Also

- [Base Entity Patterns](base-entity-patterns.md) - Entity structure
- [Relationship Patterns](relationship-patterns.md) - FK and relationships
- [Tree Entity Patterns](tree-entity-patterns.md) - Hierarchical structures
- [Entity Security Patterns](entity-security-patterns.md) - Encryption patterns