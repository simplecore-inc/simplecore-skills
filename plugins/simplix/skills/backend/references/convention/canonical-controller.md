# Canonical Controller

The generator produces this shape. Manual controllers must match it. **11 standard endpoints.** Each endpoint has `@Operation` and `@PreAuthorize` — mandatory per invariants 2 and 11. Note the SimpliX URL convention: **`POST /create`** (not `POST /`).

> **Single source of truth:** The authoritative definition is the generator template at `.simplix/templates/controller/rest/EntityRestController.java.template`. This file mirrors it. **When template and doc diverge, the template wins** — update the doc, not the template-generated output. The endpoint order, `@Operation` wording, and method signatures below were derived from the template verbatim (examples just substitute `Building` for the entity name).

> **Scope (canonical):** class-level annotation order, constructor with `super(service)`, all 11 endpoint signatures with response wrapper, permission wording, `@Validated` placement. For non-CRUD controllers, see `non-crud-controller.md`.

---

## Full Example

```java
@RestController                                              // rule: class-level annotation order
@RequestMapping("/building")                                 //   @RestController → @RequestMapping → @Tag → class
@Tag(name = "facility.spatial.Building",                         // invariant 10 — domain-based namespace
     description = "Building within a site. Host-only")
public class BuildingRestController
        extends SimpliXBaseController<Building, String> {    // ID type = String (UUID v7)

    private final BuildingService service;

    public BuildingRestController(BuildingService service) { // invariant 8 — explicit constructor, super()
        super(service);
        this.service = service;
    }

    //---------------------------------- Create
    @PostMapping("/create")
    @Operation(summary = "Create Building", description = "Creates a new Building")
    @PreAuthorize("hasPermission('Building', 'create')")     // invariant 2, 9 — PascalCase class name
    public SimpliXApiResponse<BuildingDetailDTO> create(     // invariant 1 — SimpliXApiResponse
            @RequestBody @Validated BuildingCreateDTO dto) { // invariant 12 — @Validated on body
        return SimpliXApiResponse.success(service.create(dto));
    }

    //---------------------------------- Update (single)
    @PutMapping("/{id}")
    @Operation(summary = "Update Building",
            description = "Updates existing Building")
    @PreAuthorize("hasPermission('Building', 'edit')")
    public SimpliXApiResponse<BuildingDetailDTO> update(
            @PathVariable String id,
            @RequestBody @Validated BuildingUpdateDTO dto) {
        return service.findById(id)                          // existence-check pattern for update
                .map(entity -> SimpliXApiResponse.success(service.update(entity, dto)))
                .orElse(SimpliXApiResponse.failure(null, "Building not found"));
    }

    //---------------------------------- Update (multi, body contains updates for multiple)
    @PatchMapping
    @Operation(summary = "Update Multiple Building",
            description = "Updates multiple existing Building")
    @PreAuthorize("hasPermission('Building', 'edit')")
    public SimpliXApiResponse<List<BuildingDetailDTO>> multiUpdate(
            @RequestBody Set<BuildingUpdateDTO> dtos) {      // no @Validated on Set; validation runs per element
        return SimpliXApiResponse.success(service.multiUpdate(dtos));
    }

    //---------------------------------- Delete
    @DeleteMapping("/{id}")
    @Operation(summary = "Delete Building",
            description = "Deletes Building by ID")
    @PreAuthorize("hasPermission('Building', 'delete')")
    public SimpliXApiResponse<Void> delete(@PathVariable String id) {
        if (!service.existsById(id)) {                       // existence-check pattern for delete
            return SimpliXApiResponse.failure(null, "Building not found");
        }
        service.delete(id);
        return SimpliXApiResponse.success(null, "Building deleted successfully");
    }

    //---------------------------------- Get (generator default: direct base-helper call)
    @GetMapping("/{id}")
    @Operation(summary = "Get Building",
            description = "Retrieves Building by ID")
    @PreAuthorize("hasPermission('Building', 'view')")
    public SimpliXApiResponse<BuildingDetailDTO> get(@PathVariable String id) {
        return service.findById(id, BuildingDetailDTO.class)
                .map(SimpliXApiResponse::success)
                .orElse(SimpliXApiResponse.failure(null, "Building not found"));
        // If post-load enrichment is required, replace with: service.buildDetailDTO(id)
    }

    //---------------------------------- Update form (Detail + editable audit fields)
    @GetMapping("/{id}/edit")
    @Operation(summary = "Get Building for Update",
            description = "Retrieves Building by ID for update purposes")
    @PreAuthorize("hasPermission('Building', 'view')")
    public SimpliXApiResponse<BuildingUpdateFormDTO> updateForm(@PathVariable String id) {
        return service.findById(id, BuildingUpdateFormDTO.class)
                .map(SimpliXApiResponse::success)
                .orElse(SimpliXApiResponse.failure(null, "Building not found"));
        // If post-load enrichment is required, replace with: service.buildUpdateFormDTO(id)
    }

    //---------------------------------- Batch update (single field change on many)
    @PatchMapping("/batch")
    @Operation(summary = "Batch Update Buildings",
            description = "Updates multiple Buildings")
    @PreAuthorize("hasPermission('Building', 'edit')")
    public SimpliXApiResponse<Void> batchUpdate(
            @RequestBody @Validated BuildingBatchUpdateDTO dto) {
        service.batchUpdate(dto);
        return SimpliXApiResponse.success(null, "Buildings updated successfully");
    }

    //---------------------------------- Batch delete
    @DeleteMapping("/batch")
    @Operation(summary = "Delete multiple Buildings",
            description = "Deletes multiple Buildings by their IDs")
    @PreAuthorize("hasPermission('Building', 'delete')")
    public SimpliXApiResponse<Void> batchDelete(@RequestParam List<String> ids) {
        service.batchDelete(ids);
        return SimpliXApiResponse.success(null, "Buildings deleted successfully");
    }

    //---------------------------------- Order update (optional — only entities with displayOrder)
    @PatchMapping("/order")
    @Operation(summary = "Update Building Orders",
            description = "Updates the order of multiple Building entities")
    @SimpliXStandardApi                                      // add-on for non-standard CRUD endpoints
    @PreAuthorize("hasPermission('Building', 'edit')")
    public SimpliXApiResponse<List<BuildingDetailDTO>> updateOrder(
            @RequestBody @Validated List<BuildingOrderUpdateDTO> dtos) {
        return SimpliXApiResponse.success(service.updateOrders(dtos), "Building orders updated successfully");
    }

    //---------------------------------- Search (GET — browser-friendly URL params)
    @GetMapping("/search")
    @Operation(summary = "Search Building list (GET)",
            description = "Searches Building with various conditions using GET method")
    @PreAuthorize("hasPermission('Building', 'list')")
    public SimpliXApiResponse<Page<BuildingListDTO>> simpleSearch(
            @RequestParam(required = false)
            @SearchableParams(BuildingSearchDTO.class) Map<String, String> params) {  // @SearchableParams binds URL to SearchDTO
        return SimpliXApiResponse.success(service.search(params));
    }

    //---------------------------------- Search (POST — complex conditions, sorting, paging)
    @PostMapping("/search")
    @Operation(summary = "Search Building list (POST)",
            description = "Searches Building with various conditions using POST method")
    @PreAuthorize("hasPermission('Building', 'list')")
    public SimpliXApiResponse<Page<BuildingListDTO>> search(
            @RequestBody @Validated SearchCondition<BuildingSearchDTO> searchCondition) {
        return SimpliXApiResponse.success(service.search(searchCondition));
    }
}
```

---

## Permission Mapping

PascalCase entity name, lowercase action:

| Endpoint | Action |
|---|---|
| `create` | `'create'` |
| `update`, `multiUpdate`, `batchUpdate`, `updateOrder` | `'edit'` |
| `delete`, `batchDelete` | `'delete'` |
| `get`, `updateForm` | `'view'` |
| `simpleSearch`, `search` | `'list'` |