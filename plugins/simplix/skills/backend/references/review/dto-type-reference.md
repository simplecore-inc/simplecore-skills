# DTO Type Reference

Role and shape of each of the 8 DTO types. Use this as a **router** — it tells you which DTO type you need and where the detailed rules live. Do not treat this file as authoritative for annotation-level rules.

> **Scope (canonical):** when to include each DTO type, its Lombok shape, inheritance, and what concerns go into it. For deep rules, follow the pointer at the end of each section. For actual field-by-field entity → DTO mapping, see `entity-to-dto-mapping.md`.

## Contents

- [Overview](#overview)
- [1. SearchDTO](#1-searchdto)
- [2. CreateDTO](#2-createdto)
- [3. UpdateDTO](#3-updatedto)
- [4. UpdateFormDTO](#4-updateformdto)
- [5. BatchUpdateDTO](#5-batchupdatedto)
- [6. DetailDTO](#6-detaildto)
- [7. ListDTO](#7-listdto)
- [8. OrderUpdateDTO](#8-orderupdatedto)
- [Summary Table](#summary-table)
- [Which DTO Types Does My Entity Need?](#which-dto-types-does-my-entity-need)

## Overview

```
Input (write) side                   Output (read) side
  CreateDTO                            DetailDTO
   └─ UpdateDTO       (extends)         │
       └─ UpdateFormDTO (extends)       ListDTO  (+ children for tree)
  BatchUpdateDTO     (standalone)
  OrderUpdateDTO     (standalone)
  SearchDTO          (standalone)     (paired with ListDTO via findAllWithSearch)
```

All eight are **static inner classes** of `{Entity}DTOs`. A SimpliX-generated CRUD module always has Search/Create/Update/UpdateForm/Detail/List; BatchUpdate/OrderUpdate are conditional (see [Which DTO Types Does My Entity Need?](#which-dto-types-does-my-entity-need)).

---

## 1. SearchDTO

**Role:** filter + sort parameters for `GET /search` and `POST /search` endpoints.

- **Lombok:** `@Getter @Setter` (NOT `@Data` — equals/hashCode is wasteful here)
- **Extends:** nothing
- **Required annotations per field:** `@Schema`, `@FieldLabel`, `@SearchableField`
- **No validation annotations** — search inputs are permissive by design

Detail → `searchable-field-patterns.md` (entityField paths, operator choice by type, URL parameter format, 20 operators).

---

## 2. CreateDTO

**Role:** payload for `POST /create`. Contains all user-editable fields for a new entity.

- **Lombok:** `@Data`
- **Extends:** nothing
- **Required annotations per field:** `@Schema`, `@FieldLabel`, validation annotations
- **Class-level validation:** `@UniqueFields` / `@UniqueComposites` when the entity has unique constraints; always declare with `idField` / `idProperty` so the UpdateDTO (extending CreateDTO) can participate in the uniqueness check
- **Excluded:** primary key (server-assigned), audit fields, `deleted` / `deletedTimestamp`

Detail → `validation-patterns.md` (every validation annotation, `@UniqueFields` vs `@UniqueComposites`, soft-delete-aware constraints, CreateDTO/UpdateDTO inheritance for uniqueness). Field-type decisions → `entity-to-dto-mapping.md`.

---

## 3. UpdateDTO

**Role:** payload for `PUT /{id}`, `PATCH /` (multiUpdate). Adds the ID to CreateDTO's fields.

- **Lombok:** `@Data @EqualsAndHashCode(callSuper = true)`
- **Extends:** `CreateDTO`
- **Adds:** ID field with `@NotBlank(message = "ID is required")` — or `@NotNull` for non-String composite IDs

Detail → `validation-patterns.md` (ID field patterns, composite-ID support, how `@UniqueFields` defined on CreateDTO flows through inheritance).

---

## 4. UpdateFormDTO

**Role:** payload for `GET /{id}/edit` — same shape as UpdateDTO plus read-only audit fields so the form can display "created by X at Y".

- **Lombok:** `@Data @EqualsAndHashCode(callSuper = true)`
- **Extends:** `UpdateDTO`
- **Adds:** `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, each with `@DateTimeFormat(pattern = "yyyy-MM-dd HH:mm")` on `Instant` fields

No validation is added at this layer (inherits from UpdateDTO). The audit fields are display-only; the server ignores them on write.

---

## 5. BatchUpdateDTO

**Role:** payload for `PATCH /batch` — apply a partial set of field changes to many entities at once.

- **Lombok:** `@Data`
- **Extends:** nothing
- **Fields:** `Set<String> entityIds` (the target list) + a **subset** of updatable fields
- **All fields nullable by design** — a null field means "don't change this field". No `@NotNull` / `@NotBlank`.

Include a field only if bulk-updating it makes sense: status, active flags, sort order. Exclude unique-valued fields (code, name), references, and anything that would break uniqueness when applied identically to many rows.

---

## 6. DetailDTO

**Role:** response body for `POST /create`, `PUT /{id}`, `GET /{id}`. Full single-entity view.

- **Lombok:** `@Data`
- **Extends:** nothing
- **Entity references:** keep the entity type, restrict exposed fields with `@JsonIncludeProperties({"refId", "refName"})`. Never replace the entity field with a bare ID string.
- **i18n fields:** direct field with `@I18nTrans(source = "xxxI18n")` + the Map field with `@JsonIgnore`
- **Audit fields:** included

Detail → `reference-field-patterns.md` (`@JsonIncludeProperties` rules, FK vs object field decisions, `@ManyToOne` / `@ManyToMany` mapping). i18n detail → `i18n-field-patterns.md`.

---

## 7. ListDTO

**Role:** response body for `GET /search` / `POST /search` (paged list rows).

- **Lombok:** `@Data`
- **Extends:** nothing
- **Shape:** same annotations as DetailDTO, typically a slimmer field subset
- **Tree entities:** add `private List<{Self}ListDTO> children;` — enables hierarchical rendering

Tree detection (add `children` field when any of these hold):

- Entity `implements TreeEntity<Self>`
- Entity has `@ManyToOne private Self parent;`
- Entity has `depth` or `path` fields

---

## 8. OrderUpdateDTO

**Role:** payload for `PATCH /order` — only for entities with a sort-order field.

- **Lombok:** `@Data`
- **Extends:** nothing
- **Fields:** ID (`@NotBlank(message = "ID is required")`) + order value (`@NotNull`)
- **Include when** the entity has one of: `sortOrder`, `displayOrder`, `orderIndex`

The controller receives `List<OrderUpdateDTO>` and the service applies changes per ID.

---

## Summary Table

| DTO | Lombok | Extends | Purpose | Always generated? |
|---|---|---|---|---|
| SearchDTO | `@Getter @Setter` | — | filter/sort params | ☑ |
| CreateDTO | `@Data` | — | create payload | ☑ |
| UpdateDTO | `@Data @EqualsAndHashCode(callSuper=true)` | CreateDTO | update payload (+ ID) | ☑ |
| UpdateFormDTO | `@Data @EqualsAndHashCode(callSuper=true)` | UpdateDTO | edit form (+ audit display) | ☑ |
| BatchUpdateDTO | `@Data` | — | bulk partial update | conditional |
| DetailDTO | `@Data` | — | single-entity response | ☑ |
| ListDTO | `@Data` | — | paged list row | ☑ |
| OrderUpdateDTO | `@Data` | — | reorder | only if entity has order field |

---

## Which DTO Types Does My Entity Need?

- **Always:** SearchDTO, CreateDTO, UpdateDTO, UpdateFormDTO, DetailDTO, ListDTO (six)
- **Add BatchUpdateDTO** if the module exposes `PATCH /batch`. Choose subset fields per the guidance in [§5](#5-batchupdatedto).
- **Add OrderUpdateDTO** only when the entity has `sortOrder` / `displayOrder` / `orderIndex`.
- **Add `children` field to ListDTO** when the entity is a tree ([§7](#7-listdto)).

The generator infers these from `.simplix/entity/{Entity}.yml` — see `../entity/yml-configuration.md` for the YML keys that drive each choice.
