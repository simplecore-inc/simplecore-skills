# Tree Entity Patterns

Hierarchical (tree) entities in SimpliX.

> **Scope (canonical):** self-referencing parent-child pattern, `children` collection, depth management, tree traversal repository helpers, tree-aware soft delete. For general relationship rules see **relationship-patterns.md**; for `children` field in DTOs see `../review/reference-field-patterns.md` (self-reference section).

---

## Overview

Tree entities represent hierarchical data like:
- Organization hierarchy
- Category structures
- Comment threads
- Menu structures
- Folder hierarchies

---

## TreeEntity Interface

### Interface Definition

```java
public interface TreeEntity<T extends TreeEntity<T>> {
    String getParentId();
    void setParentId(String parentId);
    T getParent();
    void setParent(T parent);
    List<T> getChildren();
    void setChildren(List<T> children);
    Integer getDepth();
    void setDepth(Integer depth);
    String getPath();
    void setPath(String path);
}
```

### Key Fields

| Field | Type | Purpose |
|-------|------|---------|
| `parentId` | `String` | FK to parent entity |
| `parent` | `T` | JPA relationship to parent |
| `children` | `List<T>` | Child entities (usually `@Transient`) |
| `depth` | `Integer` | Level in hierarchy (0 = root) |
| `path` | `String` | Materialized path (e.g., `/root/child1/child2/`) |

---

## Implementation Pattern

### Entity Class

```java
@Entity
@Audited
@Table(name = "cms_category")
@TreeEntityAttributes(
    tableName = "cms_category",
    idColumn = "category_id",
    parentIdColumn = "parent_id",
    sortOrderColumn = "sort_order"
)
@Comment("Content category hierarchy")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CmsCategory extends BaseEntity<String>
    implements TreeEntity<CmsCategory> {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID, generator = "uuid-v7")
    @UuidV7Generator
    @Column(name = "category_id", nullable = false, unique = true, updatable = false)
    private String categoryId;

    // Channel relationship
    @Column(name = "channel_id", nullable = false)
    private String channelId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", insertable = false, updatable = false)
    @JsonIncludeProperties({"channelId", "name"})
    private CmsChannel channel;

    // Tree fields
    @Column(name = "parent_id")
    private String parentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    @JsonIncludeProperties({"categoryId", "name"})
    private CmsCategory parent;

    @Transient
    private List<CmsCategory> children = new ArrayList<>();

    @Column(name = "depth", nullable = false)
    @Builder.Default
    private Integer depth = 0;

    @Column(name = "path", length = 1024)
    private String path;

    // Content fields
    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Type(JsonType.class)
    @Column(name = "name_i18n", columnDefinition = "TEXT")
    private Map<String, String> nameI18n;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Long sortOrder = 0L;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Override
    public String getId() {
        return getCategoryId();
    }

    @Override
    public void setId(String id) {
        setCategoryId(id);
    }
}
```

---

## @TreeEntityAttributes

### Purpose

Metadata annotation for tree-related operations and queries.

### Usage

```java
@TreeEntityAttributes(
    tableName = "cms_category",      // Database table name
    idColumn = "category_id",        // Primary key column
    parentIdColumn = "parent_id",    // Parent FK column
    sortOrderColumn = "sort_order"   // Sort order column
)
public class CmsCategory { }
```

### Fields

| Attribute | Purpose | Required |
|-----------|---------|----------|
| `tableName` | Database table name | Yes |
| `idColumn` | PK column name | Yes |
| `parentIdColumn` | Parent FK column name | Yes |
| `sortOrderColumn` | Sort order column | Optional |

---

## Path Management

### Path Format

- Format: `/{root_id}/{child1_id}/{child2_id}/`
- Root path: `/{entity_id}/`
- Always starts and ends with `/`

### Event Handler Pattern

