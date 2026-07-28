# Configuration Reference

`simplix.config.ts` is the central configuration file for simplix-react projects. It is loaded at project root by the CLI and controls code generation, HTTP environments, and OpenAPI integration. For the framework-level type signatures behind each option, see the simplix-react framework documentation — this reference documents how a project configures the CLI.

Valid top-level keys are: `plugins`, `api`, `queryBuilder`, `packages`, `http`, `codegen`, `i18n`, and `openapi`. There is no top-level `mock` key.

## File Location

```
project-root/
  simplix.config.ts    <-- here
  packages/
  apps/
  ...
```

## Full Configuration

```ts
import { defineConfig } from "@simplix-react/cli";

export default defineConfig({
  // ── Plugins ────────────────────────────────────────────────
  // CLI extension plugins that register spec profiles and response
  // adapters used during code generation (e.g., the "simplix-boot" profile).
  plugins: ["@simplix-react-ext/simplix-boot-cli-plugin"],

  // ── API ────────────────────────────────────────────────────
  api: {
    /** API base path — used for basePath in code generation */
    baseUrl: "/api",
  },

  // ── Packages ───────────────────────────────────────────────
  packages: {
    /** Short prefix for generated package names (default: derived from root package.json name) */
    prefix: "my-project",
  },

  // ── HTTP Environments ──────────────────────────────────────
  http: {
    /** .http file environment settings */
    environments: {
      development: { baseUrl: "http://localhost:3000" },
      staging: { baseUrl: "https://staging.example.com" },
      production: { baseUrl: "https://api.example.com" },
    },
  },

  // ── i18n ───────────────────────────────────────────────────
  i18n: {
    locales: ["en", "ko", "ja"],
    defaultLocale: "en",
  },

  // ── Code Generation ────────────────────────────────────────
  codegen: {
    /** Prepend auto-generated header comment to generated files */
    header: true,
  },

  // ── OpenAPI ────────────────────────────────────────────────
  // An ARRAY of spec configs. Each entry pulls one OpenAPI document and
  // splits it into domain packages. `spec` and `domains` are required;
  // `profile` / `naming` / `responseAdapter` / `crud` are optional.
  openapi: [
    {
      spec: "http://localhost:8080/api-docs/all-apis",
      profile: "simplix-boot",
      domains: {
        // domainName -> fully-qualified operation/tag identifiers
        pet: ["store.pet.Pet", "store.pet.Category"],
        order: ["store.order.Order", "store.order.Inventory"],
      },
    },
  ],
});
```

## Option Details

