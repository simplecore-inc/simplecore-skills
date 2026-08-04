> **DESIGN** category reference inside this skill. Loaded via the Task Router when the task touches framework contracts, hook derivation, the mock layer, or `simplix.config.ts`. Sibling files in this directory: `api-patterns.md`, `recipes.md`, `configuration.md`.

# simplix-react framework (DESIGN overview)

> Define once. Derive everything.

A CLI-scaffolded project is a **framework user**, not a re-implementer. It does NOT hand-call the
generic simplix-react derivation primitives (`defineApi`, `deriveEntityHooks`,
`deriveMockHandlers`, `simpleQueryBuilder` — grep = 0 across `packages/`, `apps/`,
`modules/`). Instead it derives its API layer through **Orval codegen** wired to the
`simplix-boot` profile. For the generic framework contract mechanics (full
`defineApi` / `deriveEntityHooks` / `deriveMockHandlers` signatures and type
derivation), **see the simplix-react framework documentation** — those signatures live there and are
maintained there, so this handbook does not re-document them.

## Architecture (as wired on the codegen path)

```
OpenAPI spec (backend)  ──orval codegen──>  packages/domain-<name>/src/generated/
                                                |
   src/hooks/<entity>.ts  ── re-export ──>  generated/endpoints/  (React Query hooks)
   src/mutator.ts         getMutator("boot")  (unwraps the boot envelope)
   src/mock/index.ts      createMockEntityStore + create<Entity>Handlers (MSW)
   src/generated/model/   DTO interfaces
```

- **Hooks**: each `src/hooks/<entity>.ts` is a one-line `export *` re-export of the
  Orval-generated endpoint module under `src/generated/endpoints/`. No
  `deriveEntityHooks` call is written by the project.
- **Mutator**: `src/mutator.ts` routes every request through `getMutator("boot")` from
  `@simplix-react/api`, so the boot envelope `{ type: "SUCCESS", body: { content } }`
  is unwrapped before React Query sees it.
- **Mock layer**: `src/mock/index.ts` builds in-memory stores with
  `createMockEntityStore(seeds)` and registers the generated `create<Entity>Handlers`.
- See `scaffold/overview.md` for the end-to-end boot/Orval codegen path; see the
  simplix-react framework documentation for the underlying framework contract APIs.

## How the codegen path derives its API layer

Generic framework signatures (`defineApi`, `deriveEntityHooks`, `deriveMockHandlers`)
are documented and maintained by the **simplix-react framework documentation** — consult it before
hand-rolling any contract code. This section documents only what the codegen path actually
does, because it derives through Orval rather than hand-calling those primitives.

### Hooks — Orval re-exports (not `deriveEntityHooks`)

The hook deriver in the framework is **`deriveEntityHooks`** (return type
`DerivedEntityHooksResult`), and the form deriver is `deriveEntityFormHooks`. **This
project does not call either.** Instead, each `packages/domain-<name>/src/hooks/<entity>.ts`
re-exports the Orval-generated React Query hooks:

```ts
// packages/domain-inventory/src/hooks/product.ts
export * from "../generated/endpoints/inventory-product/inventory-product";
```

`src/hooks/index.ts` barrels the per-entity re-exports. The generated endpoint modules
provide the `useGet…` / `useGetList…` / `useCreate…` / `useUpdate…` / `useDelete…`
React Query hooks; consume those, do not re-derive.

### Mutator — `getMutator("boot")`

Every domain's `src/mutator.ts` routes requests through the boot mutator so the
simplix-boot envelope is unwrapped before React Query:

```ts
// packages/domain-<name>/src/mutator.ts
import { getMutator } from "@simplix-react/api";

export async function customFetch<T>(url: string, options: RequestInit): Promise<T> {
  return getMutator("boot")<T>(url, options);
}
```

The full boot envelope is `{ type: string; message: string; body: T; timestamp: string; errorCode?: string | null; errorDetail?: ErrorDetail | null }` — here, for a list, `body` is the `PagedResult` (so `body.content` is the rows). `type` is a plain string whose success literal is `"SUCCESS"` (NOT an enum); the list adapter `adaptOrvalList` reads the already-unwrapped `.body.content`. A non-`SUCCESS` type throws `ApiResponseError` (which carries `status` / `type` / `errorMessage` / `timestamp` / `errorCode` / `errorDetail`). If `mutator.ts` uses the default `getMutator()` instead of
`getMutator("boot")`, lists render empty — see `scaffold/overview.md` Common Issues.

### Mock layer — `createMockEntityStore` + generated handlers

The mock layer uses `createMockEntityStore` (from `@simplix-react/mock`) plus the
generated `create<Entity>Handlers` and `wrapEnvelope` (from
`@simplix-react-ext/simplix-boot-auth`) — NOT `deriveMockHandlers`:

