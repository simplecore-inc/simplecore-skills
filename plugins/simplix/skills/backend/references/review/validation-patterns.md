# Validation Patterns

Rules for translating entity constraints into DTO validation annotations.

> **Scope (canonical):** `@NotBlank`, `@NotNull`, `@Length`, `@Min`, `@Max`, `@Pattern`, `@UniqueFields`, `@UniqueComposites`, `@ValidateWith`, soft-delete-aware unique constraints, CreateDTO/UpdateDTO inheritance for these. For other DTO concerns, see siblings (i18n, references, @SearchableField, DTO roles).

## Contents

- [Entity to DTO Validation Mapping](#entity-to-dto-validation-mapping)
- [@ValidateWith (Class-Level Custom Validation)](#validatewith-class-level-custom-validation)
- [@NotBlank vs @NotNull](#notblank-vs-notnull)
- [@Length](#length)
- [@Min / @Max](#min--max)
- [@Pattern](#pattern)
- [@UniqueFields (Class-Level)](#uniquefields-class-level)
- [@UniqueComposites (Composite Unique Constraints)](#uniquecomposites-composite-unique-constraints)
- [Soft Delete Type Detection](#soft-delete-type-detection)
- [Complete Entity to DTO Example](#complete-entity-to-dto-example)
- [Troubleshooting](#troubleshooting)
- [Quick Reference](#quick-reference)

## Entity to DTO Validation Mapping

| Entity Annotation | DTO Annotation | Field Type |
|-------------------|----------------|------------|
| `@Column(nullable = false)` | `@NotBlank` | String |
| `@Column(nullable = false)` | `@NotNull` | Non-String |
| `@Column(length = N)` | `@Length(max = N)` | String |
| `@Column(unique = true)` | `@UniqueFields` | On class (single field) |
| `@UniqueConstraint(columnNames)` | `@UniqueComposites` | On class (multi-field) |
| `@Min(N)` | `@Min(N)` | Number |
| `@Max(N)` | `@Max(N)` | Number |
| `@Pattern(regexp)` | `@Pattern(regexp)` | String |
| `@Email` | `@Email` | String |
| `@Size(min, max)` | `@Size(min, max)` | Collection |

Exceptions to the table, each failed by the audit as an error:

- **A non-null String the entity initialises to `""`** (`@Column(nullable = false) private String siteKey = "";`). The empty string is one of the field's values (a scope key whose empty case is the whole installation), so the DTO takes `@NotNull`, never `@NotBlank`: `@NotBlank` refuses every write of exactly those records. Audit: `not-blank-on-a-meaningfully-empty-field`.
- **A field the entity's service writes over whatever the request sent** (the caller forced onto the record, a state derived from other fields, a name looked up from an account). The create and update DTOs carry no `@NotNull` / `@NotBlank` on it: bean validation runs before the service is entered, so the constraint refuses every request while the form has no control for the field. Keep the field and mark it server-owned in a comment. Audit: `required-field-the-service-overwrites`.

---

## @ValidateWith (Class-Level Custom Validation)

SimpliX's `@ValidateWith` annotation overcomes the limitations of Bean Validation by delegating complex business rules to service methods.

### Basic Usage

**Field-level validation**:
```java
public class UserDto {
    @ValidateWith(
        service = "userPositionService.validateId",
        message = "Invalid position ID"
    )
    private String positionId;
}

@Service
public class UserPositionService {
    public boolean validateId(String id) {
        return existsById(id);
    }
}
```

**Class-level validation (complex conditional validation)**:
```java
@Data
@ValidateWith(
    service = "authRolePermissionService.validateCreateDto",
    message = "{validation.authRolePermission.targetTypeRequired}"
)
public static class AuthRolePermissionCreateDTO {
    @NotNull
    private PermissionTargetType targetType;

    private String roleId;       // Required when targetType = ROLE
    private String userAccountId; // Required when targetType = USER
}
```

### Service Method Implementation

Conditional validation logic uses switch expressions to clearly handle required fields by enum type:

```java
@Service
public class AuthRolePermissionService {

    /**
     * Validates the DTO based on targetType.
     * <p>
     * When targetType is ROLE, roleId is required.
     * When targetType is USER, userAccountId is required.
     */
    public boolean validateCreateDto(AuthRolePermissionCreateDTO dto) {
        if (dto.getTargetType() == null) {
            return false;
        }

        return switch (dto.getTargetType()) {
            case ROLE -> dto.getRoleId() != null && !dto.getRoleId().isBlank();
            case USER -> dto.getUserAccountId() != null && !dto.getUserAccountId().isBlank();
        };
    }
}
```

### When to Use @ValidateWith

| Use Case | Example |
|----------|---------|
| Conditional required fields | Different fields required based on targetType |
| Interdependent fields | startDate < endDate validation |
| Validation requiring DB lookup | Check existence, check duplicates |
| Complex business rules | Multi-field combination validation |

### @ValidateWith vs Standard Bean Validation

| Aspect | Standard Bean Validation | @ValidateWith |
|--------|-------------------------|---------------|
| Complexity | Simple field validation | Complex business rules |
| Dependencies | None | Service bean injection possible |
| DB Access | Not possible | Possible |
| Conditional validation | Limited | Flexible |

---

## @NotBlank vs @NotNull

### Rule: Check Entity Field Type

**Entity**:
```java
@Column(nullable = false, length = 100)
private String name;  // String -> @NotBlank

@Column(nullable = false)
private Integer sortOrder;  // Non-String -> @NotNull

@Column(nullable = false)
@Enumerated(EnumType.STRING)
private ContentStatus status;  // Enum -> @NotNull

@Column(nullable = false)
private Boolean active;  // Boolean -> @NotNull
```

**DTO**:
```java
@NotBlank
@Length(max = 100)
private String name;

@NotNull
private Integer sortOrder;

@NotNull
private ContentStatus status;

@NotNull
private Boolean active;
```

### Common Mistake

```java
// WRONG - @NotBlank doesn't work on non-String types
@NotBlank
private Boolean active;  // Compilation error!

// CORRECT - Check entity field type first
@NotNull
private Boolean active;
```

---

## @Length

### Entity Source

```java
// Entity
@Column(length = 100)
private String name;

@Column(length = 500)
private String description;
```

### DTO Mapping

```java
// DTO
@Length(max = 100)
private String name;

@Length(max = 500)
private String description;
```

### Combined with @NotBlank

```java
// Entity
@Column(nullable = false, length = 100)
private String name;

// DTO
@NotBlank
@Length(max = 100)
private String name;
```

---

## @Min / @Max

### Entity Source

Check for validation annotations on entity:

```java
// Entity
@Min(0)
@Max(9999)
private Integer sortOrder;

@Min(1)
private Integer pageSize;
```

### DTO Mapping

```java
// DTO
@Min(0)
@Max(9999)
private Integer sortOrder;

@Min(1)
private Integer pageSize;
```

---

## @Pattern

### Entity Source

```java
// Entity
@Pattern(regexp = "^[a-z0-9-]+$")
@Column(length = 50)
private String code;
```

### DTO Mapping

```java
// DTO
@Pattern(regexp = "^[a-z0-9-]+$")
@Length(max = 50)
private String code;
```

### Common Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `^[A-Z]+$` | Uppercase only | `ABC` |
| `^[a-z0-9-]+$` | Slug format | `my-slug-123` |
| `^[A-Z0-9_]+$` | Code format | `MY_CODE_123` |
| `^\d{3}-\d{4}$` | Phone pattern | `123-4567` |

---

## @UniqueFields (Class-Level)

Class-level annotation to validate multiple unique field constraints.
Validates that specified field values are unique within their respective entity tables.
For update operations, it can exclude the current entity from the uniqueness check.

### Entity Source

```java
// Entity
@Column(nullable = false, unique = true, length = 50)
private String code;
```

### @UniqueField Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `entity` | **Yes** | Entity class with `@Column(unique = true)` |
| `field` | **Yes** | Entity field name with unique constraint |
| `property` | **Yes** | DTO property name (usually same as field) |
| `idField` | UpdateDTO | Entity `@Id` field name (for excluding self) |
| `idProperty` | UpdateDTO | DTO ID property name (for excluding self) |
| `softDeleteField` | Conditional | Required only if the entity soft-deletes (§ Soft Delete Type Detection) |
| `softDeleteType` | Conditional | `BOOLEAN` when the entity soft-deletes, omitted otherwise |

### Soft Delete Configuration

**CRITICAL**: The soft delete setting depends on whether the entity soft-deletes (§ Soft Delete Type Detection):

| Entity Has | softDeleteField | softDeleteType |
|------------|-----------------|----------------|
| `implements SoftDeletable` (or Hibernate's `@SoftDelete`) | `"deleted"` | `SoftDeleteType.BOOLEAN` |
| Neither | Do NOT set | Do NOT set |

**Soft-deleting entity** (most entities - the `deleted` flag of `SoftDeletable`):
```java
@UniqueField(entity = UserRole.class, field = "roleCode", property = "roleCode",
        softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)
```

**Hard-deleting entity** (no soft delete parameters):
```java
@UniqueField(entity = CmsChannel.class, field = "channelCode", property = "channelCode")
```

### CreateDTO vs UpdateDTO Inheritance Pattern

**CRITICAL: Use inheritance pattern** - declare in CreateDTO with idField/idProperty, inherit in UpdateDTO:

**Why this pattern?**
- Java annotations are **accumulated through inheritance**, not overridden
- If UpdateDTO declares its own `@UniqueFields`, BOTH annotations execute causing false duplicate detection
- By declaring `idField`/`idProperty` in CreateDTO, the same annotation works for both:
  - **Create**: ID field is null, so no self-exclusion (correct for new entity)
  - **Update**: ID field has value, so self is excluded from duplicate check

#### CreateDTO Example (WITH idField/idProperty for inheritance)

```java
@Data
@UniqueFields({
    @UniqueField(entity = CmsChannel.class, field = "channelCode", property = "channelCode",
                 idField = "channelId", idProperty = "channelId"),
    @UniqueField(entity = CmsChannel.class, field = "channelName", property = "channelName",
                 idField = "channelId", idProperty = "channelId")
})
public static class CmsChannelCreateDTO {
    @NotBlank
    @Length(max = 50)
    private String channelCode;

    @NotBlank
    @Length(max = 100)
    private String channelName;
}
```

#### UpdateDTO Example (NO separate @UniqueFields - just inherits)

```java
@Data
@EqualsAndHashCode(callSuper = true)
// NO @UniqueFields here - inherited from CreateDTO
public static class CmsChannelUpdateDTO extends CmsChannelCreateDTO {
    @NotBlank
    private String channelId;  // This value is used by inherited @UniqueFields
}
```

### With Soft Delete

When the entity soft-deletes, include soft delete parameters:

```java
// Entity that soft-deletes
@Entity
public class UserRole extends BaseEntity<String> implements SoftDeletable { ... }

// DTO - use "deleted" field with BOOLEAN type
@UniqueFields({
    @UniqueField(entity = UserRole.class, field = "roleCode", property = "roleCode",
            idField = "roleId", idProperty = "roleId",
            softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)
})
```

### SoftDeleteType Values

| Type | When to Use | Example |
|------|-------------|---------|
| `BOOLEAN` | The entity soft-deletes | the `deleted` flag `SoftDeletable` declares |
| `NONE` | The entity does not soft-delete | Hard delete only - omit softDeleteField entirely |

### Multiple Unique Fields

Check entity for multiple unique constraints:

```java
// Entity that soft-deletes
@Entity
public class User extends BaseEntity<String> implements SoftDeletable {
    @Id
    private String userId;

    @Column(unique = true)
    private String email;

    @Column(unique = true)
    private String username;
}
```

```java
// CreateDTO - WITH idField/idProperty for proper inheritance (the entity soft-deletes)
@UniqueFields({
    @UniqueField(entity = User.class, field = "email", property = "email",
            idField = "userId", idProperty = "userId",
            softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN),
    @UniqueField(entity = User.class, field = "username", property = "username",
            idField = "userId", idProperty = "userId",
            softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)
})
public static class UserCreateDTO {
    private String email;
    private String username;
}

// UpdateDTO - NO separate @UniqueFields, just inherit from CreateDTO
@EqualsAndHashCode(callSuper = true)
public static class UserUpdateDTO extends UserCreateDTO {
    @NotBlank
    private String userId;  // This value is used by inherited @UniqueFields
}
```

### Single vs Composite Unique: Which to Use?

| Entity Constraint | DTO Annotation |
|-------------------|----------------|
| `@Column(unique = true)` on single field | `@UniqueFields` |
| `@UniqueConstraint(columnNames = {...})` | `@UniqueComposites` |

---

## @UniqueComposites (Composite Unique Constraints)

Class-level annotation for validating **multi-field composite unique constraints**.
Use when entity has `@UniqueConstraint` with multiple columns.

### Entity Source

```java
@Table(uniqueConstraints = {
    @UniqueConstraint(name = "uk_org_emp", columnNames = {"organization_id", "employee_number"}),
    @UniqueConstraint(name = "uk_provider", columnNames = {"provider", "provider_id"})
})
public class Employee {
    private Long organizationId;
    private String employeeNumber;
    private SocialProvider provider;
    private String providerId;
}
```

### @UniqueComposite Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `entity` | **Yes** | Entity class with composite unique constraint |
| `fields` | **Yes** | Array of entity field names (must match column order) |
| `properties` | **Yes** | Array of DTO property names (same order as fields) |
| `idField` | UpdateDTO | Entity `@Id` field name (for excluding self) |
| `idProperty` | UpdateDTO | DTO ID property name (for excluding self) |
| `softDeleteField` | Conditional | Required only if the entity soft-deletes - use `"deleted"` |
| `softDeleteType` | Conditional | `BOOLEAN` when the entity soft-deletes, omitted otherwise |

### CreateDTO vs UpdateDTO Inheritance Pattern

**Same inheritance pattern as @UniqueFields** - declare in CreateDTO with idField/idProperty, inherit in UpdateDTO:

#### CreateDTO Example (WITH idField/idProperty for inheritance)

```java
@Data
@UniqueComposites({
    @UniqueComposite(
        entity = Employee.class,
        fields = {"organizationId", "employeeNumber"},
        properties = {"organizationId", "employeeNumber"},
        idField = "employeeId",
        idProperty = "employeeId",
        softDeleteField = "deleted",
        softDeleteType = SoftDeleteType.BOOLEAN
    )
})
public static class EmployeeCreateDTO {
    @NotNull
    private Long organizationId;

    @NotBlank
    private String employeeNumber;

    private String name;
}
```

#### UpdateDTO Example (NO separate @UniqueComposites - just inherits)

```java
@Data
@EqualsAndHashCode(callSuper = true)
// NO @UniqueComposites here - inherited from CreateDTO
public static class EmployeeUpdateDTO extends EmployeeCreateDTO {
    @NotBlank
    private String employeeId;  // This value is used by inherited @UniqueComposites
}
```

### Multiple Composite Constraints

```java
// Entity that soft-deletes, with multiple composite unique constraints
@Entity
@Table(uniqueConstraints = {
    @UniqueConstraint(name = "uk_user_provider", columnNames = {"user_id", "provider"}),
    @UniqueConstraint(name = "uk_provider_id", columnNames = {"provider", "provider_id"})
})
public class UserSocialConnection extends BaseEntity<String> implements SoftDeletable {
    @Id
    private String connectionId;
    // ... other fields
}

// CreateDTO - WITH idField/idProperty for inheritance
@UniqueComposites({
    @UniqueComposite(
        entity = UserSocialConnection.class,
        fields = {"userId", "provider"},
        properties = {"userId", "provider"},
        idField = "connectionId",
        idProperty = "connectionId",
        softDeleteField = "deleted",
        softDeleteType = SoftDeleteType.BOOLEAN
    ),
    @UniqueComposite(
        entity = UserSocialConnection.class,
        fields = {"provider", "providerId"},
        properties = {"provider", "providerId"},
        idField = "connectionId",
        idProperty = "connectionId",
        softDeleteField = "deleted",
        softDeleteType = SoftDeleteType.BOOLEAN
    )
})
public static class UserSocialConnectionCreateDTO {
    @NotBlank
    private String userId;

    @NotNull
    private SocialProvider provider;

    @NotBlank
    private String providerId;
}

// UpdateDTO - NO separate @UniqueComposites, just inherit
@EqualsAndHashCode(callSuper = true)
public static class UserSocialConnectionUpdateDTO extends UserSocialConnectionCreateDTO {
    @NotBlank
    private String connectionId;  // Used by inherited @UniqueComposites
}
```

### Field Order Matters

**CRITICAL:** The order of fields in `fields` and `properties` arrays MUST match.

```java
// Entity constraint
@UniqueConstraint(columnNames = {"organization_id", "employee_number"})

// DTO - ORDER MUST MATCH
@UniqueComposite(
    entity = Employee.class,
    fields = {"organizationId", "employeeNumber"},      // Same order
    properties = {"organizationId", "employeeNumber"}   // Same order
)
```

### @UniqueFields vs @UniqueComposites Summary

| Aspect | @UniqueFields | @UniqueComposites |
|--------|---------------|-------------------|
| Use case | Single-field unique | Multi-field composite unique |
| Entity source | `@Column(unique = true)` | `@UniqueConstraint(columnNames)` |
| Field specification | `field` (single) | `fields` (array) |
| Property specification | `property` (single) | `properties` (array) |
| CreateDTO pattern | WITH idField/idProperty (for inheritance) | WITH idField/idProperty (for inheritance) |
| UpdateDTO pattern | NO separate annotation (inherits from CreateDTO) | NO separate annotation (inherits from CreateDTO) |

---

## Soft Delete Type Detection

### Check Whether the Entity Soft-Deletes

**CRITICAL**: an entity soft-deletes when it implements `SoftDeletable` (`../entity/base-entity-patterns.md` § Soft Delete owns how soft delete is built): `@SQLDelete` sets its `deleted` flag and `@Filter` hides the row. An entity carrying Hibernate's own `@SoftDelete` annotation soft-deletes too, through a `deleted` column Hibernate manages. Either way the unique check must ignore deleted rows, or re-creating a deleted code is refused as a duplicate.

```java
// Entity that soft-deletes - use "deleted"/BOOLEAN in DTOs
@Entity
public class UserRole extends BaseEntity<String> implements SoftDeletable {
    @Builder.Default
    private Boolean deleted = false;
}

// DTO for an entity that soft-deletes
@UniqueField(entity = UserRole.class, field = "roleCode", property = "roleCode",
        softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)
```

```java
// Entity that hard-deletes (no SoftDeletable) - do NOT set softDeleteField in DTOs
@Entity
public class CmsChannel {
    // No soft delete support
}

// DTO for an entity that hard-deletes
@UniqueField(entity = CmsChannel.class, field = "channelCode", property = "channelCode")
```

### Quick Decision Guide

1. **Check the entity class**: does it implement `SoftDeletable` (or carry `@SoftDelete`)?
2. If **yes**: use `softDeleteField = "deleted"`, `softDeleteType = SoftDeleteType.BOOLEAN`
3. If **no**: do NOT set `softDeleteField` or `softDeleteType`

---

## Complete Entity to DTO Example

### Entity That Hard-Deletes

```java
@Entity
public class CmsChannel {
    @Id
    private String channelId;

    @Column(nullable = false, unique = true, length = 50)
    @Pattern(regexp = "^[a-z0-9-]+$")
    private String channelCode;

    @Column(nullable = false, length = 200)
    private String channelName;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ChannelType channelType;

    private Boolean active;

    @Min(1)
    @Max(100)
    private Integer pageSize;
}
```

### CreateDTO (Entity That Hard-Deletes)

```java
@Data
@UniqueFields({
    // NO softDeleteField since the entity hard-deletes
    // ALWAYS include idField/idProperty - UpdateDTO will use it via inheritance
    @UniqueField(entity = CmsChannel.class, field = "channelCode", property = "channelCode",
            idField = "channelId", idProperty = "channelId")
})
public static class CmsChannelCreateDTO {

    // @Column(nullable = false, unique = true, length = 50) + @Pattern
    @NotBlank
    @Length(max = 50)
    @Pattern(regexp = "^[a-z0-9-]+$")
    private String channelCode;

    // @Column(nullable = false, length = 200)
    @NotBlank
    @Length(max = 200)
    private String channelName;

    // @Column(length = 500)
    @Length(max = 500)
    private String description;

    // @Column(nullable = false) + @Enumerated
    @NotNull
    private ChannelType channelType;

    // No constraint - optional
    private Boolean active;

    // @Min(1) @Max(100)
    @Min(1)
    @Max(100)
    private Integer pageSize;
}
```

### UpdateDTO (Entity That Hard-Deletes)

```java
@Data
@EqualsAndHashCode(callSuper = true)
// NO @UniqueFields here - inherited from CreateDTO
// Java annotations accumulate through inheritance, NOT override
// The inherited @UniqueField will use channelId from this class
public static class CmsChannelUpdateDTO extends CmsChannelCreateDTO {
    @NotBlank
    private String channelId;
}
```

### Entity That Soft-Deletes

```java
@Entity
public class UserRole extends BaseEntity<String> implements SoftDeletable {
    @Id
    private String roleId;

    @Column(nullable = false, unique = true, length = 50)
    private String roleCode;
}
```

### CreateDTO (Entity That Soft-Deletes)

```java
@Data
@UniqueFields({
    // WITH softDeleteField="deleted" since the entity soft-deletes
    // ALWAYS include idField/idProperty - UpdateDTO will use it via inheritance
    @UniqueField(entity = UserRole.class, field = "roleCode", property = "roleCode",
            idField = "roleId", idProperty = "roleId",
            softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)
})
public static class UserRoleCreateDTO {
    @NotBlank
    @Length(max = 50)
    private String roleCode;
}
```

### UpdateDTO (Entity That Soft-Deletes)

```java
@Data
@EqualsAndHashCode(callSuper = true)
// NO @UniqueFields here - inherited from CreateDTO
// Java annotations accumulate through inheritance, NOT override
// The inherited @UniqueField will use roleId from this class
public static class UserRoleUpdateDTO extends UserRoleCreateDTO {
    @NotBlank
    private String roleId;  // This value is used by inherited @UniqueFields
}
```

---

## Troubleshooting

### Issue: Validation not working

**Check Entity**:
```java
@Column(nullable = false)  // Check this exists
private String name;
```

**Check DTO**:
```java
@NotBlank  // Add if entity has nullable = false
private String name;
```

### Issue: Wrong annotation type

**Entity Check**:
```java
// Is it String?
private String name;  // Use @NotBlank

// Is it non-String?
private Integer count;  // Use @NotNull
```

### Issue: @UniqueFields not validating

**Entity Check**:
1. Verify `@Column(unique = true)` exists
2. Check whether the entity soft-deletes (implements `SoftDeletable`, or carries `@SoftDelete`)
3. Verify ID field name matches

**DTO Check**:
1. `@UniqueFields` on class (not field)
2. All parameter names match entity
3. If the entity soft-deletes: use `softDeleteField = "deleted"`, `softDeleteType = SoftDeleteType.BOOLEAN`
4. If it hard-deletes: do NOT set `softDeleteField`/`softDeleteType`

### Issue: Length validation not working

**Entity Check**:
```java
@Column(length = 100)  // Check length attribute
private String name;
```

**DTO Check**:
```java
@Length(max = 100)  // Match entity length
private String name;
```

---

## Quick Reference

| Entity Has | DTO Needs |
|------------|-----------|
| `nullable = false` + String | `@NotBlank` |
| `nullable = false` + non-String | `@NotNull` |
| `length = N` | `@Length(max = N)` |
| `unique = true` (single field) | `@UniqueFields` on class |
| `@UniqueConstraint` (multi-field) | `@UniqueComposites` on class |
| `@Min(N)` | `@Min(N)` |
| `@Max(N)` | `@Max(N)` |
| `@Pattern(regexp)` | `@Pattern(regexp)` |
| `@Email` | `@Email` |

### Unique Validation Quick Guide

```
Single field unique?
├── YES → @UniqueFields with @UniqueField
│   ├── CreateDTO → WITH idField/idProperty (for inheritance)
│   └── UpdateDTO → NO @UniqueFields (inherits from CreateDTO)
└── NO → Composite unique (multiple fields)?
    └── YES → @UniqueComposites with @UniqueComposite
        ├── CreateDTO → WITH idField/idProperty (for inheritance)
        └── UpdateDTO → NO @UniqueComposites (inherits from CreateDTO)

CRITICAL: Java annotations ACCUMULATE through inheritance, NOT override.
- If both CreateDTO and UpdateDTO declare @UniqueFields, BOTH execute → false duplicates!
- CreateDTO's idField/idProperty works correctly:
  - Create: ID is null → no self-exclusion
  - Update: ID has value → self is excluded
```