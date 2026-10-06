# Template Customization Reference

Customizing SimpliX generator `.java.template` files.

> **Scope (canonical):** EJS syntax inside `.java.template` files, template variable reference, template paths under `.simplix/templates/`, regeneration workflow after editing. For generator-level commands see **promote-workflow.md** and `../entity/yml-configuration.md` § Code Generation; for runtime generator errors see **troubleshooting.md**; for YML config passed to templates see `../entity/yml-configuration.md`.

---

## Template Files

```
.simplix/templates/
├── controller/
│   └── rest/
│       └── EntityRestController.java.template
├── service/
│   ├── EntityService.java.template
│   └── EntityTreeService.java.template      # tree entities
├── dto/
│   └── EntityDTOs.java.template
├── repository/
│   └── EntityRepository.java.template      # rendered only when the config names a repository target
└── test/
    ├── EntityServiceTest.java.template
    └── EntityTreeServiceTest.java.template
```

The generator renders a template only for a component that `.simplix/generator-simplix.json` names under `target.targetPath` (`service`, `controllerRest`, `controllerWeb`, `dto`, `repository`), and takes each template's path from the `template` map of the same file. A config whose `targetPath` names no `repository`, as the generator's own documented configuration does, never renders `EntityRepository.java.template`: the repository is written by hand beside the entity (`../entity/repository-patterns.md` § File Location), and the generator only computes its package so that the generated service can import it (`../entity/base-entity-patterns.md` § Path convention).

---

## Available Variables

### Entity Information

| Variable | Type | Description |
|----------|------|-------------|
| `entityName` | String | Entity class name |
| `modulePath` | String | Package path |
| `idField` | String | Primary key field name |
| `nameField` | String | Display name field |
| `packageName` | String | Full package name |

### Field Information

```javascript
fields = [
  {
    name: 'fieldName',
    type: 'String',
    javaType: 'java.lang.String',
    required: true,
    unique: false,
    maxLength: 128,
    sortable: true,
    views: ['list', 'detail', 'edit'],
    searchOperators: ['equals', 'contains'],
    reference: null  // or reference object
  }
]
```

### Reference Object

```javascript
reference = {
  entity: 'CmsChannel',
  idField: 'channelId',
  idType: 'String',
  nameField: 'name',
  multiple: false
}
```

### YML Config

```javascript
ymlConfig = {
  entity: 'EntityName',
  modulePath: 'module/path',
  idField: 'entityId',
  nameField: 'name',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: { /* ... */ },
  sortOrderConfig: { /* ... */ }
}
```

---

## Common Patterns

### Conditional Import

```ejs
<% if (hasEnumFields) { %>
import {basePackage}.domain.enums.<%= enumPackage %>.<%= enumName %>;
<% } %>
```

### Field Loop with Filter

```ejs
<% fields.filter(f => f.views.includes('list')).forEach(field => { %>
    private <%= field.type %> <%= field.name %>;
<% }); %>
```

### Reference Field Handling

```ejs
<% if (field.reference) { %>
    <% if (field.reference.multiple) { %>
    private Set<String> <%= field.name %>;
    <% } else { %>
    private String <%= field.name %>;
    <% } %>
<% } %>
```

### Validation Annotations

```ejs
<% if (field.required) { %>
    @NotNull
<% } %>
<% if (field.maxLength) { %>
    @Size(max = <%= field.maxLength %>)
<% } %>
<% if (field.unique) { %>
    // Unique validation handled at service layer
<% } %>
```

---

> **The real templates are the source of truth.** The snippets below mirror the actual generator templates (`.simplix/templates/controller/rest/EntityRestController.java.template`, `.simplix/templates/service/EntityService.java.template`). When in doubt, read those files - do not trust a snippet that diverges from them.

## Controller Template Example

```ejs
package <%= packagePaths['controllerRest'] %>;   // e.g. {basePackage}.web.facility.identity.controller

import dev.simplecore.simplix.web.controller.SimpliXBaseController;
import dev.simplecore.simplix.core.model.SimpliXApiResponse;
import <%= packagePaths['dto'] %>.<%= entityName %>DTOs.*;
import <%= entityPackage %>.<%= entityName %>;
import <%= packagePaths['service'] %>.<%= entityName %>Service;

@RestController
@RequestMapping("/<%= templatePath %>")
@Tag(name = "<%= packagePaths['controllerRest'].substring(basePackage.length + 1).replace(/\.controller$/, '') %>.<%= entityName %>")  // must come out as {module}.{subdomain}.{Entity} (#10)
public class <%= entityName %>RestController extends SimpliXBaseController<<%= entityName %>, String> {

    private final <%= entityName %>Service service;

    public <%= entityName %>RestController(<%= entityName %>Service service) {
        super(service);
        this.service = service;
    }

    @PostMapping("/create")
    @Operation(summary = "Create <%= entityName %>", description = "Creates a new <%= entityName %>")
    @PreAuthorize("hasPermission('<%= entityName %>', 'create')")
    public SimpliXApiResponse<<%= entityName %>DetailDTO> create(@RequestBody @Validated <%= entityName %>CreateDTO createDto) {
        return SimpliXApiResponse.success(service.create(createDto));
    }

    // ... the other endpoints: update, multiUpdate, delete, get, updateForm, batchUpdate, batchDelete, [updateOrder], simpleSearch, search
}
```

