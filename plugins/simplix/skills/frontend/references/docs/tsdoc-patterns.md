# TSDoc Patterns

## Required Tags

| Tag | Purpose | Where |
| --- | --- | --- |
| (first line) | Summary — one sentence describing "what this is" | All public exports |
| `@remarks` | Detailed explanation after summary | Complex functions/types |
| `@typeParam` | Generic parameter description | Generic functions/types |
| `@param` | Function parameter description | All public functions |
| `@returns` | Return value description | All public functions |
| `@example` | Code example (fenced code block) | All public exports |
| `@see` | Cross-reference to related APIs | Cross-package connections |
| `@throws` | Possible exceptions | Functions that throw |

## Forbidden Tags

- `@deprecated` — project rule: delete deprecated code immediately
- `@author` — use git blame
- `@since` — use CHANGELOG

## Writing Rules

1. Start summary with 3rd-person present-tense verb: "Derives...", "Defines...", "Creates..."
2. `@example` code MUST be executable — include all imports, no omissions
3. Explain "why", not "what": `@param config` → "Configuration defining API structure" (O) / "config object" (X)
4. Only comment non-obvious behavior — do not repeat what type signatures already show
5. Use `@see` for cross-package references: contract ↔ react ↔ mock
6. Never use `@` tags in inline comments — TSDoc tags only in block comments (`/** */`)

## Priority Order

Document the public exports most visible in IDE tooltips first. Prioritize by how widely each export is consumed, working down the dependency graph:

| Priority | Target | Reason |
| --- | --- | --- |
| 1 | Shared UI package public exports (`packages/<ui-package>/src/**`) | Imported by every module |
| 2 | Domain package public surface (`packages/domain-<domain>/src/index.ts`) | The contract / hooks consumed by widgets |
| 3 | Widely-reused module widgets / hooks | High reuse across pages |
| 4 | Remaining public exports | |

(When documenting the framework itself rather than a consumer project, prioritize its contract → hooks → mock → i18n entry points in that order.)

## Function Example

```typescript
/**
 * Derives type-safe React Query hooks from an API contract.
 *
 * @remarks
 * For each entity, generates 5 hooks (useList, useGet, useCreate, useUpdate, useDelete).
 * For each operation, generates a useMutation hook.
 * Mutation hooks automatically invalidate related queries.
 *
 * @typeParam TEntities - Mapping from entity names to EntityDefinition
 * @typeParam TOperations - Mapping from operation names to OperationDefinition
 *
 * @param contract - Return value of `defineApi()` (includes config, client, queryKeys)
 * @returns Mapping object from entity/operation names to hook sets
 *
 * @example
 * ```tsx
 * import { defineApi } from "@simplix-react/contract";
 * import { deriveEntityHooks } from "@simplix-react/react";
 *
 * const api = defineApi({ domain: "project", basePath: "/api", entities: { ... } });
 * const hooks = deriveEntityHooks(api);
 *
 * // Entity hooks
 * const { data } = hooks.projects.useList("");
 *
 * // Operation hooks
 * const { mutate } = hooks.publishProject.useMutation();
 * ```
 *
 * @see {@link defineApi} — contract creation
 * @see {@link EntityHooks} — shape of entity hook sets
 */
```

## Interface/Type Example

```typescript
/**
 * Defines the response schema and operations for an API entity.
 *
 * @remarks
 * `schema` defines the full shape of entities returned by the API.
 * Each operation carries its own `method`, `path`, and `input`/`output` schemas —
 * create/update payloads live in the relevant operation's `input`, not on the entity.
 * TypeScript types are inferred automatically via `z.infer<>`.
 *
 * @typeParam TSchema - Entity's Zod schema type (response shape)
 * @typeParam TOperations - Mapping from operation names to operation definitions
 *
 * @example
 * ```ts
 * const projectEntity: EntityDefinition<typeof projectSchema, typeof projectOperations> = {
 *   schema: projectSchema,
 *   identity: ["id"], // optional, defaults to ["id"]
 *   operations: projectOperations, // each op carries method/path/input/output
 *   parent: { param: "orgId", path: "/orgs" }, // optional
 * };
 * ```
 */
```

## Constant/Enum Example

```typescript
/**
 * Load state of translation resources.
 *
 * @example
 * ```ts
 * const state = adapter.getLoadState("ko", "common");
 * if (state === TRANSLATION_LOAD_STATES.LOADED) {
 *   // translations are ready
 * }
 * ```
 */
```
