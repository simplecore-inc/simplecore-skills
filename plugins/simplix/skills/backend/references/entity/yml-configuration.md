# YML Configuration Reference

SimpliX generator YML (`/.simplix/entity/*.yml`).

> **Generator version anchor**: This YML schema is valid for `yo simplix:*` generators of the SimpliX 2.x generation. When the generator is upgraded, re-audit this file for new keys or renamed fields.

> **Scope (canonical):** every YML key - `entity`, `modulePath`, `idField`, `nameField`, `defaultSortField`, `defaultSortDirection`, `fields.*` (views, sortable, searchOperators, reference, required, unique, maxLength). For generator CLI commands and promote workflow, see `../generator/`; for template hacking see `../generator/template-customization.md`.

---

## File Location

```
.simplix/entity/{EntityName}.yml
```

Example: `.simplix/entity/CmsChannel.yml`

---

## Creating YML Configuration

**IMPORTANT**: Always create YML files using the command first, then modify.

```bash
# Create YML configuration for an entity
yo simplix:config EntityName --force

# Examples
yo simplix:config CmsChannel --force
yo simplix:config CmsContent --force
```

The command generates a YML file by analyzing the existing entity class and extracting field information automatically.

**Workflow** (the step order SKILL.md #15 points to; the promote half is owned by `../generator/promote-workflow.md`):
1. Create the entity class and its repository (`base-entity-patterns.md`, `repository-patterns.md` § File Location); the generator writes neither
2. Write its message bundles in every locale the project ships: entity labels and enum values (SKILL.md #16)
3. Run domain module tests: `./gradlew :packages:domain-<aggregate>:test`
   - **MANDATORY**: Tests validate entity and enum i18n translations
   - Fix any missing translations before proceeding
4. Run `yo simplix:config EntityName --force` to generate YML
5. Modify the generated YML as needed (views, searchOperators, references, etc.)
6. Run the collision check (`../generator/promote-workflow.md` § Before generating), then `yo simplix:generate EntityName --force` to generate service/controller/DTOs
7. Promote, and finish what the template leaves: `../generator/promote-workflow.md`
8. Customize within the invariants

---

## Basic Structure

```yaml
entity: CmsChannel
modulePath: cms/channel
idField: channelId
nameField: name
thymeleafBaseDir: cms/channel
defaultSortField: createdAt
defaultSortDirection: desc

fields:
  name:
    sortable: true
    views: [list, detail, edit]
    required: true
    maxLength: 128
    searchOperators: [contains]

  channelCode:
    sortable: true
    views: [list, detail, edit]
    required: true
    unique: true
    maxLength: 64
    searchOperators: [equals, contains]

  active:
    sortable: true
    views: [list, detail, edit, batchUpdate]
    searchOperators: [equals]
```

---

## Top-Level Properties

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| `entity` | String | Entity class name. The yml's file name is the class prefix of everything generated (`<Name>Service`, `<Name>DTOs`, the `@Tag`); the two differ only for a second surface over an entity that already has one (§ A second surface over one entity) | Yes |
| `modulePath` | String | Package path (e.g., `cms/channel`) | Yes |
| `idField` | String | Primary key field name | Yes |
| `nameField` | String | Display name field | Yes |
| `thymeleafBaseDir` | String | Template directory path, and the REST path: the controller template writes `@RequestMapping("/" + thymeleafBaseDir)`. Set it to the URL the controller must serve (`admin/billing/credit-hold`) | Optional |
| `defaultSortField` | String | Default sort field | Optional |
| `defaultSortDirection` | String | `asc` or `desc` | Optional |
| `controllerName` | String | REST controller class name; default `<Entity>RestController`. Set it to keep a live name, since the operation ids derive from it (`generator/promote-workflow.md` § Before generating) | Optional |

### A second surface over one entity

A self-scoped portal list beside an operators' list reads the same entity through different
classes. Write a second yml named after the new surface, with `entity` naming the entity:
`.simplix/entity/My<Entity>.yml` with `entity: <Entity>`, its own `modulePath`, `promoteModule`
and `thymeleafBaseDir`. `yo simplix:generate My<Entity>` then `yo simplix:promote My<Entity>
--module <promoteModule>` write `My<Entity>Service`, `My<Entity>DTOs` and
`My<Entity>RestController`, so the bean names, the DTO names SimpliX Meta keys its types by, and
the tag the frontend names the entity after never collide with the first surface. Trim it to its
reads and force the caller's scope in the service (SKILL.md #15③). Templates read the entity
class as `entityName` and the prefix as `classPrefix`; a project template still writing
`<%= entityName %>Service` generates the second surface under the first one's class names.

### Project template keys

A project's own templates may read further top-level keys through `ymlConfig`. Each one replaces a
manual rewrite that every regeneration would otherwise undo:

| Key | Read by | Emits |
|---|---|---|
| `permissionGroup` | controller template | `hasPermission('<group>', ...)` instead of the entity name (#9) |
| `notFoundMessageKey` | controller template | `MessageUtils.get("<key>")` instead of an English not-found literal (#3) |
| `ownerPermission` | controller template | `or @<entity>Service.hasOwnerPermission(...)` on update, get and edit form |

When a hunk survives every regeneration as the same hand edit, it is template input: add a key, read
it in `.simplix/templates/`, set it in the yml and regenerate, rather than repeating the edit after
each promote. Only logic the generator has no input for (a Keycloak call, a derived count) stays as
customisation.

---

## Field Configuration

### Basic Field Properties

```yaml
fields:
  fieldName:
    sortable: true          # Can sort by this field
    views: [list, detail]   # Where field appears
    required: true          # Validation
    unique: true            # Unique constraint
    maxLength: 128          # String max length
    searchOperators: []     # Search options
```

### Property Reference

| Property | Type | Description |
|----------|------|-------------|
| `sortable` | Boolean | Enable sorting |
| `views` | Array | UI views where field appears |
| `required` | Boolean | Required validation |
| `unique` | Boolean | Unique constraint |
| `maxLength` | Integer | Max string length |
| `searchOperators` | Array | Search operators |
| `reference` | Object | Entity relationship config |

---

## Views

Views control where fields appear in generated code.

### Available Views

| View | Purpose | Generated In |
|------|---------|--------------|
| `list` | List/table display | ListDTO, List template |
| `detail` | Detail view | DetailDTO, Detail template |
| `edit` | Create/edit form | `<Entity>CreateDTO`, `<Entity>UpdateDTO` |
| `batchUpdate` | Bulk update | `<Entity>BatchUpdateDTO` |

### Examples

```yaml
# Read-only field (display only)
name:
  views: [list, detail]

# Editable field
description:
  views: [list, detail, edit]

# Batch updateable
active:
  views: [list, detail, edit, batchUpdate]

# Edit only (not in list)
body:
  views: [detail, edit]
```

---

## Search Operators

### Available Operators

| Operator | SQL Equivalent | Use Case |
|----------|---------------|----------|
| `equals` | `= ?` | Exact match |
| `notEquals` | `!= ?` | Not equal |
| `contains` | `LIKE %?%` | Substring search |
| `startsWith` | `LIKE ?%` | Prefix match |
| `endsWith` | `LIKE %?` | Suffix match |
| `greaterThan` | `> ?` | Greater than |
| `lessThan` | `< ?` | Less than |
| `greaterThanOrEqual` (or `greaterThanOrEquals`) | `>= ?` | Greater or equal; the lower bound of a date range |
| `lessThanOrEqual` (or `lessThanOrEquals`) | `<= ?` | Less or equal; the upper bound of a date range |
| `between` | `BETWEEN ? AND ?` | Range |
| `in` | `IN (?)` | Multiple values |
| `isNull` | `IS NULL` | Null check |
| `isNotNull` | `IS NOT NULL` | Not null check |

### Common Patterns

```yaml
# String field
name:
  searchOperators: [equals, contains]

# Boolean field
active:
  searchOperators: [equals]

# Enum field
status:
  searchOperators: [equals, in]

# Date field (Instant, LocalDate, LocalTime): the inclusive pair, never greaterThan / lessThan alone.
# The frontend's date range filter sends greaterThanOrEqualTo and lessThanOrEqualTo, and a field
# that does not declare them answers every ranged read with SEARCH_INVALID_PARAMETER.
createdAt:
  searchOperators: [between, greaterThanOrEqual, lessThanOrEqual]

# ID field (FK)
channelId:
  searchOperators: [equals, in]

# Numeric field
sortOrder:
  searchOperators: [equals, between, greaterThan, lessThan]
```

---

## Reference Configuration

For entity relationships (ManyToOne, ManyToMany).

### Single Reference (ManyToOne)

```yaml
fields:
  channelId:
    sortable: true
    views: [list, detail, edit]
    required: true
    searchOperators: [equals]
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
    views: [detail, edit]
    searchOperators: [in]
    reference:
      entity: CmsTagEntry
      idField: tagEntryId
      idType: String
      nameField: name
      multiple: true
```

### Reference Properties

| Property | Type | Description |
|----------|------|-------------|
| `entity` | String | Related entity class name |
| `idField` | String | Related entity ID field |
| `idType` | String | ID type (`String`, `Long`, etc.). Always `String` in SimpliX projects - see CRUD Layer Stack in SKILL.md. |
| `nameField` | String | Display field for dropdown |
| `multiple` | Boolean | `false` for ManyToOne, `true` for ManyToMany |

---

## Sort Order Configuration

For entities with manual ordering.

```yaml
sortOrderConfig:
  field: sortOrder
  autoIncrement: true
  gap: 100
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `field` | String | Sort order field name |
| `autoIncrement` | Boolean | Auto-assign on create |
| `gap` | Integer | Gap between values (for reordering) |

### Generated Behavior

- New entities get `sortOrder = maxSortOrder + gap`
- Reordering calculates values between neighbors
- Gap allows inserting between existing items

---

## Complete Example

### CmsContent.yml

```yaml
entity: CmsContent
modulePath: cms/content
idField: contentId
nameField: title
thymeleafBaseDir: cms/content
defaultSortField: createdAt
defaultSortDirection: desc

fields:
  channelId:
    sortable: true
    views: [list, detail, edit]
    required: true
    searchOperators: [equals]
    reference:
      entity: CmsChannel
      idField: channelId
      idType: String
      nameField: name
      multiple: false

  title:
    sortable: true
    views: [list, detail, edit]
    required: true
    maxLength: 256
    searchOperators: [contains]

  titleI18n:
    views: [detail, edit]

  slug:
    sortable: true
    views: [list, detail, edit]
    unique: true
    maxLength: 256
    searchOperators: [equals, contains]

  body:
    views: [detail, edit]
    searchOperators: [contains]

  status:
    sortable: true
    views: [list, detail, edit, batchUpdate]
    required: true
    searchOperators: [equals, in]

  publishedAt:
    sortable: true
    views: [list, detail, edit]
    searchOperators: [between, greaterThanOrEqual, lessThanOrEqual]

  featured:
    sortable: true
    views: [list, detail, edit, batchUpdate]
    searchOperators: [equals]

  viewCount:
    sortable: true
    views: [list, detail]
    searchOperators: [greaterThan, lessThan, between]

  tagIds:
    views: [detail, edit]
    searchOperators: [in]
    reference:
      entity: CmsTagEntry
      idField: tagEntryId
      idType: String
      nameField: name
      multiple: true

sortOrderConfig:
  field: sortOrder
  autoIncrement: true
  gap: 100
```

---

## Code Generation

### Command

```bash
# Generate single entity
yo simplix:generate CmsContent

# Force overwrite
yo simplix:generate CmsContent --force

# Multiple entities
yo simplix:generate CmsContent CmsChannel CmsCategory
```

### Generated Files

| Type | Generated Output | Promoted Location (`../generator/promote-workflow.md` § File Mapping) |
|------|------------------|-------------------|
| Repository | not generated; written by hand before `yo simplix:config` | `repository-patterns.md` § File Location |
| Service | `generated/main/java/.../web/{modulePath}/service/` | `src/main/java/.../web/{modulePath}/service/` |
| Controller | `generated/main/java/.../web/{modulePath}/controller/rest/` | `src/main/java/.../web/{modulePath}/controller/rest/` |
| DTOs | `generated/main/java/.../web/{modulePath}/dto/` | `src/main/java/.../web/{modulePath}/dto/` |

---

## Troubleshooting

### Field Not Appearing in DTO

**Check**: `views` array includes the required view
```yaml
# Missing 'edit' - won't appear in the CreateDTO
fieldName:
  views: [list, detail]  # Add 'edit'
```

### Search Not Working

**Check**: `searchOperators` is configured
```yaml
# Missing searchOperators - no search generated
fieldName:
  sortable: true
  # Add: searchOperators: [equals, contains]
```

### Reference Not Resolved

**Check**: Entity and field names match actual code
```yaml
reference:
  entity: CmsChannel      # Must match class name exactly
  idField: channelId      # Must match field name exactly
```

### Wrong Import in Generated Code

**Check**: `modulePath` is the one the entity's package gives (`base-entity-patterns.md` § Path convention). In the type-first layout the repository import is built from `modulePath`, so a `modulePath` that differs from the entity's package imports a repository package that does not exist:

```yaml
# Entity at: {basePackage}/domain/entity/cms/channel/CmsChannel.java
modulePath: cms/channel  # Correct

# Wrong: the generated service imports {basePackage}.domain.repository.cms.CmsChannelRepository
modulePath: cms
```

In the module-first layout (`repository.deriveFromEntity: true`) the repository import follows the entity's package, and `modulePath` decides only where the service, controller and DTOs are written.

---

## See Also

- [Base Entity Patterns](base-entity-patterns.md) - Entity structure
- [Relationship Patterns](relationship-patterns.md) - Reference configuration details
- [Field Types](field-types.md) - Field type patterns