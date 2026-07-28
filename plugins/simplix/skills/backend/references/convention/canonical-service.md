# Canonical Service

The generator produces this shape. Manual services must match it.

> **Scope (canonical):** class-level annotation order, constructor with `super(repository, entityManager)`, all required method signatures, `@Transactional` placement, ID-mismatch check, search method pair, `saveAndGetProjection` private helper. For non-CRUD services, see `non-crud-controller.md` (service section).

---

## Full Example

```java
@Service                                                      // class-level: @Service → @Transactional(readOnly = true) → class
@Transactional(readOnly = true)                               // default: reads don't need write tx
public class BuildingService extends SimpliXBaseService<Building, String> {

    private final SiteRepository siteRepository;              // related-entity repos (for FK validation, enrichment)
    private final MessageSource messageSource;                // i18n error messages

    public BuildingService(                                   // invariant 8 — explicit constructor
            BuildingRepository repository,                    //   the entity's own repo
            SiteRepository siteRepository,                    //   related-entity repos (if any)
            EntityManager entityManager,                      //   required by base class
            MessageSource messageSource) {                    //   required for localized exception messages
        super(repository, entityManager);
        this.siteRepository = siteRepository;
        this.messageSource = messageSource;
    }

    @Transactional                                            // writes override readOnly
    public BuildingDetailDTO create(BuildingCreateDTO dto) {
        Building entity = new Building();
        modelMapper.map(dto, entity);                         // ModelMapper is provided by the base class
        return saveAndGetProjection(entity, dto.getSiteId()); // custom private helper (see below)
    }

    @Transactional
    public BuildingDetailDTO update(Building entity, BuildingUpdateDTO dto) {
        if (!Objects.equals(entity.getId(), dto.getId())) {   // ID-mismatch check is MANDATORY on update
            String message = messageSource.getMessage(
                "error.id.cannot.change", null,
                "ID cannot be changed",
                LocaleContextHolder.getLocale());
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, message, null);  // invariant 3
        }
        modelMapper.map(dto, entity);
        return saveAndGetProjection(entity, dto.getSiteId());
    }

    @Transactional
    public void delete(String id) {
        deleteById(id);                                       // base-class helper
    }

    @Transactional
    public void batchDelete(List<String> ids) {
        deleteAllByIds(ids);
    }

    // search(Map) and search(SearchCondition) — REQUIRED to implement in every service.
    // They are NOT provided by the base class because they reference entity-specific DTOs.
    // Controllers call these; URLs hit simpleSearch (GET) or search (POST).
    public Page<BuildingListDTO> search(Map<String, String> params) {
        SearchCondition<BuildingSearchDTO> sc =
            new SearchableParamsParser<BuildingSearchDTO>(BuildingSearchDTO.class).convert(params);
        return findAllWithSearch(sc, BuildingListDTO.class);
    }

    public Page<BuildingListDTO> search(SearchCondition<BuildingSearchDTO> sc) {
        return findAllWithSearch(sc, BuildingListDTO.class);
    }

    // Custom private helper: save entity + FK resolution + return projected DetailDTO.
    // Each service defines its own version because FK handling is entity-specific.
    private BuildingDetailDTO saveAndGetProjection(Building entity, String siteId) {
        if (siteId != null) entity.setSiteId(siteId);
        Building saved = saveAndFlush(entity);                  // base-class helper
        BuildingDetailDTO detail = findById(saved.getId(), BuildingDetailDTO.class)  // projection lookup
            .orElseThrow(() -> new SimpliXGeneralException(
                ErrorCode.GEN_NOT_FOUND, "Failed to retrieve saved entity", null));
        enrichSiteInfo(detail);                                 // optional per-service enrichment
        return detail;
    }

    // multiUpdate / batchUpdate / updateOrder(s) / buildDetailDTO / buildUpdateFormDTO
    // are also REQUIRED when the corresponding controller endpoint is generated.
    // See modules/facility-site/.../BuildingService.java for exact shape.
}
```

---

## Base-class Helpers

Provided by `SimpliXBaseService` / underlying Spring Data. Use these; do not reimplement.

| Helper | Purpose |
|---|---|
| `findById(id)` | `Optional<E>` lookup |
| `findById(id, DTO.class)` | projection lookup — loads and maps to DTO in one step |
| `existsById(id)` | boolean existence check (use in delete) |
| `findAllById(ids)` / `findAll(...)` | bulk lookups |
| `findAllWithSearch(sc, ListDTO.class)` | Searchable JPA search → `Page<ListDTO>` |
| `saveAndFlush(entity)` | save + flush — returns the persisted entity |
| `saveAll(entities)` | bulk save |
| `deleteById(id)` / `deleteAllByIds(ids)` | delete helpers |
| `modelMapper` | field-injected, use for DTO ↔ entity mapping |
| `repository`, `entityManager` | inherited fields |

---

## Required Methods

What the service MUST implement (per entity, NOT inherited):

| Method | When required | Notes |
|---|---|---|
| `create(CreateDTO)` | always | `@Transactional`; typically ends with `saveAndGetProjection(...)` |
| `update(Entity, UpdateDTO)` | always | `@Transactional`; must check ID mismatch → `SimpliXGeneralException(GEN_CONFLICT)` |
| `delete(String)` / `batchDelete(List<String>)` | always | `@Transactional`; delegate to base-class delete helpers |
| `search(Map<String,String>)` | always | parse with `SearchableParamsParser`, delegate to `findAllWithSearch` |
| `search(SearchCondition<SearchDTO>)` | always | delegate to `findAllWithSearch` |
| `multiUpdate(Set<UpdateDTO>)` | when `PATCH /` endpoint exists | iterates and calls `update` |
| `batchUpdate(BatchUpdateDTO)` | when `PATCH /batch` endpoint exists | null-guarded field application + `saveAll` |
| `updateOrder` / `updateOrders` | when entity has `displayOrder` | `@Transactional`; sets `displayOrder` via `saveAndGetProjection` |
| `buildDetailDTO(id)` | **only when enrichment needed** | wraps `findById(id, DetailDTO.class)` + custom enrichment. When the entity has no post-load enrichment, the controller calls `service.findById(id, DetailDTO.class)` directly (generator default — see `EntityRestController.java.template`). Do NOT add this wrapper as boilerplate. |
| `buildUpdateFormDTO(id)` | **only when enrichment needed** | same rule as above — base helper is called directly from the controller unless enrichment is required |
| `saveAndGetProjection(entity, fkId)` | always (private helper) | save + FK resolution + projection lookup; called by create/update/updateOrder |