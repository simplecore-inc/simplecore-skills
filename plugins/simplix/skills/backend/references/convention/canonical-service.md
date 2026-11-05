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
    private final MessageSource messageSource;                // a message that carries arguments (invariant 3)

    public BuildingService(                                   // invariant 8 - explicit constructor
            BuildingRepository repository,                    //   the entity's own repo
            SiteRepository siteRepository,                    //   related-entity repos (if any)
            EntityManager entityManager,                      //   required by base class
            MessageSource messageSource) {                    //   resolves a message with arguments at throw time
        super(repository, entityManager);
        this.siteRepository = siteRepository;
        this.messageSource = messageSource;
    }

    @Transactional                                            // writes override readOnly
    public BuildingDetailDTO create(BuildingCreateDTO dto) {
        Building entity = new Building();
        modelMapper.map(dto, entity);                         // the project's mapper skips fields the request leaves out, so entity defaults survive (runtime-behaviour.md)
        return saveAndGetProjection(entity, dto.getSiteId()); // custom private helper (see below)
    }

    @Transactional
    public BuildingDetailDTO update(Building entity, BuildingUpdateDTO dto) {
        if (!Objects.equals(entity.getId(), dto.getBuildingId())) {   // ID-mismatch check is MANDATORY on update
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT,
                "{error.<domain>.idCannotChange}", null);  // invariant 3 - a placeholder, resolved at the HTTP layer
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

    // search(Map) and search(SearchCondition) - REQUIRED to implement in every service.
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
                ErrorCode.GEN_NOT_FOUND, "{error.<domain>.savedEntityNotFound}", null));
        enrichSiteInfo(detail);                                 // optional per-service enrichment
        return detail;
    }

    // multiUpdate / batchUpdate / updateOrder(s) are also REQUIRED when the corresponding
    // controller endpoint is generated; their exact shape is the project's
    // .simplix/templates/service/EntityService.java.template.
}
```

---

## Base-class Helpers

Provided by `SimpliXBaseService` / underlying Spring Data. Use these; do not reimplement.

| Helper | Purpose |
|---|---|
| `findById(id)` | `Optional<E>` lookup |
| `findById(id, DTO.class)` | projection lookup - loads and maps to DTO in one step |
| `existsById(id)` | boolean existence check (use in delete) |
| `findAllById(ids)` / `findAll(...)` | bulk lookups |
| `findAllWithSearch(sc, ListDTO.class)` | Searchable JPA search → `Page<ListDTO>` |
| `saveAndFlush(entity)` | save + flush - returns the persisted entity |
| `saveAll(entities)` | bulk save |
| `deleteById(id)` / `deleteAllByIds(ids)` | delete helpers |
| `modelMapper` | field-injected, use for DTO ↔ entity mapping |
| `repository`, `entityManager` | inherited fields |

---

## Required Methods

What the service MUST implement (per entity, NOT inherited):

| Method | When required | Notes |
|---|---|---|
| `create(CreateDTO)` | always | `@Transactional`; typically ends with `saveAndGetProjection(...)`. Never defaults a field here: the project's mapper keeps the entity default for a field the request omits (`framework/runtime-behaviour.md` § A create request overwrites the entity's defaults with null) |
| `update(Entity, UpdateDTO)` | always | `@Transactional`; must check ID mismatch → `SimpliXGeneralException(GEN_CONFLICT)` |
| `delete(String)` / `batchDelete(List<String>)` | always | `@Transactional`; delegate to base-class delete helpers |
| `search(Map<String,String>)` | always | parse with `SearchableParamsParser`, delegate to `findAllWithSearch` |
| `search(SearchCondition<SearchDTO>)` | always | delegate to `findAllWithSearch` |
| `multiUpdate(Set<UpdateDTO>)` | when `PATCH /` endpoint exists | iterates and calls `update` |
| `batchUpdate(BatchUpdateDTO)` | when `PATCH /batch` endpoint exists | null-guarded field application + `saveAll` |
| `updateOrder` / `updateOrders` | when entity has `displayOrder` | `@Transactional`; sets `displayOrder` via `saveAndGetProjection` |
| `buildDetailDTO(id)` | **only when enrichment needed** | wraps `findById(id, DetailDTO.class)` + custom enrichment. When the entity has no post-load enrichment, the controller calls `service.findById(id, DetailDTO.class)` directly (generator default - see `EntityRestController.java.template`). Do NOT add this wrapper as boilerplate. |
| `buildUpdateFormDTO(id)` | **only when enrichment needed** | same rule as above - base helper is called directly from the controller unless enrichment is required |
| `saveAndGetProjection(entity, fkId)` | always (private helper) | save + FK resolution + projection lookup; called by create/update/updateOrder |

---

## Hand-written Results

A search override that answers early, and a row assembled by hand, leave the generated shape; the audit checks both.

- **An empty page carries the request it answers**: `new PageImpl<>(List.of(), pageRequest, 0)`, never `new PageImpl<>(List.of())`. The one-argument form holds `Pageable.unpaged()`, whose `getPageNumber()` / `getPageSize()` throw when the response is serialized, so the caller gets a 500 on the branch a new account takes first. Audit: `empty-page-with-no-pageable`.
- **A row built by hand copies every field the source and the DTO both declare** (`Dto row = new Dto(); row.setX(src.getX()); ... return row;`). Prefer the projection (`findById(id, DTO.class)`, `findAllWithSearch`) wherever it can express the row: a hand-written mapper is the one place a field added to the entity does not reach. Audit: `hand-written-row-drops-a-field` (review level).
---

## A Record a Webhook Reads Commits Before the Call That Triggers It

A command that writes a record and then calls an external service whose webhook reads that record
(a payment provider's price change, whose payment event looks up what the raise grants) commits the
record in its own transaction **before** the call. Inside one `@Transactional` method the record
commits only after the method returns, so the webhook can be processed first and find nothing; the
processor then either fails every retry until the provider gives up, or, once it treats "no record"
as an outside change, misfiles a portal command as one.

- **Shape**: the command method is `@Transactional(propagation = Propagation.NOT_SUPPORTED)` and runs
  its steps through a `TransactionTemplate` built from the `PlatformTransactionManager`: one
  transaction loads, checks and writes the record; the external call runs outside any transaction;
  a second transaction reloads the row by id and applies what the provider accepted. The precedent
  for the external call between two short transactions is any relay service that holds, calls a
  provider, and confirms.
- **Not `REQUIRES_NEW` on a held entity.** A `BaseEntity` carries `@Version`: a `REQUIRES_NEW` bean
  method that writes the row while the outer transaction still holds it bumps the version, and the
  outer save fails with an optimistic lock exception at commit.
- **A refused call takes the record back** in a third transaction, guarded so that a record a
  webhook has already consumed is left alone; catch the framework's exception type, not a blanket
  `RuntimeException`.
- **Test the order, not the outcome**: a `PlatformTransactionManager` stub
  (`AbstractPlatformTransactionManager` with no-op `doBegin`) whose `doCommit` notes how many
  external calls had been made and what the saved row held. A single-transaction version commits
  once, after the call, and fails it.