```ts
// packages/domain-<name>/src/mock/index.ts
import { createMockEntityStore } from "@simplix-react/mock";
import { productSeeds } from "./seeds";
import { createProductHandlers } from "../generated/mock/handlers";

const productStore = createMockEntityStore<ProductDetailDTO>(productSeeds);

export function createInventoryMock() {
  productStore.reset();
  return { name: "inventory", handlers: [...createProductHandlers(productStore)] };
}
```

`PagedResult` here is `{ content, totalElements, totalPages, number, size, numberOfElements, first, last, empty }`,
and sort is dot-encoded `field.direction`.

> Note: the framework's own `deriveMockHandlers` uses a numeric auto-increment id and
> stamps a camelCase `updatedAt`; the UUID-id mock behaviour belongs to a *different*
> export, `createMockClient` (from `@simplix-react/testing`). The codegen path uses neither
> on the generated path — its handlers come from Orval + `createMockEntityStore`.

### i18n

```ts
import { createI18nConfig, I18nextAdapter, buildModuleTranslations } from "@simplix-react/i18n";

const { adapter, i18nReady } = createI18nConfig({
  defaultLocale: "ko",
  appTranslations: import.meta.glob("./locales/**/*.json", { eager: true }),
});
```

### Testing

```ts
import { createTestQueryClient, createTestWrapper, createMockClient, waitForQuery } from "@simplix-react/testing";
```

## Terminology

| Use | Do NOT use |
| --- | --- |
| entity | model, resource |
| derive | generate, auto-create |
| contract | schema, spec, definition |
| operation | action, endpoint, rpc |
| mock handler | mock server, stub |

## Code Conventions

- File naming: kebab-case (`api-client.ts`, `use-query.ts`)
- One domain package per backend domain (`domain-inventory`, `domain-<name>`)
- Hooks are re-exported once per entity from `src/hooks/<entity>.ts` and barrelled in
  `src/hooks/index.ts`; do not call `deriveEntityHooks` directly (Orval supplies them)