```java
@Component
@RequiredArgsConstructor
public class CmsCategoryPathEventHandler {

    private final CmsCategoryRepository repository;
    private final CmsCategoryTreeRepository treeRepository;

    @EventListener
    @Transactional
    public void handleCategoryEvent(DomainEvent event) {
        if ("CMS_CATEGORY_CREATED".equals(event.getEventType()) ||
            "CMS_CATEGORY_UPDATED".equals(event.getEventType())) {

            String entityId = event.getEntityId();
            CmsCategory category = repository.findById(entityId).orElse(null);
            if (category == null) return;

            updatePathAndDepth(category);
        }
    }

    private void updatePathAndDepth(CmsCategory category) {
        if (category.getParentId() == null) {
            // Root node
            category.setDepth(0);
            category.setPath("/" + category.getCategoryId() + "/");
        } else {
            // Child node
            CmsCategory parent = repository.findById(category.getParentId()).orElse(null);
            if (parent != null) {
                category.setDepth(parent.getDepth() + 1);
                category.setPath(parent.getPath() + category.getCategoryId() + "/");
            }
        }
        repository.save(category);

        // Update all descendants
        updateDescendantPaths(category);
    }

    private void updateDescendantPaths(CmsCategory parent) {
        List<CmsCategory> children = repository.findByParentId(parent.getCategoryId());
        for (CmsCategory child : children) {
            child.setDepth(parent.getDepth() + 1);
            child.setPath(parent.getPath() + child.getCategoryId() + "/");
            repository.save(child);
            updateDescendantPaths(child);  // Recursive
        }
    }
}
```

---

## Tree Repository

### Basic Repository

```java
@Repository
public interface CmsCategoryRepository extends SimpliXBaseRepository<CmsCategory, String> {

    List<CmsCategory> findByParentId(String parentId);

    List<CmsCategory> findByParentIdIsNull();

    List<CmsCategory> findByChannelIdAndParentIdIsNull(String channelId);

    @Query("SELECT c FROM CmsCategory c WHERE c.path LIKE :path% ORDER BY c.depth, c.sortOrder")
    List<CmsCategory> findDescendants(@Param("path") String path);

    @Query("SELECT c FROM CmsCategory c WHERE c.channelId = :channelId ORDER BY c.depth, c.sortOrder")
    List<CmsCategory> findByChannelIdOrderByDepthAndSortOrder(@Param("channelId") String channelId);
}
```

### Tree Repository (For Tree Operations)

```java
@Repository
public interface CmsCategoryTreeRepository extends SearchableJpaRepository<CmsCategory, String> {

    // Custom tree operations can be added here
}
```

---

## Tree Service Pattern

### Building Tree Structure

```java
@Service
@RequiredArgsConstructor
public class CmsCategoryTreeService {

    private final CmsCategoryRepository repository;

    public List<CmsCategory> buildTree(String channelId) {
        List<CmsCategory> allCategories = repository.findByChannelIdOrderByDepthAndSortOrder(channelId);

        // Create ID to entity map
        Map<String, CmsCategory> categoryMap = allCategories.stream()
            .collect(Collectors.toMap(CmsCategory::getCategoryId, c -> c));

        // Build tree
        List<CmsCategory> roots = new ArrayList<>();

        for (CmsCategory category : allCategories) {
            category.setChildren(new ArrayList<>());

            if (category.getParentId() == null) {
                roots.add(category);
            } else {
                CmsCategory parent = categoryMap.get(category.getParentId());
                if (parent != null) {
                    parent.getChildren().add(category);
                }
            }
        }

        return roots;
    }

    public List<CmsCategory> getAncestors(String categoryId) {
        CmsCategory category = repository.findById(categoryId).orElseThrow();
        List<CmsCategory> ancestors = new ArrayList<>();

        while (category.getParentId() != null) {
            category = repository.findById(category.getParentId()).orElse(null);
            if (category != null) {
                ancestors.add(0, category);  // Add to beginning
            } else {
                break;
            }
        }

        return ancestors;
    }
}
```

