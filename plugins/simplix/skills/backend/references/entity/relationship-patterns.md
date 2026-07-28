# Relationship Patterns

JPA relationships on SimpliX entities.

> **Scope (canonical):** `@ManyToOne`, `@ManyToMany`, `@OneToMany`, `@JoinColumn`, FK ID field + reference object pair convention, cascade rules. For hierarchical / self-referencing trees see **tree-entity-patterns.md**; for the DTO side of relationships see `../review/reference-field-patterns.md`.

---

## ManyToOne (ID + Entity Pattern)

This is the most common relationship pattern. It uses two fields: an ID field for writing and an entity field for reading.

### Pattern

```java
// ID field - for writing/updating FK
@Column(name = "channel_id")
private String channelId;

// Entity field - for reading/navigation (read-only)
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "channel_id", insertable = false, updatable = false)
@JsonIncludeProperties({"channelId", "name"})
private CmsChannel channel;
```

### Why This Pattern?

| Aspect | Benefit |
|--------|---------|
| Writing FK | Use `entity.setChannelId(id)` directly |
| No extra query | Don't need to load related entity to set FK |
| JPA navigation | Access `entity.getChannel().getName()` |
| JSON serialization | Controlled via `@JsonIncludeProperties` |

### Key Points

1. **Column Name**: Both fields share the same `name = "channel_id"`
2. **Entity Field**: Must have `insertable = false, updatable = false`
3. **Fetch Type**: Use `LAZY` for all relationships (default best practice)
4. **JSON Control**: Always add `@JsonIncludeProperties` to prevent circular references

### Service Layer Usage

```java
// Creating entity - use ID field
public CmsContent create(CreateRequest request) {
    CmsContent entity = new CmsContent();
    entity.setChannelId(request.getChannelId());  // Use ID field
    entity.setTitle(request.getTitle());
    return repository.save(entity);
}

// Reading entity - access via entity field
public ContentResponse get(String id) {
    CmsContent entity = repository.findById(id).orElseThrow();
    return new ContentResponse(
        entity.getContentId(),
        entity.getChannel().getName()  // Access via entity field
    );
}
```

---

## ManyToMany

### Basic Pattern

```java
@ManyToMany(fetch = FetchType.LAZY)
@JoinTable(
    name = "cms_content_tag",
    joinColumns = @JoinColumn(name = "content_id"),
    inverseJoinColumns = @JoinColumn(name = "tag_id")
)
@BatchSize(size = 20)
private Set<CmsTagEntry> tags = new HashSet<>();
```

### Join Table Naming

- Pattern: `{owning_entity}_{related_entity}` (snake_case, alphabetical or by ownership)
- Example: `cms_content_tag`, `user_role`

### With Additional Columns

When join table needs extra fields, create an entity:

```java
// Join entity
@Entity
@Table(name = "cms_content_link")
public class CmsContentLink extends BaseEntity<String> {

    @Column(name = "source_content_id")
    private String sourceContentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_content_id", insertable = false, updatable = false)
    private CmsContent sourceContent;

    @Column(name = "target_content_id")
    private String targetContentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_content_id", insertable = false, updatable = false)
    private CmsContent targetContent;

    @Column(name = "link_type", length = 32)
    private String linkType;

    @Column(name = "sort_order")
    private Long sortOrder;
}
```

---

## OneToMany

### Basic Pattern

```java
@OneToMany(mappedBy = "channel", cascade = CascadeType.ALL, orphanRemoval = true)
@BatchSize(size = 20)
private List<CmsContent> contents = new ArrayList<>();
```

### Key Options

| Option | Purpose |
|--------|---------|
| `mappedBy` | Field name in child entity |
| `cascade = CascadeType.ALL` | Cascade all operations |
| `orphanRemoval = true` | Delete children when removed from collection |

### Fetch Considerations

```java
// For collections, always use LAZY
@OneToMany(mappedBy = "channel", fetch = FetchType.LAZY)
@BatchSize(size = 20)  // Batch loading to avoid N+1
private List<CmsContent> contents = new ArrayList<>();
```

---

## Self-Reference (Same Entity)

### Parent-Child in Same Table

