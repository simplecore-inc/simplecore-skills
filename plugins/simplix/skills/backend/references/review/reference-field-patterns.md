# Reference Field Patterns

How entity relationships (`@ManyToOne`, `@ManyToMany`, `@OneToMany`, self-reference) are mapped to DTOs.

> **Scope (canonical):** when DTO should expose the FK ID vs the nested object, `@JsonIncludeProperties` rules on Detail/List DTOs, self-reference handling for trees, explicit ID + reference fields in composite entities. For `@SearchableField` paths that traverse relationships, see **searchable-field-patterns.md** (entityField path construction).

## Overview

Entity references are transformed differently depending on the DTO type:

| DTO Type | Entity Reference | DTO Field |
|----------|-----------------|-----------|
| SearchDTO | `@ManyToOne Entity` | `String entityId` |
| CreateDTO | `@ManyToOne Entity` | `String entityId` |
| UpdateDTO | `@ManyToOne Entity` | `String entityId` |
| UpdateFormDTO | `@ManyToOne Entity` | `Entity entity` (full for form display) |
| BatchUpdateDTO | `@ManyToOne Entity` | `String entityId` |
| DetailDTO | `@ManyToOne Entity` | `Entity entity` (full) |
| ListDTO | `@ManyToOne Entity` | `Entity entity` (full) |

> **Note**: UpdateFormDTO includes full entity objects for form display (e.g., dropdown selections).

---

## @ManyToOne Reference Pattern

### Entity Definition

```java
@Entity
public class CmsContent {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id")
    private CmsChannel channel;
}
```

### DTO Mapping by Type

**SearchDTO** - ID field with entityField path:
```java
// Check entity field name: channel
// Check referenced entity ID field: channelId
@SearchableField(entityField = "channel.channelId", operators = {EQUALS})
private String channelId;
```

**CreateDTO/UpdateDTO** - ID field only:
```java
@Schema(description = "Channel ID")
@FieldLabel("{entities.CmsContent.channel}")
private String channelId;
```

**UpdateFormDTO** - Full entity for form display:
```java
// Full entity for dropdown/select display in forms
@JsonIncludeProperties({"channelId", "channelName"})
private CmsChannel channel;
```

**DetailDTO/ListDTO** - Full entity with field filtering:
```java
@JsonIncludeProperties({"channelId", "channelName"})
private CmsChannel channel;
```

### entityField Path Construction

1. Get entity field name: `channel`
2. Get referenced entity's ID field: `channelId`
3. Combine with dot: `channel.channelId`

```java
// Entity relationship
@ManyToOne
private CmsChannel channel;
// CmsChannel.channelId is the ID field

// SearchDTO entityField
entityField = "channel.channelId"
```

---

## @ManyToMany Reference Pattern

### Entity Definition

```java
@Entity
public class CmsContent {
    @ManyToMany
    @JoinTable(
        name = "cms_content_tag",
        joinColumns = @JoinColumn(name = "content_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_entry_id")
    )
    private Set<CmsTagEntry> tagEntries = new HashSet<>();
}
```

### DTO Mapping by Type

> **IMPORTANT**: ManyToMany relationships are managed via separate APIs.
> They MUST be excluded from CreateDTO/UpdateDTO/BatchUpdateDTO.

**SearchDTO** - ID Set with entityField path:
```java
// Check entity field name: tagEntries
// Check referenced entity ID field: tagEntryId
@SearchableField(entityField = "tagEntries.tagEntryId", operators = {IN, EQUALS})
private Set<String> tagEntryIds;
```

**CreateDTO/UpdateDTO/BatchUpdateDTO** - **EXCLUDE ENTIRELY**:
```java
// DO NOT include ManyToMany fields in input DTOs
// Manage via separate API endpoints:
// POST   /api/contents/{id}/tags       - Add tags
// DELETE /api/contents/{id}/tags/{tagId} - Remove tag
// PUT    /api/contents/{id}/tags       - Replace all tags
```

**DetailDTO/ListDTO** - Full collection (read-only):
```java
private Set<CmsTagEntry> tagEntries;
```

### Why Separate API?

