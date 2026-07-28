# Entity to DTO Mapping

Field-type conversion rules for translating entity field declarations into DTO field declarations.

> **Scope (canonical):** (1) entity-type → DTO-type conversion (primitive ↔ wrapper, relationship collapsing, special types) and (2) which entity fields appear in which DTO types. For annotation-level rules (validation, i18n, references, searchable), see the siblings — each is listed beside the concern it owns.

## Contents

- [Primitive → Wrapper](#primitive--wrapper)
- [Standard Types](#standard-types)
- [Relationship Handling](#relationship-handling)
- [i18n Pair Handling](#i18n-pair-handling)
- [Tree-Entity Fields](#tree-entity-fields)
- [Soft-Delete Fields](#soft-delete-fields)
- [Which Entity Fields Go Where](#which-entity-fields-go-where)

## Primitive → Wrapper

DTO fields use **wrapper types**, never primitives. Primitives have two problems: (a) they can't be null, breaking "unchanged" semantics in BatchUpdate and partial updates, and (b) `boolean` generates `isField()` getters, which the SimpliX framework does not recognize (it expects `getField()`).

| Entity | DTO |
|---|---|
| `boolean` | `Boolean` |
| `int` | `Integer` |
| `long` | `Long` |
| `double` | `Double` |
| `float` | `Float` |
| `short` | `Short` |
| `byte` | `Byte` |

## Standard Types

Carry over unchanged:

| Type | Notes |
|---|---|
| `String` | straight copy |
| `Instant`, `LocalDate`, `LocalDateTime`, `OffsetDateTime` | straight copy; UpdateFormDTO adds `@DateTimeFormat` on audit fields |
| `BigDecimal`, `BigInteger` | straight copy |
| `Enum` | same enum type (SimpliX resolves labels via `LabeledEnum`) |
| `Map<String, String>` | used for i18n pairs — see [i18n Pair Handling](#i18n-pair-handling) |

## Relationship Handling

The shape of a relationship changes depending on the DTO's intent (write vs read).

| Entity declaration | SearchDTO (filter) | CreateDTO (write) | UpdateFormDTO (form display) | DetailDTO / ListDTO (read) |
|---|---|---|---|---|
| `@ManyToOne Entity ref` | `String refId` with `@SearchableField(entityField = "ref.refId")` | `String refId` | **Full** `Entity ref` with `@JsonIncludeProperties({...})` — needed for dropdown pre-selection | **Full** `Entity ref` with `@JsonIncludeProperties({...})` |
| `@ManyToMany Set<Entity> items` | `Set<String> itemIds` with `@SearchableField(entityField = "items.itemId")` | **exclude** — managed via a separate REST endpoint | **exclude** | full `Set<Entity>` (or `@JsonIncludeProperties`-filtered) |
| `@OneToMany List<Entity> children` | skip | skip | skip | include only if the listing truly needs it; tree children handled specially (below) |

Detail → `reference-field-patterns.md` (FK dual-field pattern `refId` + `ref`, `@JsonIncludeProperties` field selection, self-reference for trees, why `@ManyToMany` goes through a separate API).

For `@SearchableField` entityField path rules → `searchable-field-patterns.md`.

## i18n Pair Handling

When an entity field has a companion `*I18n` Map, the DTO treatment depends on direction.

Entity pattern:

```java
private String name;                      // default-locale value
private Map<String, String> nameI18n;     // per-locale values
```

| DTO | `name` field | `nameI18n` field |
|---|---|---|
| SearchDTO | searchable against the base entity field | skip (Map searching is not supported via `@SearchableField`) |
| CreateDTO / UpdateDTO | include, with validation annotations | include, no validation |
| UpdateFormDTO | inherited from UpdateDTO | inherited |
| DetailDTO / ListDTO | `@I18nTrans(source = "nameI18n")` — resolved to caller's locale | `@JsonIgnore` (hide Map from response) |

Detail → `i18n-field-patterns.md` (nested-object pattern, `@I18nTrans` resolution order, repeatable annotation for multiple i18n fields).

## Tree-Entity Fields

When the entity implements `TreeEntity<Self>` or has `@ManyToOne private Self parent;`:

| Entity field | SearchDTO | CreateDTO | UpdateFormDTO | DetailDTO | ListDTO |
|---|---|---|---|---|---|
| `Self parent` | skip | `String parentId` | `String parentId` | `String parentId` | `String parentId` |
| `Set<Self> children` | skip | skip | skip | skip | **`List<Self>ListDTO>` children** (auto-resolved) |
| `Integer depth` | searchable | skip (calculated) | include for display | include | include |
| `String path` | searchable | skip (calculated) | include for display | include | include |

Detail → `reference-field-patterns.md` (self-reference section).

## Soft-Delete Fields

Entities opt into soft delete by implementing `SoftDeletable` and declaring `deleted`, `deletedAt` (or `deletedTimestamp`).

- Excluded from every DTO type that takes user input (Create, Update, UpdateForm, OrderUpdate). The framework manages these fields.
- BatchUpdateDTO may include them when the admin action "bulk soft-delete" is exposed — treat as a privileged exception.
- `@UniqueField(softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)` on CreateDTO signals that uniqueness ignores soft-deleted rows — see `validation-patterns.md`.

## Which Entity Fields Go Where

At-a-glance: for each entity-field kind, which DTO types include it.

| Entity field kind | Search | Create | Update | UpdateForm | BatchUpdate | Detail | List |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| PK (`id`) | ☑ | ☒ | ☑ | ☑ | ☒ (Set of IDs instead) | ☑ | ☑ |
| required String/number/enum | ☑ | ☑ (+ validation) | ☑ | ☑ | optional subset | ☑ | ☑ |
| optional `Boolean` | ☑ | ☑ | ☑ | ☑ | common | ☑ | ☑ |
| `@ManyToOne` → `refId` | ☑ | ☑ | ☑ | full entity | rarely | full entity | full entity |
| `@ManyToMany` | ☑ (as IDs) | ☒ | ☒ | ☒ | ☒ | full set | full set |
| `@OneToMany` | ☒ | ☒ | ☒ | ☒ | ☒ | case-by-case | case-by-case |
| i18n base | ☑ | ☑ | ☑ | ☑ | rarely | `@I18nTrans` | `@I18nTrans` |
| i18n `Map` | ☒ | ☑ | ☑ | ☑ | ☒ | `@JsonIgnore` | `@JsonIgnore` |
| audit (`createdAt/By`, `updatedAt/By`) | ☑ (searchable) | ☒ | ☒ | ☑ (display) | ☒ | ☑ | ☑ |
| tree `children` | ☒ | ☒ | ☒ | ☒ | ☒ | ☒ | ☑ (tree entity) |
| tree `depth` / `path` | ☑ | ☒ | ☒ | ☑ | ☒ | ☑ | ☑ |
| soft-delete (`deleted`, `deletedAt`) | ☑ | ☒ | ☒ | ☒ | privileged | usually ☒ | usually ☒ |

Validation annotations, `@FieldLabel`, `@Schema`, `@SearchableField`, `@JsonIncludeProperties`, `@I18nTrans`/`@JsonIgnore` pairs are **not** in this table — each is owned by its specialist file.

## See Also

- For entity-side relationship declarations (`@ManyToOne`, `@ManyToMany`, cascade rules), see `../entity/relationship-patterns.md`
- For `@JsonIncludeProperties` FK rendering rules, see `reference-field-patterns.md`
