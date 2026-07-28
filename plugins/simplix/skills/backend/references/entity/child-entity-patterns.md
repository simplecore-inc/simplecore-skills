# Child Entity Internalization Pattern

When a child entity should NOT be exposed as a separate REST API, internalize it into the parent entity's CRUD operations.

## When to Apply

- Child entity only makes sense within parent context
- Child has a hard upper limit (e.g., max 12 intervals per schedule)
- Client always manages children through the parent editor UI
- No independent search/listing use case for the child

**Typical pairs:** `Schedule → ScheduleInterval`, `DevicePreset → DevicePresetFunction`. Any parent-child pair with no independent API need follows the same pattern.

## Mandatory Rules

- Child CRUD is handled entirely within the parent's Service. Do **not** create a separate `ChildService` or `ChildRestController`.
- Parent Service injects `ChildRepository` directly.
- **Update uses the reconcile pattern** (diff-based), not full-replace. Full-replace churns entity events unnecessarily — diff-based writes only what changed.
- DTO semantics for update:
  - `children == null` → "no change" (do nothing)
  - `children == []` → "delete all children"
  - `children == [...]` → reconcile against current set
- Parent delete → child delete first (cascade at service level, not JPA level — keeps event emission under your control).
- Use `buildDetailDTO()` for manual composition of nested child lists. SimpliX projection does **not** auto-populate nested lists.

## What Gets Kept / Deleted

| Artifact | Kept | Deleted |
|---|---|---|
| Child entity class | ☑ | |
| ChildRepository | ☑ | |
| Child i18n keys | ☑ | |
| SyncUnitTableMapping entry | ☑ | |
| ChildRestController | | ☒ |
| ChildService | | ☒ |
| ChildServiceTest | | ☒ |
| `.simplix/entity/Child.yml` | | ☒ |

## Reference Implementation: DevicePreset -> DevicePresetFunction

**Files:**
- Service: `modules/facility-config/src/main/java/{basePackage}/web/facility/device/service/DevicePresetService.java`
- DTOs: `modules/facility-config/src/main/java/{basePackage}/web/facility/device/dto/DevicePresetDTOs.java`
- Controller: `modules/facility-config/src/main/java/{basePackage}/web/facility/device/controller/DevicePresetRestController.java`

## DTO Structure

### Input DTO (ItemDTO pattern)

Child input uses a single DTO for both create and update, distinguished by `id`:

```java
@Data
public static class ChildItemDTO {
    @Schema(description = "ID (null for new items)")
    private String id;           // null = create, non-null = update

    @NotNull
    private Integer someField;
    // ... child-specific fields only
    // NO parentId — comes from parent context
}
```

- NO `scheduleId` / `parentId` field — parent sets it from its own context
- NO audit fields (createdBy, updatedAt, etc.)

### Response DTO (DetailDTO pattern)

```java
@Data
public static class ChildDetailDTO {
    private String id;
    private Integer someField;
    // ... child-specific fields only
    // NO parentId, NO parent reference, NO audit fields
}
```

### Parent DTOs

```java
// Parent CreateDTO — include @Valid child list
@Data
public static class ParentCreateDTO {
    // ... parent fields ...
    @Valid
    private List<ChildItemDTO> children;
}

// Parent UpdateDTO — inherits children from CreateDTO
@Data
public static class ParentUpdateDTO extends ParentCreateDTO {
    @NotBlank private String id;
}

// Parent DetailDTO — include child detail list
@Data
public static class ParentDetailDTO {
    // ... parent fields ...
    private List<ChildDetailDTO> children;
}

// Parent ListDTO — NO children (list view doesn't need them)
@Data
public static class ParentListDTO {
    // ... parent fields only ...
}
```

## Service Pattern

### Constructor — inject child repository

```java
public ParentService(
    ParentRepository repository,
    ChildRepository childRepository,   // <-- direct repository injection
    EntityManager entityManager,
    MessageSource messageSource
) {
    super(repository, entityManager);
    this.childRepository = childRepository;
    this.messageSource = messageSource;
}
```

No separate ChildService needed — parent service uses child repository directly.

### Create — save parent, then children

```java
@Transactional
public ParentDetailDTO create(ParentCreateDTO createDTO) {
    Parent entity = new Parent();
    modelMapper.map(createDTO, entity);
    Parent saved = saveAndFlush(entity);

    if (createDTO.getChildren() != null) {
        // optional: validate children (count limit, field constraints)
        for (ChildItemDTO item : createDTO.getChildren()) {
            Child child = new Child();
            modelMapper.map(item, child);
            child.setId(null);
            child.setParentId(saved.getId());
            childRepository.save(child);
        }
        childRepository.flush();
    }

    return buildDetailDTO(saved.getId());
}
```