1. **Transactional Integrity**: ManyToMany updates require separate transaction handling
2. **Validation**: Each association can have specific validation rules
3. **Audit Trail**: Easier to track individual association changes
4. **Performance**: Avoids loading/processing large collections on every update
5. **API Design**: RESTful sub-resource pattern is more intuitive

### Field Naming Convention

| Entity Field | DTO Field (Search) | DTO Field (Detail/List) | Input DTOs |
|--------------|-------------------|-------------------------|------------|
| `tagEntries` | `tagEntryIds` | `tagEntries` | **EXCLUDE** |
| `categories` | `categoryIds` | `categories` | **EXCLUDE** |
| `users` | `userIds` | `users` | **EXCLUDE** |

---

## Id collection JPA does not map: `@References`

An `@ElementCollection` of id strings (`Set<String> roleIds`) is a reference JPA knows nothing
about, so nothing tells SimpliX Meta what the ids point at, and a screen hand-writes the peek
labels and the picker. Name the target on the entity field:

```java
@ElementCollection
@CollectionTable(name = "user_account_roles", joinColumns = @JoinColumn(name = "user_id"))
@Column(name = "role_id", length = 36)
@References(UserRole.class)
private Set<String> roleIds = new HashSet<>();
```

Meta then publishes the field's reference (target entity, its id and name field) on every DTO
field mapped to it. The audit's `id-collection-without-references` fails an `@ElementCollection`
of `String` named `*Ids` without it.

### Target in a module the holder cannot depend on: `@References(entity = "<Entity>")`

The class form needs the target's class on the holder's compile path. Where the target's module
already depends on the holder's (an account module naming the plan its billing module reads accounts
from), the class form closes a module cycle. Name the target by the simple name of the entity SimpliX
Meta serves instead:

```java
@Formula(CurrentPlanFormulas.USER_PLAN_ID)
@References(entity = "<Entity>")
private String currentPlanId;
```

Set exactly one of `value` and `entity`; prefer the class wherever the dependency exists, since the
compiler checks it. Meta resolves the name among the served entities (those with a
`SimpliXBaseController`) and fails its build, naming the annotated field, when both or neither is set,
when no served entity has that simple name, or when two served entities share it (both classes named;
name the target by class then). A name never resolves to a silently missing reference.

### A value whose target depends on the row: `@ReferencesByKind`

When only some rows' value names a record (an actor id that is an account for a person's actor type
and nothing for a system actor; a job's subject that is a different entity per job type), declare the
kinds that name a record and leave the rest out: a kind with no entry is drawn by its recorded name,
never as a link that cannot resolve.

```java
@ReferencesByKind(kindField = "<kindField>", kinds = {
        @ReferencesByKind.Kind(value = "<KIND_A>", entity = "<EntityA>"),
        @ReferencesByKind.Kind(value = "<KIND_B>", entity = "<EntityB>")})
private String <stem>Id;
```

Each `value` is a constant of the kind field's enum (a typo publishes a kind no row carries), and a
kind's entity is one the console can open; one served only on a self-scoped portal surface is left out.

### A screen draws a reference by its sibling name

The frontend CLI stamps a `<stem>Id` reference as a reference cell only when the same DTO carries a
string `<stem>Name` (or `<stem>DisplayName`) beside it; without one the field is drawn as text whatever
Meta says. So a reference added for a screen comes with that sibling on the list and detail DTOs, named
by the id's stem (`authorId` → `authorName`, `ownerUserId` → `ownerUserName`, `creditAccountId` →
`creditAccountName`), produced the way the project produces person and record names (a join-derived
`@Formula` family needs no column, migration or backfill).

## Self-Reference Pattern (Tree Entities)

### Entity Definition

```java
@Entity
public class CmsCategory implements TreeEntity<CmsCategory> {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private CmsCategory parent;

    @OneToMany(mappedBy = "parent")
    private Set<CmsCategory> children = new HashSet<>();
}
```

### Detection

Check entity for:
1. `@ManyToOne` referencing same entity type
2. Field named `parent`
3. `implements TreeEntity<Self>`

### DTO Handling

**SearchDTO** - Skip self-reference (parent)

**CreateDTO** - Include parentId if needed:
```java
private String parentId;  // Optional for root nodes
```

**ListDTO** - Include children for tree structure:
```java
private String categoryId;
private String categoryName;
private Integer depth;
private String path;

// For tree display
private List<CmsCategoryListDTO> children;
```

