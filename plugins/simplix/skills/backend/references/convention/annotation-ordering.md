# Annotation Ordering Reference

Exact annotation order for each component type. Derived from SimpliX generator templates and promoted code.

> **Scope (canonical):** class-level and method-level annotation order for Entity, Repository, Service, CRUD Controller, Non-CRUD Controller, DTOs container. For which annotations to use in the first place, see **anti-patterns.md** and the DTO references under `../review/`.

---

## Entity Class

```java
@Entity                                               // 1. JPA marker
@Audited                                              // 2. Envers audit (if needed)
@Table(                                               // 3. Table config
    name = "table_name",
    indexes = { @Index(name = "ix_table_field", columnList = "field") },
    uniqueConstraints = { @UniqueConstraint(name = "uq_table_desc", columnNames = {"col1", "col2"}) }
)
@Comment("Table description")                         // 4. Hibernate comment
@EntityEventConfig(                                   // 5. Domain event config
    onCreate = "ENTITY_NAME_CREATED",
    onUpdate = "ENTITY_NAME_UPDATED",
    onDelete = "ENTITY_NAME_DELETED",
    ignoreProperties = {"updatedAt", "version", "updatedBy"}
)
@SQLDelete(sql = "UPDATE table_name"                  // 6. Soft delete SQL
    + SoftDeletable.SQL_SOFT_DELETE_SET
    + "id = ?" + SoftDeletable.SQL_VERSION_CHECK)
@Filter(name = SoftDeletable.FILTER_NAME,             // 7. Soft delete filter
    condition = "deleted = :isDeleted")
@Getter                                               // 8. Lombok getter
@Setter                                               // 9. Lombok setter
@NoArgsConstructor                                    // 10. Lombok no-args constructor
@AllArgsConstructor                                   // 11. Lombok all-args constructor
@Builder                                              // 12. Lombok builder
public class EntityName extends BaseEntity<String> implements SoftDeletable {
```

### Entity Field Annotations

**ID field (always this exact set):**
```java
@Id                                                   // 1
@GeneratedValue(strategy = GenerationType.UUID,       // 2
    generator = "uuid-v7")
@UuidV7Generator                                      // 3
@Column(name = "id", nullable = false,                // 4
    unique = true, updatable = false)
@Comment("Unique identifier")                         // 5
private String id;
```

**Regular field:**
```java
@Column(name = "field_name", nullable = false,        // 1
    length = 100)
@Comment("Field description")                         // 2
private String fieldName;
```

**Enum field:**
```java
@Enumerated(EnumType.STRING)                          // 1
@Column(name = "status", nullable = false)            // 2
@Comment("Entity status")                             // 3
private EntityStatus status;
```

**FK dual-field pattern:**
```java
// Writing field (FK ID)
@Column(name = "parent_id", nullable = false)         // 1
@Comment("FK to parent entity")                       // 2
private String parentId;

// Reading field (entity reference)
@ManyToOne(fetch = FetchType.LAZY)                    // 1
@JoinColumn(name = "parent_id",                       // 2
    insertable = false, updatable = false,
    foreignKey = @ForeignKey(name = "fk_child__parent"))
private ParentEntity parent;
```

**Default value field:**
```java
@Column(name = "deleted", nullable = false)           // 1
@Comment("Soft delete flag")                          // 2
@Builder.Default                                      // 3
private Boolean deleted = false;
```

---

## CRUD Controller (extends SimpliXBaseController)

**Package Terminology:** `{module}` = root domain (e.g., `facility`, `user`, `dev`, `common`). `{subdomain}` = feature package segment (e.g., `identity`, `spatial`, `monitoring`, `sync`, `self`).

```java
@RestController                                       // 1
@RequestMapping("/kebab-case-path")                   // 2
@Tag(name = "{module}.{subdomain}.EntityName",         // 3
    description = "Entity description")
public class EntityNameRestController
    extends SimpliXBaseController<EntityName, String> {
```

### Controller Method Annotations

```java
@PostMapping("/create")                               // 1. HTTP mapping
@Operation(summary = "Create EntityName",             // 2. OpenAPI
    description = "Creates a new EntityName")
@PreAuthorize("hasPermission('EntityName', 'create')")// 3. Security
public SimpliXApiResponse<EntityNameDetailDTO> create(
    @RequestBody @Validated EntityNameCreateDTO createDto) {
```