### Update — reconcile pattern (diff-based)

```java
@Transactional
public ParentDetailDTO update(Parent entity, ParentUpdateDTO updateDto) {
    // ... ID check, map parent fields ...
    Parent saved = saveAndFlush(entity);

    if (updateDto.getChildren() != null) {
        reconcileChildren(saved.getId(), updateDto.getChildren());
    }
    // null children list = no change to children (parent-only update)

    return buildDetailDTO(saved.getId());
}
```

Reconcile logic:

```java
private void reconcileChildren(String parentId, List<ChildItemDTO> items) {
    List<Child> existing = childRepository.findByParentId(parentId);
    Map<String, Child> existingMap = existing.stream()
            .collect(Collectors.toMap(Child::getId, Function.identity()));

    for (ChildItemDTO item : items) {
        if (item.getId() == null) {
            // New child
            Child newChild = new Child();
            modelMapper.map(item, newChild);
            newChild.setId(null);
            newChild.setParentId(parentId);
            childRepository.save(newChild);
        } else {
            // Update existing
            Child ex = existingMap.remove(item.getId());
            if (ex != null) {
                modelMapper.map(item, ex);
                ex.setParentId(parentId);
                childRepository.save(ex);
            }
        }
    }

    // Delete orphans
    if (!existingMap.isEmpty()) {
        childRepository.deleteAll(existingMap.values());
    }

    childRepository.flush();
}
```

**Key semantics:**
- `children == null` → no change (parent-only update)
- `children == []` → delete all children
- `children == [...]` → reconcile (create/update/delete-orphans)

### Delete — cascade children first

```java
@Transactional
public void delete(String id) {
    childRepository.deleteByParentId(id);
    deleteById(id);
}

@Transactional
public void batchDelete(List<String> ids) {
    for (String id : ids) {
        childRepository.deleteByParentId(id);
    }
    deleteAllByIds(ids);
}
```

### Projection — manual composition (buildDetailDTO)

SimpliXBaseService `findById(id, DtoClass.class)` does NOT auto-populate nested lists.
Manual composition is required:

```java
public ParentDetailDTO buildDetailDTO(String parentId) {
    ParentDetailDTO detail = findById(parentId, ParentDetailDTO.class)
            .orElseThrow(() -> new SimpliXGeneralException(
                    ErrorCode.GEN_NOT_FOUND, "Failed to retrieve saved entity", null));

    List<Child> children = childRepository.findByParentId(parentId);
    detail.setChildren(children.stream()
            .map(c -> modelMapper.map(c, ChildDetailDTO.class))
            .collect(Collectors.toList()));

    return detail;
}
```

### Controller — use buildDetailDTO for GET

```java
@GetMapping("/{id}")
public SimpliXApiResponse<ParentDetailDTO> get(@PathVariable String id) {
    if (!service.existsById(id)) {
        return SimpliXApiResponse.failure(null, "Parent not found");
    }
    return SimpliXApiResponse.success(service.buildDetailDTO(id));
}
```

## Repository Requirements

Child repository must have:

```java
public interface ChildRepository extends SimpliXBaseRepository<Child, String> {
    List<Child> findByParentId(String parentId);
    void deleteByParentId(String parentId);
}
```

## Cleanup Checklist

When internalizing a previously independent child entity:

| Item | Action |
|------|--------|
| ChildRestController | DELETE |
| ChildService | DELETE |
| ChildServiceTest | DELETE |
| `.simplix/entity/Child.yml` | DELETE (prevent re-generation) |
| ChildDTOs | Reduce to ItemDTO + DetailDTO only |
| ChildRepository | KEEP (used by parent service + sync mappers) |
| Child entity | KEEP (no changes) |
| i18n message keys | KEEP (used by @FieldLabel) |
| SyncUnitTableMapping | KEEP (sync pipeline) |
| DataMapper (e.g. SU11DataMapper) | KEEP (uses repository directly) |
| Permission strings | Merge into parent permission |

## Entity Event Considerations

- `@EntityEventConfig` on child entity remains active
- `deleteByParentId()` (Spring Data derived query) loads entities then deletes individually,
  so JPA lifecycle events ARE triggered
- `deleteAll(collection)` also triggers events per entity
- Reconcile pattern is preferred over full-replace to minimize unnecessary event churn