---

## Explicit ID Field Detection

### When Entity Has Both Reference and ID

```java
@Entity
public class CmsContent {
    // Reference field
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", insertable = false, updatable = false)
    private CmsChannel channel;

    // Explicit ID field
    @Column(name = "channel_id")
    private String channelId;
}
```

### DTO Rule

When the entity has both, the DTO role decides (§ Overview):

- **Search, Create, Update and BatchUpdate DTOs** carry the explicit ID field only, and never derive it from the reference:

```java
// Only channelId, not channel -> channelId conversion
private String channelId;
```

- **UpdateForm, Detail and List DTOs** keep the reference object, restricted with `@JsonIncludeProperties` (§ @JsonIncludeProperties Pattern). The frontend's detail and form screens read the nested object, so it is never flattened to the bare id there.

---

## @JsonIncludeProperties Pattern

### Purpose

Control which fields are serialized when returning entity references in DetailDTO/ListDTO.

### Entity Analysis

Check referenced entity fields:
```java
public class CmsChannel {
    private String channelId;    // Include
    private String channelName;  // Include
    private String channelCode;  // Maybe include
    // ... many other fields
}
```

### DTO Application

```java
// Include only essential fields for display
@JsonIncludeProperties({"channelId", "channelName"})
private CmsChannel channel;

// Or include more fields
@JsonIncludeProperties({"channelId", "channelName", "channelCode", "active"})
private CmsChannel channel;
```

### When to Use

- Always use for `@ManyToOne` references in DetailDTO/ListDTO
- Prevents exposing unnecessary data
- Avoids lazy loading issues

### A `@Transient` derived getter cannot be whitelisted - carry it flat

Naming a `@Transient` getter in `@JsonIncludeProperties` looks like it works and does not. The
Hibernate Jackson module treats `@Transient` as "do not serialize" on a managed entity
(`USE_TRANSIENT_ANNOTATION`, on by default), so the property is dropped wherever the entity is
**nested** - while the same getter serializes normally through a plain DTO field that ModelMapper
copied. The two paths therefore disagree, and the nested one fails **silently**: no error, no
null, the key is simply absent from the JSON, and the screen renders its fallback forever.

```java
// ✖ silently absent - maskedProductKey is a @Transient getter on the entity
@JsonIncludeProperties({"licenseId", "productKeyHash", "maskedProductKey", "status"})
private License license;

// ✔ the derived value travels flat, populated where a real entity is in hand
@JsonIncludeProperties({"licenseId", "productKeyHash", "status"})
private License license;

private String maskedProductKey;   // service: dto.setMaskedProductKey(license.getMaskedProductKey())
```

Review recipe: for every `@JsonIncludeProperties` list, open the referenced entity and confirm each
named property is a **mapped column or association**. Anything computed - a masked rendering, a
derived label, a split list - is `@Transient` and belongs on the DTO as its own field.

### The nesting projection carries what every consumer renders

An entity-level `@JsonIncludeProperties` on an association is the default for **every** DTO that
nests that entity, so a field one screen renders and the projection omits is absent on all of them.
A reference label that composes more than a name (a period, a code, a status) needs those fields in
the entity-level list - otherwise the label renders its fallback (`- ~ -`) rather than saying
anything, and a DTO that re-declares a wider list only fixes its own surface.

---

## @JsonIgnoreProperties Pattern

### Purpose

Ignore specific fields to avoid serialization issues.

### Common Use Cases

**Lazy Loading Proxy**:
```java
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
private CmsChannel channel;
```

**Circular References**:
```java
// CmsContent has channel, channel might have contents
@JsonIgnoreProperties({"contents"})
private CmsChannel channel;
```

---

## Complete Entity to DTO Example

### Entity

```java
@Entity
public class CmsContent {
    @Id
    private String contentId;

    @ManyToOne
    @JoinColumn(name = "channel_id")
    private CmsChannel channel;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private CmsCategory category;

    @ManyToOne
    @JoinColumn(name = "author_id")
    private UserAccount authorUser;

    @ManyToMany
    @JoinTable(name = "cms_content_tag")
    private Set<CmsTagEntry> tagEntries;

    private String title;
}
```

### SearchDTO

