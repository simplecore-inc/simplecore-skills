# Configuration Reference

`simplix.config.ts` is the central configuration file for simplix-react projects. It is loaded at project root by the CLI and controls code generation, HTTP environments, and OpenAPI integration. For the framework-level type signatures behind each option, see the simplix-react framework documentation - this reference documents how a project configures the CLI.

Valid top-level keys are: `plugins`, `api`, `queryBuilder`, `packages`, `http`, `codegen`, `i18n`, `openapi`, and the screen-generation keys `templates`, `modules`, `routes`, `scaffold`, `references`, `generated` and `checks` (§ Screen generation keys). There is no top-level `mock` key.

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
    /** API base path - used for basePath in code generation */
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
  // splits it into domain packages. `domains` is required, and `spec`
  // unless the entry declares `meta` (SimpliX Meta - see below);
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

`prefix` may also be an **empty string** (`prefix: ""`). In that case the prefix segment is omitted entirely - packages become `{scope}/domain-{name}` (note: no leading dash) - but the scope is still applied from the root `package.json` name.

### http

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `environments` | `Record<string, { baseUrl: string }>` | `{ development: { baseUrl: "http://localhost:3000" } }` | Named environments for `.http` file generation |

Each environment defines a `baseUrl` used in generated `.http` test files.

### i18n

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `locales` | `string[]` | `["en", "ko", "ja"]` | Locales for which message catalogs are generated/maintained |
| `defaultLocale` | `string` | `"en"` | Fallback locale |

> **Note - no `mock` key.** `simplix.config.ts` has no top-level mock configuration. Mock list page sizing is a per-handler concern of `deriveMockHandlers` (its `MockEntityConfig` argument), not a global config option. On the codegen path the mock layer is built from `createMockEntityStore` + generated `create<Entity>Handlers` + `wrapEnvelope` rather than `deriveMockHandlers` - see `scaffold/overview.md`. Refer to the simplix-react framework documentation for the `MockEntityConfig` contract.

### codegen

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `header` | `boolean` | `true` | Prepend auto-generated header comment to generated files |

When `true`, generated files include a header like:

```ts
// This file is auto-generated. Do not edit manually.
```

### Screen generation keys

These keys steer `scaffold`, `add-page`, `generated` and the project checks. Every directory they name is relative to
the project root, and the commands refuse a `templates.storiesDir` or a `generated.after[].cwd` that is not an
existing directory, naming the option and the path it resolved to.