---

## Example Entities

### Organization (Simple Tree)

```java
@Entity
@TreeEntityAttributes(
    tableName = "organization",
    idColumn = "organization_id",
    parentIdColumn = "parent_id",
    sortOrderColumn = "sort_order"
)
public class Organization extends BaseEntity<String>
    implements TreeEntity<Organization> {

    @Column(name = "parent_id")
    private String parentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    private Organization parent;

    @Transient
    private List<Organization> children = new ArrayList<>();

    @Column(name = "depth")
    private Integer depth = 0;

    @Column(name = "path")
    private String path;
}
```

### CmsComment (Thread Tree)

```java
@Entity
@TreeEntityAttributes(
    tableName = "cms_comment",
    idColumn = "comment_id",
    parentIdColumn = "parent_id"
)
public class CmsComment extends BaseEntity<String>
    implements TreeEntity<CmsComment> {

    @Column(name = "content_id", nullable = false)
    private String contentId;

    @Column(name = "parent_id")
    private String parentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    private CmsComment parent;

    @Transient
    private List<CmsComment> children = new ArrayList<>();

    @Column(name = "depth")
    private Integer depth = 0;

    @Column(name = "path")
    private String path;
}
```

---

## Best Practices

### 1. FK Normalization for parentId

**CRITICAL**: Always normalize parentId to prevent empty string vs NULL issues.

```java
import {basePackage}.domain.core.util.FkNormalizer;

@Entity
public class CmsCategory extends BaseEntity<String>
    implements TreeEntity<CmsCategory> {

    @Column(name = "parent_id")
    private String parentId;

    @PrePersist
    @PreUpdate
    private void prePersistAndUpdate() {
        normalizeFkFields();
    }

    private void normalizeFkFields() {
        this.parentId = FkNormalizer.normalize(this.parentId);
    }

    // TreeEntity interface - must also normalize
    @Override
    public void setParentId(String parentId) {
        this.parentId = FkNormalizer.normalize(parentId);
    }
}
```

**Why**: Empty string `''` is NOT equal to `NULL` in SQL. Check constraints and EAGER fetch fail with empty strings.

See [Base Entity Patterns - FK Normalization](base-entity-patterns.md#fk-string-normalization-empty-string-to-null) for full documentation.

### 2. Children Field

Always use `@Transient` for children:

```java
@Transient
private List<CmsCategory> children = new ArrayList<>();
```

**Reason**: Avoid lazy loading issues and circular references.

### 3. Path Updates

Always update path through event handler, not directly:

```java
// Good - event handler updates path automatically
category.setParentId(newParentId);
repository.save(category);  // Triggers event

// Bad - manual path update
category.setPath(newPath);  // Can become inconsistent
```

### 4. Depth Validation

Consider maximum depth limits:

```java
private static final int MAX_DEPTH = 10;

public void validateDepth(CmsCategory category) {
    if (category.getDepth() > MAX_DEPTH) {
        throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "Maximum hierarchy depth exceeded", null);
    }
}
```

### 5. Circular Reference Prevention

```java
public void validateNotCircular(CmsCategory category, String newParentId) {
    if (category.getCategoryId().equals(newParentId)) {
        throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "Category cannot be its own parent", null);
    }

    // Check if newParent is a descendant
    if (category.getPath() != null) {
        CmsCategory newParent = repository.findById(newParentId).orElse(null);
        if (newParent != null && newParent.getPath() != null &&
            newParent.getPath().contains("/" + category.getCategoryId() + "/")) {
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "Cannot create circular reference", null);
        }
    }
}
```

---

## See Also

- [Base Entity Patterns](base-entity-patterns.md) - BaseEntity structure
- [Relationship Patterns](relationship-patterns.md) - Parent/child relationships
- [YML Configuration](yml-configuration.md) - Generator configuration