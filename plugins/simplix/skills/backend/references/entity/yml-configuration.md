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
| `nameField` | String | Display name field. `config` seeds it from the entity's `@NameField` mark; a yml that names another field than the mark is warned about, since Meta publishes the mark (`field-types.md` § Entity name, plural and description) | Yes |
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
manual rewrite that would otherwise stay as a customisation in every promoted file:

| Key | Read by | Emits |
|---|---|---|
| `permissionGroup` | controller template | `hasPermission('<group>', ...)` instead of the entity name (#9) |
| `notFoundMessageKey` | controller template | `MessageUtils.get("<key>")` instead of an English not-found literal (#3) |
| `ownerPermission` | controller template | `or @<entity>Service.hasOwnerPermission(...)` on update, get and edit form |
| `statusCounts` | controller and service templates | `@SimpliXListFigures(statusCounts = {...})` and the endpoint counting rows per value of each listed field |
| `aggregates` | controller and service templates | `@SimpliXListFigures.Figure(field, op)` per item (`op`: `sum`, `count`, `countDistinct`, `min`, `max`) and the endpoint returning them |
| `timeAxisField` | controller and service templates | `@SimpliXListFigures(timeAxis = "<field>")` and the endpoint counting rows per slice of a time window on that entity field |
| `figureScope` | service template | the service method (`{ method, mayMatchNothing }`) that forces the caller's scope on the search parameters before the figures are read, so a card never counts rows the list hides |

The figure keys feed the framework annotation described in `../convention/canonical-controller.md` § Class-Level List Metadata; the framework publishes the annotation and serves no endpoint, so a template that reads these keys emits both. A yml key no template reads changes nothing.

When the same hand edit appears in every promoted file, it is template input: add a key, read
it in `.simplix/templates/`, set it in the yml and regenerate, rather than repeating the edit in
each promoted file. Only logic the generator has no input for (a Keycloak call, a derived count) stays as
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
| `searchKeyword` | Boolean | Includes the search field in the list's keyword search |
| `comment` | String | The `@Schema` description of the field in every DTO; wins over the entity's `@Comment` and Javadoc |
| `reference` | Object | Entity relationship config |

### A derived field

A `@Formula` attribute has no column, so it is declared in the yml like a read-only column: `views:
[list, detail]`, its `sortable`, `searchOperators` and `searchKeyword`, and a `comment`. The comment
is the only description input the generator has for it: the generator reads `@Comment` and a Javadoc
sitting directly above the annotations, and a Javadoc above an annotation whose string argument
contains a closing parenthesis (a `@Formula` subquery) is not read, so the field would be described
by its name.

A derived multilingual name is two formula attributes, `<x>` and `<x>I18n` (a JSON-typed
`Map<String, String>` over the source column), and both are declared in every view that shows the
name. The generated list and detail DTOs then carry `@I18nTrans(source = "<x>I18n")` on the name and
the hidden map beside it; the search field points at the base column, which is the one a pattern
operator can run on.

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

# Past the version gate
yo simplix:generate CmsContent --skip-version-check
```

One entity per run: the command takes a single entity argument, so several entities are generated by one run each. The version gate is described in `../generator/commands.md` § `yo simplix:version`.

Without `--force`, a file already present in `generated/` is skipped, so a render left from an earlier
run is not refreshed. Generate with `--force` before every promote.

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