> The template names the permission target after the entity (`'<%= entityName %>'`), which invariant #9 forbids. Whether its `@Tag` expression drops the `web` segment depends on what the generator passes as `basePackage`: with the project's base package and `packagePaths['controllerRest']` as in the first line, it yields `web.{module}.{subdomain}.{Entity}`, which #10 forbids. `promote-workflow.md` § After promoting rewrites both.

---

## Service Template Example

```ejs
package <%= packagePaths['service'] %>;   // e.g. {basePackage}.web.facility.identity.service

@Service
@Transactional(readOnly = true)
public class <%= entityName %>Service extends SimpliXBaseService<<%= entityName %>, String> {

    private final MessageSource messageSource;
    // modelMapper is inherited from SimpliXBaseService (@Autowired there) — never redeclare or inject it here

    public <%= entityName %>Service(<%= entityName %>Repository repository, EntityManager entityManager, MessageSource messageSource) {
        super(repository, entityManager);
        this.messageSource = messageSource;
    }

    @Transactional
    public <%= entityName %>DetailDTO create(<%= entityName %>CreateDTO createDTO) {
        <%= entityName %> entity = new <%= entityName %>();
        modelMapper.map(createDTO, entity);
        return saveAndGetProjection(entity);
    }

    @Transactional
    public <%= entityName %>DetailDTO update(<%= entityName %> entity, <%= entityName %>UpdateDTO updateDto) {
        if (!Objects.equals(entity.get<%= capitalizeFirstLetter(ymlConfig.idField) %>(), updateDto.get<%= capitalizeFirstLetter(ymlConfig.idField) %>())) {
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "{error.<domain>.idCannotChange}", null);
        }
        modelMapper.map(updateDto, entity);
        return saveAndGetProjection(entity);
    }

    // ... delete, batchDelete, search(Map), search(SearchCondition), [optional] multiUpdate/batchUpdate/updateOrder
}
```

> The shipped service template resolves the ID-mismatch message at throw time: `messageSource.getMessage("error.id.cannot.change", null, "ID cannot be changed", LocaleContextHolder.getLocale())`. A message with no arguments is the `{error.<domain>.<key>}` placeholder that SKILL.md #3 has resolved at the HTTP layer, and a bare key passed to `MessageSource` is one the translation-coverage test cannot see, so the text above throws the placeholder. `promote-workflow.md` § After promoting rewrites the guard in the promoted service, as it rewrites the permission target; a project can instead make its copy of the template throw the placeholder.

---

## DTO Template Example

> Illustrative structure only. Lombok annotations are per DTO role - a SearchDTO MUST be `@Getter @Setter` (never `@Data`, per invariant 6), and Create/Update DTO fields carry `@FieldLabel`. Follow `../review/dto-type-reference.md` (the authoritative 8-role spec) for the exact per-role annotations, `extends` relationships, and field rules; the real template is `.simplix/templates/dto/EntityDTOs.java.template`.

```ejs
package {basePackage}.web.<%= modulePath.replace(/\//g, '.') %>.dto;

public class <%= entityName %>DTOs {

    // List DTO
    @Data
    public static class <%= entityName %>ListDTO {
        private String <%= idField %>;
        <% fields.filter(f => f.views.includes('list')).forEach(field => { %>
        private <%= field.type %> <%= field.name %>;
        <% }); %>
    }

    // Detail DTO
    @Data
    public static class <%= entityName %>DetailDTO {
        private String <%= idField %>;
        <% fields.filter(f => f.views.includes('detail')).forEach(field => { %>
        private <%= field.type %> <%= field.name %>;
        <% }); %>
    }

    // Create DTO
    @Data
    public static class <%= entityName %>CreateDTO {
        <% fields.filter(f => f.views.includes('edit')).forEach(field => { %>
        <% if (field.required) { %>@NotNull<% } %>
        <% if (field.maxLength) { %>@Size(max = <%= field.maxLength %>)<% } %>
        private <%= field.type %> <%= field.name %>;
        <% }); %>
    }

    // Update DTO
    @Data
    public static class <%= entityName %>UpdateDTO {
        @NotNull
        private String <%= idField %>;
        <% fields.filter(f => f.views.includes('edit')).forEach(field => { %>
        private <%= field.type %> <%= field.name %>;
        <% }); %>
    }
}
```

---

## Debugging Templates

### Enable Debug Output

Add to template for debugging:

```ejs
<%# Debug: Show available variables %>
<%
console.log('Entity:', entityName);
console.log('Fields:', JSON.stringify(fields, null, 2));
%>
```

### Check Generator Logs

```bash
# Run with verbose output
DEBUG=* yo simplix:generate EntityName --force
```

### Validate Template Syntax

```bash
# Test template rendering
node -e "
const ejs = require('ejs');
const template = require('fs').readFileSync('.simplix/templates/controller/rest/EntityRestController.java.template', 'utf8');
try {
  ejs.compile(template);
  console.log('Template syntax OK');
} catch (e) {
  console.error('Template error:', e.message);
}
"
```

---

## Common Errors

### Undefined Variable

```
ReferenceError: fieldName is not defined
```

**Fix**: Check variable name spelling and scope

### Missing Closing Tag

```
SyntaxError: Unexpected token
```

**Fix**: Ensure all `<%` have matching `%>`

### Wrong Path Separator

```
Error: Cannot find module
```

**Fix**: Use `.replace(/\//g, '.')` for package paths

---

## See Also

- [SKILL.md](../../SKILL.md) - Handbook entry
- [YML Configuration](../entity/yml-configuration.md) - Config reference