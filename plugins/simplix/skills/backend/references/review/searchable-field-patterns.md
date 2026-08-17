# Searchable Field Patterns

This document provides comprehensive guidance for configuring `@SearchableField` annotation in SearchDTO based on the Searchable JPA library.

> **Scope**: DTO-side validation of `@SearchableField` — how entity field types map to operators, path syntax for joins, and URL parameter format. For the underlying Searchable JPA framework itself (configuration, query composition, OR conditions), see `../../../../references/searchable-jpa/` at the project root.

## Contents

- [@SearchableField Annotation](#searchablefield-annotation)
- [SearchOperator - All 20 Operators](#searchoperator---all-20-operators)
- [Entity Field Type to Operator Mapping](#entity-field-type-to-operator-mapping)
- [entityField Path Patterns](#entityfield-path-patterns)
- [sortField Priority](#sortfield-priority)
- [URL Parameter Format](#url-parameter-format)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Quick Reference](#quick-reference)

---

## @SearchableField Annotation

### All Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `entityField` | String | `""` | Entity field path. Empty = use DTO field name. Supports nested paths (e.g., `author.name`) |
| `operators` | SearchOperator[] | `{}` | Allowed search operators. Empty = all operators allowed |
| `sortable` | boolean | `false` | Whether this field can be used for sorting |
| `sortField` | String | `""` | Field used for sorting. Priority: sortField > entityField > DTO field name |

### Basic Usage

```java
@Getter
@Setter
public static class EntitySearchDTO {

    // Basic field - uses DTO field name as entity field
    @SearchableField(operators = {EQUALS, CONTAINS}, sortable = true)
    private String name;

    // Explicit entity field mapping
    @SearchableField(entityField = "createdAt", operators = {BETWEEN}, sortable = true)
    private Instant createdDate;

    // Sort field different from search field
    @SearchableField(entityField = "displayName", sortable = true, sortField = "sortKey")
    private String displayName;
}
```

### PK Contract — sortable AND `IN` (MANDATORY on every SearchDTO)

The entity-ID field of EVERY SearchDTO MUST be declared sortable and MUST accept `IN`:

```java
@SearchableField(operators = {EQUALS, IN}, sortable = true)
private String entityId;
```

Both halves are cross-subproject contracts, not style choices, and the scaffold satisfies
neither on its own.

**`sortable = true`** — the frontend CLI scaffolds every list screen with
`defaultSort: { field: "<entityId>", direction: "desc" }` (UUID v7 IDs are time-ordered, so
ID-desc means newest-first), and the framework sends it as `sort=<entityId>.desc` on the very
first page load. A SearchDTO whose PK lacks `sortable = true` fails that initial request with
a search error ("정렬할 수 없습니다") — the scaffolded list screen is broken before any
customization happens.

**`IN`** — a list filter that picks this entity resolves the labels of what is selected by
asking its OWN search endpoint for those ids in one read (`<entityId>.in=a,b,c`). Left at
`{EQUALS}`, the whole request is refused the moment a value is picked
(`연산자 <entityId>.IN는 허용되지 않습니다`) and the filter is dead on every list that offers
it — including lists in other modules, since the filter is shared. Note the asymmetry that
hides this: the SAME id declared as a FOREIGN key on another entity's SearchDTO is routinely
written `{EQUALS, IN}` and works, so the defect appears only where the entity is filtered on
its own list, which is the one place the scaffold's `{EQUALS}` survives review.

Checklist when authoring or reviewing a SearchDTO:
1. PK field: `operators = {EQUALS, IN}, sortable = true` — never omit either.
2. Every field the frontend renders as a sortable column also needs `sortable = true`.
3. Verify with the exact requests the frontend issues:
   - `GET /{entity}/search?page=0&size=10&sort=<entityId>.desc` → must be `SUCCESS`.
     (Sort syntax is dot-separated `field.direction`; `field,direction` is rejected.)
   - `GET /{entity}/search?page=0&size=1&<entityId>.in=<some id>` → must be `SUCCESS`.

Sweep a whole service at once from the published OpenAPI document rather than file by file —
every `/search` operation that declares `<x>.equals` and no `<x>.in` is a candidate, and the
ones where `<x>` is that endpoint's own PK are defects:

```bash
curl -s http://<host>/api-docs/all-apis > /tmp/spec.json
python3 - <<'PY'
import json
spec = json.load(open("/tmp/spec.json"))
for path, item in spec["paths"].items():
    op = item.get("get")
    if not path.endswith("/search") or not op:
        continue
    names = {p["name"] for p in op.get("parameters", [])}
    for n in sorted(names):
        if n.endswith(".equals") and n[: -len(".equals")] + ".in" not in names:
            print(f"{n[: -len('.equals')]:<24} {path}")
PY
```

**Both halves are now carried by `${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs`** as the rule
`searchdto-pk-contract`, which reads a checkout and needs nothing started.

The reason a static scan looked impossible is worth keeping, because it is what makes the rule
precise rather than noisy. A scan that flagged every searchable id omitting `IN` would report
every FK that omits it for good reason, and an audit that cries wolf gets muted — worse than not
having one. What removes the guesswork is that the entity's own primary key IS in the source: the
audit indexes every `@Entity` class's `@Id` field, matches `{Entity}DTOs` to `{Entity}`, and
asserts the contract on that one field alone. Foreign keys on the same DTO are never touched.

**One fact still is not in the source, and stays out**: whether a list filter actually resolves
its selections against this endpoint. That lives in the frontend's facet definitions, and the
contract is required regardless of whether a filter exists today.

**The two verification requests below are still run by hand** against a started server. A static
rule proves the annotation says the right thing; only the request proves the server agrees.

---

## SearchOperator - All 18 Operators

### Comparison Operators (6)

| Operator | Name | SQL Equivalent | Use Case |
|----------|------|----------------|----------|
| `EQUALS` | equals | `= value` | Exact match |
| `NOT_EQUALS` | notEquals | `<> value` | Not equal |
| `GREATER_THAN` | greaterThan | `> value` | Greater than |
| `GREATER_THAN_OR_EQUAL_TO` | greaterThanOrEqualTo | `>= value` | Greater or equal |
| `LESS_THAN` | lessThan | `< value` | Less than |
| `LESS_THAN_OR_EQUAL_TO` | lessThanOrEqualTo | `<= value` | Less or equal |

### LIKE Operators (6)

| Operator | Name | SQL Equivalent | Use Case |
|----------|------|----------------|----------|
| `CONTAINS` | contains | `LIKE '%value%'` | Partial text match |
| `NOT_CONTAINS` | notContains | `NOT LIKE '%value%'` | Exclude partial match |
| `STARTS_WITH` | startsWith | `LIKE 'value%'` | Prefix match |
| `NOT_STARTS_WITH` | notStartsWith | `NOT LIKE 'value%'` | Exclude prefix |
| `ENDS_WITH` | endsWith | `LIKE '%value'` | Suffix match |
| `NOT_ENDS_WITH` | notEndsWith | `NOT LIKE '%value'` | Exclude suffix |

### NULL Check Operators (2)

| Operator | Name | SQL Equivalent | Use Case |
|----------|------|----------------|----------|
| `IS_NULL` | isNull | `IS NULL` | Check null |
| `IS_NOT_NULL` | isNotNull | `IS NOT NULL` | Check not null |

### Collection Operators (2)

| Operator | Name | SQL Equivalent | Use Case |
|----------|------|----------------|----------|
| `IN` | in | `IN (value1, value2, ...)` | Multiple values |
| `NOT_IN` | notIn | `NOT IN (value1, value2, ...)` | Exclude multiple |

### Range Operators (2)

| Operator | Name | SQL Equivalent | Use Case |
|----------|------|----------------|----------|
| `BETWEEN` | between | `BETWEEN value1 AND value2` | Range query (requires 2 values) |
| `NOT_BETWEEN` | notBetween | `NOT BETWEEN value1 AND value2` | Exclude range |

---

## Entity Field Type to Operator Mapping

### Recommended Operators by Field Semantics

Operators must match the field's **semantic purpose**, not just its Java type. Two `String` fields may need entirely different operators depending on what they represent.

| Field Semantics | Examples | Recommended Operators | Notes |
|-----------------|----------|-----------------------|-------|
| ID / FK | `id`, `siteId` | `EQUALS`, `IN` | Exact lookup only |
| Name / title | `name`, `title` | `EQUALS`, `CONTAINS` | Exact + partial match |
| Description / address (free-form) | `description`, `address` | `CONTAINS` | No EQUALS — prose text is never searched by exact match |
| Short code | `country` (ISO), `code` | `EQUALS`, `IN` | Exact match, multi-select filter. No CONTAINS on short codes |
| URL / file path | `floorPlanUrl`, `imageUrl` | `CONTAINS` | Partial match only. No EQUALS |
| Coordinates | `latitude`, `longitude` | `GTE`, `LTE`, `BETWEEN` | Range/bounding-box queries. No EQUALS — exact coordinate match is meaningless |
| Monetary / numeric | `price`, `viewCount` | `EQUALS`, `GT`, `LT`, `BETWEEN` | Range queries |
| Date/time | `createdAt`, `publishAt` | `GTE`, `LTE`, `BETWEEN` | Inclusive range queries |
| Boolean | `active`, `deleted` | `EQUALS` | True/false only |
| Enum | `status`, `type` | `EQUALS`, `IN`, `NOT_IN` | Status, type filters |
| @ManyToOne ID | `channel.channelId` | `EQUALS`, `IN` | Reference lookup |
| @ManyToMany IDs | `tagEntries.tagEntryId` | `IN`, `EQUALS` | Collection membership |

### Code Examples

```java
@Getter
@Setter
public static class ComprehensiveSearchDTO {

    // String - text search
    @SearchableField(operators = {EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH}, sortable = true)
    private String title;

    // String - code field (exact match only)
    @SearchableField(operators = {EQUALS, IN})
    private String code;

    // Integer - numeric range
    @SearchableField(operators = {EQUALS, GREATER_THAN, LESS_THAN, BETWEEN}, sortable = true)
    private Integer viewCount;

    // Boolean - use wrapper type
    @SearchableField(operators = {EQUALS})
    private Boolean active;

    // Enum - status filtering
    @SearchableField(operators = {EQUALS, IN, NOT_IN})
    private ContentStatus status;

    // Date - range queries (use GREATER_THAN_OR_EQUAL_TO, LESS_THAN_OR_EQUAL_TO for inclusive ranges)
    @SearchableField(operators = {GREATER_THAN_OR_EQUAL_TO, LESS_THAN_OR_EQUAL_TO, BETWEEN}, sortable = true)
    private Instant createdAt;

    // Optional field - null check
    @SearchableField(operators = {EQUALS, IS_NULL, IS_NOT_NULL})
    private String description;
}
```

---

## entityField Path Patterns

### Direct Field Mapping

When DTO field name matches entity field name:

```java
// Entity
@Entity
public class CmsContent {
    private String title;  // Field name: title
}

// SearchDTO - entityField not needed
@SearchableField(operators = {CONTAINS}, sortable = true)
private String title;  // Uses "title" automatically
```

### Explicit Field Mapping

When DTO field name differs from entity field:

```java
// Entity
@Entity
public class CmsContent {
    private Instant publishedAt;  // Entity field name
}

// SearchDTO - explicit mapping
@SearchableField(entityField = "publishedAt", operators = {BETWEEN}, sortable = true)
private Instant publishDate;  // DTO field name differs
```

### @ManyToOne Relationship Path

For single entity references:

```java
// Entity
@Entity
public class CmsContent {
    @ManyToOne
    @JoinColumn(name = "channel_id")
    private CmsChannel channel;  // Reference field
}

// CmsChannel entity
@Entity
public class CmsChannel {
    @Id
    private String channelId;  // Referenced ID field
}

// SearchDTO - nested path: {relationField}.{referencedIdField}
@SearchableField(entityField = "channel.channelId", operators = {EQUALS, IN})
private String channelId;
```

### @ManyToMany Relationship Path

For collection references:

```java
// Entity
@Entity
public class CmsContent {
    @ManyToMany
    @JoinTable(name = "cms_content_tag")
    private Set<CmsTagEntry> tagEntries;  // Collection field
}

// CmsTagEntry entity
@Entity
public class CmsTagEntry {
    @Id
    private String tagEntryId;  // Referenced ID field
}

// SearchDTO - nested path through collection
@SearchableField(entityField = "tagEntries.tagEntryId", operators = {IN, EQUALS})
private Set<String> tagEntryIds;
```

### Multi-Level Nested Path

For deeper relationships:

```java
// Entity hierarchy
// CmsContent -> CmsChannel -> Organization

@Entity
public class CmsContent {
    @ManyToOne
    private CmsChannel channel;
}

@Entity
public class CmsChannel {
    @ManyToOne
    private Organization organization;
}

@Entity
public class Organization {
    @Id
    private String organizationId;
    private String organizationName;
}

// SearchDTO - 2-level path
@SearchableField(entityField = "channel.organization.organizationId", operators = {EQUALS})
private String organizationId;

@SearchableField(entityField = "channel.organization.organizationName", operators = {CONTAINS})
private String organizationName;
```

### Self-Reference (Tree Entity) Path

For hierarchical structures:

```java
// Entity
@Entity
public class CmsCategory implements TreeEntity<CmsCategory> {
    @Id
    private String categoryId;

    @ManyToOne
    @JoinColumn(name = "parent_id")
    private CmsCategory parent;  // Self-reference
}

// SearchDTO - parent lookup
@SearchableField(entityField = "parent.categoryId", operators = {EQUALS, IS_NULL})
private String parentCategoryId;

// Note: IS_NULL finds root categories (no parent)
```

---

## sortField Priority

### How Sorting Field is Determined

1. **sortField attribute** (highest priority) - if set, always used
2. **entityField attribute** - if sortField empty
3. **DTO field name** (lowest priority) - if both empty

### Examples

```java
// Case 1: sortField specified - uses sortField for sorting
@SearchableField(entityField = "displayName", sortable = true, sortField = "sortKey")
private String name;
// Sorting uses: sortKey

// Case 2: only entityField specified - uses entityField for sorting
@SearchableField(entityField = "createdAt", sortable = true)
private Instant created;
// Sorting uses: createdAt

// Case 3: no field specified - uses DTO field name for sorting
@SearchableField(sortable = true)
private String title;
// Sorting uses: title

// Case 4: not sortable - cannot use for sorting
@SearchableField(operators = {CONTAINS})
private String description;
// Sorting NOT allowed
```

### Use Case: Different Search and Sort Fields

```java
// Entity has both search-optimized and sort-optimized fields
@Entity
public class Product {
    private String displayName;     // For display
    private String searchName;      // Normalized for search
    private String sortName;        // Normalized for sorting
}

// SearchDTO - search displayName, sort by sortName
@SearchableField(entityField = "searchName", operators = {CONTAINS}, sortable = true, sortField = "sortName")
private String name;
```

---

## URL Parameter Format

### Query Parameter Syntax

```bash
# Format: {dtoFieldName}.{operatorName}={value}

# Basic search
GET /api/items?title.equals=Spring
GET /api/items?title.contains=boot
GET /api/items?status.in=PUBLISHED,DRAFT

# Range search
GET /api/items?viewCount.greaterThan=100
GET /api/items?viewCount.lessThan=1000

# Between (comma-separated values)
GET /api/items?createdAt.between=2024-01-01T00:00:00Z,2024-12-31T23:59:59Z

# Null check
GET /api/items?description.isNull=true
GET /api/items?publishedAt.isNotNull=true

# Sorting
GET /api/items?sort=createdAt.desc
GET /api/items?sort=title.asc,createdAt.desc

# Pagination
GET /api/items?page=0&size=20

# Combined
GET /api/items?title.contains=Spring&status.equals=PUBLISHED&sort=createdAt.desc&page=0&size=20
```

### Operator Names for URL

| Operator | URL Name |
|----------|----------|
| `EQUALS` | equals |
| `NOT_EQUALS` | notEquals |
| `GREATER_THAN` | greaterThan |
| `GREATER_THAN_OR_EQUAL_TO` | greaterThanOrEqualTo |
| `LESS_THAN` | lessThan |
| `LESS_THAN_OR_EQUAL_TO` | lessThanOrEqualTo |
| `CONTAINS` | contains |
| `NOT_CONTAINS` | notContains |
| `STARTS_WITH` | startsWith |
| `NOT_STARTS_WITH` | notStartsWith |
| `ENDS_WITH` | endsWith |
| `NOT_ENDS_WITH` | notEndsWith |
| `IS_NULL` | isNull |
| `IS_NOT_NULL` | isNotNull |
| `IN` | in |
| `NOT_IN` | notIn |
| `BETWEEN` | between |
| `NOT_BETWEEN` | notBetween |

---

## Common Patterns

### Pattern 1: Basic CRUD Entity

```java
@Getter
@Setter
public static class BasicEntitySearchDTO {

    @SearchableField(operators = {EQUALS})
    private String entityId;

    @SearchableField(operators = {EQUALS, CONTAINS}, sortable = true)
    private String name;

    @SearchableField(operators = {EQUALS, IN})
    private EntityStatus status;

    @SearchableField(operators = {EQUALS})
    private Boolean active;

    @SearchableField(operators = {BETWEEN, GREATER_THAN, LESS_THAN}, sortable = true)
    private Instant createdAt;

    @SearchableField(operators = {BETWEEN, GREATER_THAN, LESS_THAN}, sortable = true)
    private Instant updatedAt;
}
```

### Pattern 2: CMS Content Entity

```java
@Getter
@Setter
public static class CmsContentSearchDTO {

    @SearchableField(operators = {EQUALS})
    private String contentId;

    // @ManyToOne reference
    @SearchableField(entityField = "channel.channelId", operators = {EQUALS, IN})
    private String channelId;

    // @ManyToMany reference
    @SearchableField(entityField = "tagEntries.tagEntryId", operators = {IN, EQUALS})
    private Set<String> tagEntryIds;

    // Text search
    @SearchableField(operators = {CONTAINS, STARTS_WITH}, sortable = true)
    private String title;

    // Enum filter
    @SearchableField(operators = {EQUALS, IN, NOT_IN}, sortable = true)
    private ContentStatus status;

    // Date range
    @SearchableField(operators = {BETWEEN, GREATER_THAN, LESS_THAN}, sortable = true)
    private Instant publishAt;

    // Boolean flag
    @SearchableField(operators = {EQUALS})
    private Boolean pinned;

    // Numeric range
    @SearchableField(operators = {GREATER_THAN, LESS_THAN, BETWEEN}, sortable = true)
    private Long viewCount;

    // Audit fields
    @SearchableField(operators = {BETWEEN, GREATER_THAN, LESS_THAN}, sortable = true)
    private Instant createdAt;

    @SearchableField(operators = {EQUALS, CONTAINS})
    private String createdBy;
}
```

### Pattern 3: Tree Entity (Category)

```java
@Getter
@Setter
public static class CategorySearchDTO {

    @SearchableField(operators = {EQUALS})
    private String categoryId;

    @SearchableField(operators = {EQUALS, CONTAINS}, sortable = true)
    private String categoryName;

    // Parent lookup (null = root)
    @SearchableField(entityField = "parent.categoryId", operators = {EQUALS, IS_NULL})
    private String parentCategoryId;

    // Tree depth
    @SearchableField(operators = {EQUALS, GREATER_THAN, LESS_THAN})
    private Integer depth;

    // Path search
    @SearchableField(operators = {STARTS_WITH, CONTAINS})
    private String path;

    // Sort order
    @SearchableField(operators = {BETWEEN}, sortable = true)
    private Integer sortOrder;
}
```

### Pattern 4: User/Account Entity

```java
@Getter
@Setter
public static class UserAccountSearchDTO {

    @SearchableField(operators = {EQUALS})
    private String userId;

    // Hashed field search (if using hash index)
    @SearchableField(entityField = "emailHashed", operators = {EQUALS})
    private String email;

    @SearchableField(operators = {EQUALS, CONTAINS}, sortable = true)
    private String displayName;

    // Status flags
    @SearchableField(operators = {EQUALS})
    private Boolean enabled;

    @SearchableField(operators = {EQUALS})
    private Boolean locked;

    // Organization reference
    @SearchableField(entityField = "organization.organizationId", operators = {EQUALS, IN})
    private String organizationId;

    // Role reference
    @SearchableField(entityField = "roles.roleId", operators = {IN, EQUALS})
    private Set<String> roleIds;

    // Last login range
    @SearchableField(operators = {BETWEEN, GREATER_THAN, IS_NULL})
    private Instant lastLoginAt;
}
```

---

## Troubleshooting

### Issue: Search Returns No Results

**Diagnosis**:
1. Check entityField path is correct
2. Verify operator is in allowed list
3. Check entity relationship exists

**Entity Check**:
```java
// Wrong path
@SearchableField(entityField = "channelId")  // Direct field doesn't exist

// Correct path
@SearchableField(entityField = "channel.channelId")  // Through relationship
```

### Issue: Sorting Not Working

**Diagnosis**:
1. Check `sortable = true` is set
2. Check sortField path if specified
3. Verify entity field exists

**DTO Check**:
```java
// Missing sortable
@SearchableField(operators = {CONTAINS})  // Can't sort!

// With sortable
@SearchableField(operators = {CONTAINS}, sortable = true)  // Can sort
```

### Issue: IN Operator Not Working

**Diagnosis**:
1. Check DTO field type is Set or Collection
2. Check operator is in allowed list
3. Verify URL parameter format

**URL Format**:
```bash
# Wrong - no operator
GET /api/items?tagEntryIds=id1,id2

# Correct - with IN operator
GET /api/items?tagEntryIds.in=id1,id2
```

### Issue: BETWEEN Not Working

**Diagnosis**:
1. Check two values are provided
2. Check comma separator
3. Verify date format for Instant

**URL Format**:
```bash
# Wrong - single value
GET /api/items?createdAt.between=2024-01-01

# Correct - two values
GET /api/items?createdAt.between=2024-01-01T00:00:00Z,2024-12-31T23:59:59Z
```

### Issue: Instant Field Path with `.id` Suffix

**Wrong**:
```java
// WRONG - Instant is not a reference entity, no .id field!
@SearchableField(entityField = "validFrom.id", operators = {EQUALS})
private Instant validFrom;
```

**Correct**:
```java
// CORRECT - Use field name directly for Instant type
@SearchableField(entityField = "validFrom", operators = {GREATER_THAN_OR_EQUAL_TO, LESS_THAN_OR_EQUAL_TO, BETWEEN}, sortable = true)
private Instant validFrom;
```

**Rule**: The `.id` suffix should only be used with `@ManyToOne` or `@ManyToMany` relationship fields. Primitive types such as `Instant`, `LocalDate`, `String`, `Integer` use the field name directly.

---

### Issue: Boolean Field Getter Wrong

**Diagnosis**:
1. Check DTO uses Boolean (wrapper), not boolean (primitive)
2. Primitive boolean generates `isActive()`, not `getActive()`

**Fix**:
```java
// Wrong - primitive generates isActive()
private boolean active;

// Correct - wrapper generates getActive()
private Boolean active;
```

---

## Quick Reference

### @SearchableField Attribute Summary

| Attribute | When to Set | Default Behavior |
|-----------|-------------|------------------|
| `entityField` | DTO name differs from entity name | Uses DTO field name |
| `operators` | Restrict allowed operators | All operators allowed |
| `sortable` | Field should be sortable | Not sortable |
| `sortField` | Sort field differs from entityField | Uses entityField or DTO name |

### Operator Selection Guide

| Use Case | Operators |
|----------|-----------|
| Exact ID lookup | `EQUALS` |
| Multiple ID lookup | `IN` |
| Text search (name, title) | `EQUALS`, `CONTAINS` |
| Text search (description, address) | `CONTAINS` only |
| Short code (country, status code) | `EQUALS`, `IN` |
| Date range | `GTE`, `LTE`, `BETWEEN` |
| Coordinate range (geo) | `GTE`, `LTE`, `BETWEEN` |
| Status filter (enum) | `EQUALS`, `IN`, `NOT_IN` |
| Optional field | `IS_NULL`, `IS_NOT_NULL` |
| Numeric range | `EQUALS`, `GT`, `LT`, `BETWEEN` |
| URL / path | `CONTAINS` only |

### Entity Path Construction

| Entity Relationship | entityField Path |
|---------------------|------------------|
| `@ManyToOne Entity ref` | `ref.refId` |
| `@ManyToMany Set<E> items` | `items.itemId` |
| Nested: `ref.subRef` | `ref.subRef.subRefId` |
| Self: `parent` (same type) | `parent.entityId` |