### api

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseUrl` | `string` | `"/api"` | API base path prepended to all domain paths in generated code |

Used by `add-domain` and `openapi` commands to compute `basePath` for `defineApi()`:

```
basePath = api.baseUrl + "/" + domainName
// e.g., "/api/pet", "/api/store"
```

### packages

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `prefix` | `string` | derived from `package.json` name | Short prefix for generated package names |

When omitted, the CLI derives the prefix from the root `package.json` name by stripping the leading `@scope/` and a trailing `-monorepo` suffix.

Example: `@mycompany/petstore-monorepo` -> prefix = `petstore`

The package **scope** is a separate concern: it is always taken from the root `package.json` name's leading `@scope/` segment (independent of `prefix`). `prefix` only contributes the package's name segment, never the scope.

Generated packages follow the pattern: `{scope}/{prefix}-domain-{name}`, where `{scope}` comes from the root `package.json` name. If the root name has no `@scope/`, the package is unscoped (`{prefix}-domain-{name}`).

`prefix` may also be an **empty string** (`prefix: ""`). In that case the prefix segment is omitted entirely — packages become `{scope}/domain-{name}` (note: no leading dash) — but the scope is still applied from the root `package.json` name.

### http

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `environments` | `Record<string, { baseUrl: string }>` | `{ development: { baseUrl: "http://localhost:3000" } }` | Named environments for `.http` file generation |

Each environment defines a `baseUrl` used in generated `.http` test files.

### i18n

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `locales` | `string[]` | — | Locales for which message catalogs are generated/maintained |
| `defaultLocale` | `string` | first locale | Fallback locale |

> **Note — no `mock` key.** `simplix.config.ts` has no top-level mock configuration. Mock list page sizing is a per-handler concern of `deriveMockHandlers` (its `MockEntityConfig` argument), not a global config option. On the codegen path the mock layer is built from `createMockEntityStore` + generated `create<Entity>Handlers` + `wrapEnvelope` rather than `deriveMockHandlers` — see `scaffold/overview.md`. Refer to the simplix-react framework documentation for the `MockEntityConfig` contract.

### codegen

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `header` | `boolean` | `true` | Prepend auto-generated header comment to generated files |

When `true`, generated files include a header like:

```ts
// This file is auto-generated. Do not edit manually.
```

### openapi

`openapi` is an **array** of spec configs (`OpenAPISpecConfig[]`), not an object. Each entry pulls one OpenAPI document and splits it into domain packages.

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `spec` | `string` | yes | URL or path to the OpenAPI document |
| `domains` | `Record<string, string[]>` | yes | Domain name → operation/tag identifiers grouped into that package |
| `profile` | `string` | no | Spec profile registered by a plugin (SimpliX backends use `"simplix-boot"`) |
| `naming` | — | no | Naming overrides for generated symbols |
| `responseAdapter` | — | no | Response envelope adapter |
| `crud` | — | no | CRUD generation options |

Each value in `domains` lists the fully-qualified identifiers grouped into that package:

```ts
openapi: [
  {
    spec: "http://localhost:8080/api-docs/all-apis",
    profile: "simplix-boot",
    domains: {
      "inventory": ["inventory.Product", "inventory.Category"],
      "store": ["store.pet.Pet", "store.order.Order"],
    },
  },
];
```

When running `simplix openapi`, operations are grouped into domain packages based on these identifiers. See the simplix-react framework documentation for the full `OpenAPISpecConfig` field reference.

## Config Loading Behavior

1. The CLI looks for `simplix.config.ts` at the project root
2. If found, it is loaded via `jiti` (TypeScript-aware dynamic import)
3. If not found or loading fails (e.g., dependencies not yet installed), defaults are used
4. Config values are shallow-merged with defaults

## defineConfig Helper

`defineConfig()` is a type-safe identity function that provides autocompletion:

```ts
import { defineConfig } from "@simplix-react/cli";

export default defineConfig({
  // Full TypeScript IntelliSense here
});
```

It simply returns the config object as-is. Its only purpose is TypeScript type inference.

## CLI Commands That Use Config

| Command | Config Fields Used |
| --- | --- |
| `simplix init` | Generates the config file |
| `simplix add-domain` | `api.baseUrl` for basePath computation |
| `simplix openapi` | `api.baseUrl`, `openapi[].spec`, `openapi[].domains`, `openapi[].profile`, `codegen.header` |
| `simplix validate` | Validates against config constraints |

## Common Patterns

### Multi-environment API setup

```ts
export default defineConfig({
  api: { baseUrl: "/api/v1" },
  http: {
    environments: {
      development: { baseUrl: "http://localhost:3000" },
      staging: { baseUrl: "https://staging-api.myapp.com" },
      production: { baseUrl: "https://api.myapp.com" },
    },
  },
});
```

### OpenAPI with multiple domains

```ts
export default defineConfig({
  api: { baseUrl: "/api" },
  openapi: [
    {
      spec: "http://localhost:8080/api-docs/all-apis",
      profile: "simplix-boot",
      domains: {
        pet: ["store.pet.Pet", "store.pet.Category"],
        order: ["store.order.Order", "store.order.Inventory"],
        user: ["account.user.User", "account.auth.Auth"],
      },
    },
  ],
});
```

### Multiple specs in one project

`openapi` being an array means several OpenAPI documents can be wired in a single config — each entry has its own `spec`, `profile`, and `domains`:

```ts
export default defineConfig({
  api: { baseUrl: "/api" },
  openapi: [
    {
      spec: "http://localhost:8080/api-docs/all-apis",
      profile: "simplix-boot",
      domains: { pet: ["store.pet.Pet"] },
    },
    {
      spec: "https://third-party.example.com/openapi.json",
      domains: { billing: ["billing.Invoice", "billing.Payment"] },
    },
  ],
});
```