```java
@Getter
@Setter
public static class CmsContentSearchDTO {

    @SearchableField(operators = {EQUALS, IN}, sortable = true)   // the entity's own id: the PK contract
    private String contentId;

    // @ManyToOne -> nested path
    @SearchableField(entityField = "channel.channelId", operators = {EQUALS})
    private String channelId;

    @SearchableField(entityField = "category.categoryId", operators = {EQUALS})
    private String categoryId;

    @SearchableField(entityField = "authorUser.userId", operators = {EQUALS})
    private String authorUserId;

    // @ManyToMany -> nested path with IN operator
    @SearchableField(entityField = "tagEntries.tagEntryId", operators = {IN, EQUALS})
    private Set<String> tagEntryIds;

    @SearchableField(entityField = "title", operators = {CONTAINS})
    private String title;
}
```

### CreateDTO

```java
@Data
public static class CmsContentCreateDTO {

    // @ManyToOne -> ID only
    private String channelId;
    private String categoryId;
    private String authorUserId;

    // @ManyToMany -> EXCLUDED (managed via separate API)
    // DO NOT include: private Set<String> tagEntryIds;
    // Use: POST /api/contents/{id}/tags instead

    @NotBlank
    private String title;
}
```

### DetailDTO

```java
@Data
public static class CmsContentDetailDTO {

    private String contentId;

    // @ManyToOne -> full entity with field filter
    @JsonIncludeProperties({"channelId", "channelName"})
    private CmsChannel channel;

    @JsonIncludeProperties({"categoryId", "categoryName"})
    private CmsCategory category;

    @JsonIncludeProperties({"userId", "displayName"})
    private UserAccount authorUser;

    // @ManyToMany -> full collection
    private Set<CmsTagEntry> tagEntries;

    private String title;
}
```

---

## Troubleshooting

### Issue: Search not filtering by reference

**Entity Check**:
```java
@ManyToOne
private CmsChannel channel;  // Field name: channel
// CmsChannel has ID field: channelId
```

**DTO Fix**:
```java
// Wrong - direct field
entityField = "channelId"

// Correct - nested path
entityField = "channel.channelId"
```

### Issue: LazyInitializationException

**Cause**: Reference accessed outside transaction

**Solution**:
```java
// Use @JsonIncludeProperties to limit fields
@JsonIncludeProperties({"channelId", "channelName"})
private CmsChannel channel;

// Or ensure fetch is eager in query
```

### Issue: Circular reference in JSON

**Entity Check**: Bidirectional relationship
```java
// CmsChannel
@OneToMany(mappedBy = "channel")
private Set<CmsContent> contents;

// CmsContent
@ManyToOne
private CmsChannel channel;
```

**DTO Fix**:
```java
@JsonIgnoreProperties({"contents"})
private CmsChannel channel;
```

### Issue: Duplicate fields

**Entity Check**: Both reference and explicit ID
```java
private CmsChannel channel;
private String channelId;  // Both exist
```

**DTO Fix**: Search, Create, Update and BatchUpdate DTOs keep only the explicit ID; UpdateForm, Detail and List DTOs keep the object (§ Explicit ID Field Detection).

---

## Quick Reference

| Entity Annotation | SearchDTO | CreateDTO | DetailDTO |
|-------------------|-----------|-----------|-----------|
| `@ManyToOne Entity ref` | `String refId` + entityField path | `String refId` | `Entity ref` + @JsonIncludeProperties |
| `@ManyToMany Set<E>` | `Set<String> eIds` + entityField path | **EXCLUDE** (separate API) | `Set<E>` |
| `@OneToMany` (parent) | Skip | Skip (or parentId) | Include if tree |
| Self-reference | Skip in Search | `parentId` if needed | `children` list |
## A lazy relation names only its id

A `FetchType.LAZY` `@ManyToOne`/`@OneToOne` whose `@JsonIncludeProperties` names more than the id
answers two different shapes: the search joins the relation and serializes every named property,
while `findById(id, DetailDTO.class)` serializes the uninitialized proxy with its id alone. The list
draws the referenced record's name and the detail draws its raw id. Load such a relation `EAGER`
(the referenced table is small and always shown) or include only the id. The audit's
`lazy-relation-with-wide-json-include` refuses the shape.