```java
// Parent ID field
@Column(name = "parent_id")
private String parentId;

// Parent entity field
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "parent_id", insertable = false, updatable = false)
@JsonIncludeProperties({"entityId", "name"})
private MyEntity parent;

// Children (for tree display)
@Transient
private List<MyEntity> children = new ArrayList<>();
```

### For Hierarchical Structures

See [Tree Entity Patterns](tree-entity-patterns.md) for full implementation.

---

## @JsonIncludeProperties

### Purpose

Prevents circular references and controls JSON output.

### Usage

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "channel_id", insertable = false, updatable = false)
@JsonIncludeProperties({"channelId", "name", "channelCode"})
private CmsChannel channel;
```

### Common Field Selections

| Relationship | Fields to Include |
|--------------|-------------------|
| CmsChannel | `channelId`, `name`, `channelCode` |
| UserAccount | `userAccountId`, `displayName` |
| Organization | `organizationId`, `name` |
| CmsTagEntry | `tagEntryId`, `name` |

---

## @BatchSize Optimization

### Purpose

Prevents N+1 query problem by batch loading.

### Usage

```java
// On entity class
@Entity
@BatchSize(size = 20)
public class CmsTagEntry extends BaseEntity<String> { }

// On collection field
@ManyToMany
@BatchSize(size = 20)
private Set<CmsTagEntry> tags;
```

### Recommended Sizes

| Scenario | Size |
|----------|------|
| Frequently accessed | 20-50 |
| Large collections | 100 |
| Rarely accessed | 10 |

---

## YML Configuration for Relationships

### Single Reference (ManyToOne)

```yaml
fields:
  channelId:
    required: true
    reference:
      entity: CmsChannel
      idField: channelId
      idType: String
      nameField: name
      multiple: false
```

### Multiple Reference (ManyToMany)

```yaml
fields:
  tagIds:
    reference:
      entity: CmsTagEntry
      idField: tagEntryId
      idType: String
      nameField: name
      multiple: true
```

---

## Common Patterns Summary

### Quick Reference

| Relationship | Pattern |
|--------------|---------|
| ManyToOne | ID field + Entity field (`insertable = false, updatable = false`) |
| ManyToMany | `@JoinTable` with `Set<Entity>` |
| OneToMany | `mappedBy` with `cascade` and `orphanRemoval` |
| Self-reference | Same as ManyToOne with parent/children |

### Decision Guide

```
Need to reference another entity?
├── Single parent entity?
│   └── Use ManyToOne (ID + Entity pattern)
│
├── Multiple related entities?
│   ├── No extra data on relationship?
│   │   └── Use ManyToMany with @JoinTable
│   └── Extra data needed?
│       └── Create join entity with ManyToOne fields
│
└── Has child collection?
    └── Use OneToMany with mappedBy
```

---

## Troubleshooting

### FK Not Persisted

**Problem**: Foreign key is null after save

**Solution**: Use ID field setter, not entity setter
```java
// Wrong
entity.setChannel(channelService.findById(channelId).orElseThrow());

// Correct
entity.setChannelId(channelId);
```

### LazyInitializationException

**Problem**: Cannot access lazy-loaded entity outside transaction

**Solutions**:
1. Use `@BatchSize` to reduce queries
2. Access within `@Transactional` boundary
3. Use `@EntityGraph` on the repository query method

### Circular Reference in JSON

**Problem**: StackOverflowError or infinite JSON

**Solution**: Add `@JsonIncludeProperties`
```java
@JsonIncludeProperties({"channelId", "name"})
private CmsChannel channel;
```

### N+1 Query Problem

**Problem**: Separate query for each related entity

**Solution**: Add `@BatchSize`
```java
@BatchSize(size = 20)
private Set<CmsTagEntry> tags;
```

---

## See Also

- [Base Entity Patterns](base-entity-patterns.md) - BaseEntity structure
- [Tree Entity Patterns](tree-entity-patterns.md) - Hierarchical structures
- [Entity-to-DTO Mapping](../review/entity-to-dto-mapping.md) - Which relationship fields go into which DTO role (especially `@ManyToMany` exclusion from Create/Update)
- [Reference Field Patterns](../review/reference-field-patterns.md) - `@JsonIncludeProperties`, FK vs object in DTOs
- [YML Configuration](yml-configuration.md) - SimpliX generator config