| Key | What it holds |
| --- | --- |
| `templates.from` | The UI kit package (or a template directory) whose templates draw pages and widgets; the project's own `.simplix/templates` overrides it file by file. Without it the CLI looks for one root dependency that declares `simplix.templates` in its `package.json`. |
| `templates.storiesDir` | The design reference's screens directory. A kit template with a `.stories` sibling makes a scaffold or `add-page` write the screen's board frame there. Without it no frame is written. |
| `templates.story` | `id` and `title` patterns over `{entity}` and `{Entity}` for the generated frame, and `files`: a map from a scaffold key (an entity's kebab name, or an `add-page` story's default file name without `.stories.tsx`) to the frame file a board already draws it in, so the scaffold writes that frame instead of a second one. |
| `modules.groups` | Directory names under `modules/` that hold modules instead of being one (`["admin", "portal", "shared"]`), so `--module admin/user` addresses `modules/admin/user`. |
| `modules.dependencies` | Packages `add-module` declares in every new module's `package.json` (name to version range). |
| `routes.<group>` | Where a list screen of a module group is routed: `dir` (the app's file-route directory), `template` (the route template, `route.tanstack` in the console kit), `paths` (an override per entity kebab name where the plural is not the path), `except` (entities whose list is reached only inside another screen, so they get no route), and `menu` (`file`, `marker`, `icon`, `catalogs` per locale, `keyPath`, `gate`). Absent, no route and no menu entry is written. `menu.gate.subject` and `menu.gate.table` make the entry read the permission group from the project's subjects table (invariant #52). |
| `scaffold.defaultSortFields` | Fields a generated list may open sorted by, in order of preference, newest first unless a direction is given. An entity whose Meta declares a default sort uses that; the row key is never used. |
| `scaffold.maskedSuffix` | The suffix of a masked twin of a field (`"Masked"`): a record carrying both draws only the masked one. |
| `scaffold.referencePickers` | Per referenced entity (camel case): `hook` searches it for a form picker, `from` is the module the hook comes from, `facet` is the hook that filters a list over a key of that entity by the record's name. A required reference to an entity not listed is reported by `simplix check-screen`. |
| `references.peeks` | The peek kind a reference opens, keyed by the reference's stem, where the contract does not name the referenced entity. |
| `generated.format` | A function over `(source, path)` that formats every render before it is written, recorded as a base or compared, so an untouched file stays untouched after the project's formatter. |
| `generated.after` | `[{ cwd, command, onFailure? }]` run in order once after `scaffold`, `add-page` and `generated --all` have written files, never for a report-only `generated`. A step that exits non-zero ends the run and fails the command unless it states `onFailure: "continue"`. A project puts here what is derived from the generated files (a board's catalogs, a design check, a typecheck). |
| `checks.cycles.roots` | Directories `simplix cycles` reads when it is given none. |
| `checks.metaRemovals` | `roots`, `snapshot` and `acknowledged` for `simplix meta-removals` (`scaffold/overview.md` § The commands beside the numbered steps). |

### openapi

`openapi` is an **array** of spec configs (`OpenAPISpecConfig[]`), not an object. Each entry pulls one OpenAPI document and splits it into domain packages.

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `spec` | `string` | yes, unless `meta` is set | URL or path to the OpenAPI document (the `orval` path, `simplix openapi`) |
| `meta` | object | no | The SimpliX Meta source (the `meta` path, `simplix meta`) - § openapi[].meta below |
| `domains` | `Record<string, string[]>` | yes | Domain name → operation/tag identifiers grouped into that package |
| `profile` | `string` | no | Spec profile registered by a plugin (SimpliX backends use `"simplix-boot"`) |
| `naming` | - | no | Naming overrides for generated symbols |
| `responseAdapter` | - | no | Response envelope adapter |
| `crud` | - | no | CRUD generation options |

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

When running `simplix openapi` or `simplix meta`, operations are grouped into domain packages based on these identifiers - the two read the same `domains` map. See the simplix-react framework documentation for the full `OpenAPISpecConfig` field reference.

### openapi[].meta

An entry with a `meta` block generates from SimpliX Meta through `simplix meta`, into each domain's `src/generated-meta/`. Which keys an entry declares decides the mode the detector reports (`SKILL.md` § Which generator this project runs): `meta` with no `spec` is `meta`, `spec` with no `meta` is `orval`, both is `both`. The keys this handbook relies on:

| Key | What it is |
| --- | --- |
| `meta.source` | Where SimpliX Meta is read from. An entry that names it and drops `spec` puts every domain on SimpliX Meta |
| `meta.export` | The domains whose barrel carries the SimpliX Meta half while the entry still declares `spec`; taking a domain out of it hands that domain back to `simplix openapi` |
| `meta.snapshot` | The committed snapshot `simplix meta` compares the fetched document against - the sharper change gate SKILL.md invariant #29 describes, which registers a constraint or an access rule that never moved the OpenAPI document |

The full field reference is the simplix-react framework documentation's.

## The config has no slot for a UI module

None of `SimplixConfig`'s top-level keys (listed at the top of this file) names a module. `openapi[].domains` looks like the
place and is not: what it points at is `packages/domain-*`, the API side, and a UI module
under `modules/` is registered somewhere else entirely.

**A UI module is registered in exactly two files**, both outside this config: the workspace
package list (`pnpm-workspace.yaml`'s `modules/*`) and the consuming app's `package.json`,
which depends on it with `workspace:*`. Looking for a module entry in `simplix.config.ts`
finds nothing and the absence reads like something was left out.

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
| `simplix meta` | `api.baseUrl`, `openapi[].meta`, `openapi[].domains`, `openapi[].profile`, `codegen.header` - no `spec` |
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

`openapi` being an array means several OpenAPI documents can be wired in a single config - each entry has its own `spec`, `profile`, and `domains`:

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