- Pagination / sort params are produced by the Orval-generated request params; no
  hand-written query-string assembly (the framework's `simpleQueryBuilder` is not used here)
- The boot mutator (`getMutator("boot")`) unwraps `{ type: "SUCCESS", body }` and throws
  `ApiResponseError` on a non-`SUCCESS` type. (The framework's `defaultFetch` separately
  unwraps a `{ data: T }` envelope and throws `ApiError` — see the simplix-react framework documentation —
  but the generated path goes through the boot mutator, not `defaultFetch`.)

### Orval Code Generation Gotchas

- **MSW aggregate function**: Match `= () => [` pattern, not `get*Mock`. Per-endpoint response mocks (e.g., `getUpdatePetResponseMock`) also match `get*Mock` — the aggregate returns an array of handlers.
- **Type name conflicts**: `schemas.ts` (Zod inferred) vs `generated/model/` (Orval interfaces) produce duplicate names. Solution: export only Zod schema constants from `schemas.ts`, let `generated/model/` provide TypeScript interfaces.
- **Split mode no barrel**: Orval split mode generates files in `generated/endpoints/` without `index.ts`. Import specific files: `./generated/endpoints/swaggerPetstoreOpenAPI30`.
- **Mutation adapter types**: `adaptOrvalCreate`/`Update`/`Delete` use `OrvalMutationLike` with `...args: any[]` at the adapter boundary. Orval's concrete `mutate` signatures conflict with generic types due to function parameter contravariance.
- **`adaptOrvalDelete` generic**: Use explicit `<EntityId>` generic when `EntityId` might be `Record<string, string>` (not assignable to default `string | number`).

### Form API Gotchas

- **`setFieldMeta` updater**: Don't annotate the param type — let TanStack Form infer `AnyFieldMetaBase`. Writing `(meta: Record<string, unknown>)` causes TS2345.
- **`mapServerErrorsToForm`**: Duck-types error objects, exploring `error.errorDetail` → `error.data.errorDetail` → `error.data.errors` → `JSON.parse(error.body)` in order. Works with all error classes (`ApiError`, `HttpError`, `ApiResponseError`). No `@simplix-react/contract` import needed.

## One physical copy per framework package — a second copy fails silently

**Symptom.** Framework UI strings (`list.totalCount`, `filter.label`, `list.rows`,
`common.close` / `delete` / `edit`) render as the raw key on every screen, while app and
module strings are fine. Nothing is logged and nothing throws.

**Cause.** The bundle holds `@simplix-react/i18n` twice. `useTranslation` ends with
`if (!i18n) return key;`, so a component subscribing to one copy's React context under a
provider that filled the other copy's context silently hands the key back. The same split
loses the catalogue registration: `registerModuleTranslations` writes into one module
registry and `createI18nConfig` reads the other, so the `simplix/*` namespaces never enter
the i18next store and the locale chunks sit in the build unrequested.

**How the second copy arrives.** A package manager keeps one physical copy per
peer-dependency resolution, and a **linked local checkout answers its own peer imports from
its own workspace**. The worst shape is a partial link: one framework package pointed at a
checkout while the rest come from the registry. A leftover
`apps/<app>/node_modules/@simplix-react/<pkg>` symlink does exactly that and survives
installs — a package manager does not prune a package-level link when the override that
created it is removed. A build that shells out through another tool can also re-install
behind you: a packaging task passing its own link-profile environment variable outranks the
checked-in per-developer config and reverts the tree before building, so pass the profile
explicitly on that path too.

**Count what the page LOADED, never what sits in `dist/assets`.** A build that does not
empty its output directory leaves earlier chunks beside the current ones, and those stale
files count as duplicates nothing ever requests — a false positive that reads exactly like
the real defect.

```js
performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.endsWith(".js"))
// then fetch each and count those containing:
//   "createI18nConfig: failed to load module translations"   ← the i18n entry
// more than one = the module graph really is split
```

```bash
# every package-level link, before blaming the bundler
for d in apps/*/node_modules/@simplix-react modules/*/node_modules/@simplix-react; do
  [ -d "$d" ] && for l in "$d"/*; do echo "$l -> $(readlink "$l")"; done
done
```

**How the copy arrived decides where the fix goes.** A **linked local checkout** answering
its own peer imports is fixed in the install — link the whole framework scope or none of
it, and confirm with the loaded-resource count above. A **peer-hash split** of one registry
version (two `.pnpm` entries, same version, different `_hash` suffixes) is fixed in the
bundler's `resolve.dedupe` list, which must name the framework packages themselves — and
`node "${CLAUDE_PLUGIN_ROOT}/scripts/check-duplicate-contexts.mjs"` detects exactly that
case (invariant #60, full form in `invariants.md`).

**The framework-side rule this implies**, for work inside the framework packages themselves:
state a package keeps at module level — a registry, a listener set, a `createContext` — is
anchored on `globalThis` under a versioned `Symbol.for` key, so two copies share one
instance. Module-level state is what turns a duplicate copy from a bundle-size problem into
a silent correctness failure. Regression-test it by loading the module twice
(`vi.resetModules()` between two dynamic imports), registering through one copy and
asserting the other sees it — including a React render whose provider and consumer come from
different copies.

## Project Configuration

All project settings are centralized in `simplix.config.ts` at the project root:

```ts
import { defineConfig } from "@simplix-react/cli";

export default defineConfig({
  plugins: ["@simplix-react-ext/simplix-boot-cli-plugin"],
  api: { baseUrl: "/api" },           // API base path for code generation
  // packages: { prefix: "my-app" },  // Package naming prefix
  http: {                              // .http file environments
    environments: {
      development: { baseUrl: "http://localhost:3000" },
    },
  },
  codegen: { header: true },           // Auto-generated file header
  openapi: [                           // ARRAY — one entry per OpenAPI spec
    {
      spec: "openapi.json",            // spec file path or URL (required)
      profile: "simplix-boot",         // bundles naming + responseAdapter
      domains: {                       // domainName → tag patterns (required)
        "inventory": ["inventory-*"],
      },
    },
  ],
});
```

> Valid top-level keys are `plugins` / `api` / `queryBuilder` / `packages` / `http` /
> `codegen` / `i18n` / `openapi`. There is **NO** top-level `mock` key — mock-layer
> behaviour comes from the per-spec `profile` (and from `src/mock/`), not config. The
> `openapi` value is an **array** of per-spec configs (each needs `spec` + `domains`;
> `profile` / `naming` / `responseAdapter` / `crud` are optional), never an object.

See [Configuration Reference](configuration.md) for full option details.

## When to Read This Reference

Load `framework/*.md` when:

- Understanding how a codegen project derives its API layer (Orval codegen + boot mutator)
- Re-exporting or consuming the Orval-generated React Query hooks per domain
- Wiring the mock layer (`createMockEntityStore` + generated handlers) with MSW
- Configuring `simplix.config.ts` project settings (`openapi` array, `profile`)
- Debugging the boot-envelope unwrap path (`getMutator("boot")`, `adaptOrvalList`)
- Setting up i18n with `createI18nConfig`
- Writing tests with `@simplix-react/testing`

For the generic framework contract APIs (`defineApi`, `deriveEntityHooks`,
`deriveEntityFormHooks`, `deriveMockHandlers`, `EntityDefinition` /
`OperationDefinition` shapes), consult the **simplix-react framework documentation** — the codegen path
does not hand-call them, and their signatures are maintained there.

## References

- [API Patterns](api-patterns.md) -- Full API signatures and type details
- [Recipes](recipes.md) -- Common patterns and complete code examples
- [Configuration](configuration.md) -- `simplix.config.ts` option reference

## Workflow placement

This is the **DESIGN** category entry point inside this skill. After defining contracts and configuring the framework, move to:

1. **SCAFFOLD** — `../scaffold/overview.md` — CLI scaffolding, route wiring, mock registration, API update propagation
2. **CUSTOMIZE** — `../customize/overview.md` — post-scaffold widget customization, framework component composition, custom editors