**Order update (special case — adds @SimpliXStandardApi):**
```java
@PatchMapping("/order")                               // 1
@Operation(summary = "Update EntityName Orders",      // 2
    description = "Updates the order of multiple entities")
@SimpliXStandardApi                                   // 3. Standard API marker
@PreAuthorize("hasPermission('EntityName', 'edit')")  // 4
public SimpliXApiResponse<List<EntityNameDetailDTO>> updateOrder(...)
```

---

## Non-CRUD Controller

```java
@RestController                                       // 1
@RequestMapping("/path")                              // 2
@Tag(name = "{module}.{subdomain}.Purpose",            // 3
    description = "Controller description")
@SimpliXStandardApi                                   // 4. Class-level (not method-level)
public class PurposeController {
```

`@SimpliXStandardApi` marks endpoints for automatic Swagger schema generation — it tells SimpliX to include standard request/response schemas in the OpenAPI documentation.

Note: `@SimpliXStandardApi` is at **class level** for non-CRUD controllers, but at **method level** (only on special endpoints) for CRUD controllers.

---

## Service

```java
@Service                                              // 1
@Transactional(readOnly = true)                       // 2
public class EntityNameService
    extends SimpliXBaseService<EntityName, String> {
```

### Service Method Annotations

```java
@Transactional                                        // 1. Write transaction
public EntityNameDetailDTO create(EntityNameCreateDTO createDTO) {
```

```java
@Override                                             // 1. Override marker
public boolean hasOwnerPermission(String permission, String id, Object dto) {
```

---

## Repository

```java
@Repository                                           // 1
public interface EntityNameRepository
    extends SimpliXBaseRepository<EntityName, String> {
```

### Repository Method Annotations

```java
@Query("SELECT e FROM EntityName e WHERE e.field = :value")  // 1
Optional<EntityName> findByField(@Param("value") String value);

@Modifying                                            // 1
@Query(value = "UPDATE table SET col = NULL WHERE id = :id",  // 2
    nativeQuery = true)
void nullifyField(@Param("id") String id);
```

---

## DTO Annotations

### SearchDTO
```java
@Getter                                               // 1
@Setter                                               // 2
public static class EntityNameSearchDTO {

    @Schema(description = "Field description")        // 1
    @FieldLabel("{entities.EntityName.fieldName}")     // 2
    @SearchableField(entityField = "fieldName",       // 3
        operators = {EQUALS, CONTAINS}, sortable = true)
    private String fieldName;
```

### CreateDTO
```java
@Data                                                 // 1
@UniqueFields({...})                                  // 2 (conditional)
public static class EntityNameCreateDTO {

    @Schema(description = "Field description")        // 1
    @FieldLabel("{entities.EntityName.fieldName}")     // 2
    @NotBlank                                         // 3 (validation)
    @Length(max = 100)                                 // 4 (validation)
    private String fieldName;
```

### UpdateDTO
```java
@Data                                                 // 1
@EqualsAndHashCode(callSuper = true)                  // 2
public static class EntityNameUpdateDTO
    extends EntityNameCreateDTO {

    @Schema(description = "Entity ID")                // 1
    @FieldLabel("{entities.EntityName.id}")            // 2
    @NotBlank(message = "ID is required")             // 3
    private String id;
```

### DetailDTO / ListDTO
```java
@Data                                                 // 1
public static class EntityNameDetailDTO {

    @Schema(description = "Field description")        // 1
    @JsonIncludeProperties({"refId", "refName"})      // 2 (on ManyToOne fields)
    @I18nTrans(source = "fieldI18n")                  // 3 (on i18n base field)
    @JsonIgnore                                       // 4 (on i18n Map field)
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm")     // 5 (on Instant fields)
    private Type fieldName;
```

---

## Naming Conventions Summary

| Convention | Pattern | Example |
|-----------|---------|---------|
| Table name | `snake_case` (plural) | `access_points`, `credentials` |
| Column name | `snake_case` | `user_id`, `card_number` |
| Index name | `ix_{table}_{field}` | `ix_credential_user` |
| Unique constraint | `uq_{table}_{description}` | `uq_schedule_name` |
| FK constraint | `fk_{source}__{target}` | `fk_credential__user` (double underscore) |
| Event name | `{ENTITY_SCREAMING_SNAKE}_{ACTION}` | `CREDENTIAL_CREATED` |
| Request path | `/kebab-case` | `/access-point`, `/sync/execution` |
| `@Tag` name | `{module}.{subdomain}.{Name}` | `facility.identity.Credential` |
| Permission | `hasPermission('{EntityName}', '{action}')` | `hasPermission('Credential', 'create')` |
