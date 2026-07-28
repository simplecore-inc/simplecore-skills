> **SCAFFOLD** category reference inside this skill. Loaded via the Task Router when the task involves `add-domain`, `openapi`, `add-module`, `scaffold` CLI commands, route wiring, mock registration, sidebar menu integration, or API update propagation. Sibling files: `patterns.md`, `props-conventions.md`.

# Domain Scaffold Workflow (SCAFFOLD overview)

Full end-to-end process for creating a domain package + UI module from an OpenAPI spec and integrating it into the app.

## When to Trigger This Workflow

This workflow runs in **two situations**, both with BLOCKING priority over any CUSTOMIZE task (see `SKILL.md` invariant #29):

1. **Backend API changed (most common in mature projects)** — the server added / removed / renamed fields, endpoints, enum values, or tags. Use the **Update path** — jump to §[Updating an Existing Domain (API Changed)](#updating-an-existing-domain-api-changed) below. This is Update Steps 1~7 (snapshot → regenerate → build → widget update → mock seeds → locales → verify).
2. **New domain does not exist yet** — a feature area has no corresponding `packages/domain-<name>/`. Use the **Initial path** — §[Workflow Steps](#workflow-steps) Steps 0~8 below, starting with `simplix.config.ts` registration.

### Detection recipes (how to know backend changed)

Pick whichever is cheapest in the current context:

```bash
# Recipe A — run codegen and inspect diff. The codegen is idempotent; empty diff = no change.
pnpm --filter @<prefix>/domain-<name> run codegen
git status packages/domain-<name>/src/generated/

# Recipe B — compare backend tag list against simplix.config.ts domain mapping.
SPEC=$(grep -m1 'spec:' simplix.config.ts | sed -E 's/.*"([^"]+)".*/\1/')
curl -s "$SPEC" | jq -r '.tags[].name' | sort > /tmp/backend-tags.txt
# Compare with the tags listed in simplix.config.ts openapi[].domains — new entries mean new scaffolding needed.

# Recipe C — field snapshot diff (pre vs post codegen).
grep -h "^\s\+\w\+[?:]\?:" packages/domain-<name>/src/generated/model/*DetailDTO.ts \
  | sed 's/[?:].*//' | sort > /tmp/fields-before.txt
pnpm --filter @<prefix>/domain-<name> run codegen
grep -h "^\s\+\w\+[?:]\?:" packages/domain-<name>/src/generated/model/*DetailDTO.ts \
  | sed 's/[?:].*//' | sort > /tmp/fields-after.txt
diff /tmp/fields-before.txt /tmp/fields-after.txt
```

### Why this gate blocks CUSTOMIZE work

CUSTOMIZE-category tasks (widget composition, column restyling, filter design) assume `generated/` is current. Stale generated files cause **silent bugs**:

- Widget imports a hook whose response shape no longer matches the server → runtime `undefined` reads.
- `resolveBootEnum` lookup fails because a new enum value was added server-side but the generated locale was not regenerated.
- Form submission sends a DTO missing a newly-required field → 400 only at runtime, passes all TypeScript checks because the generated DTO interface is stale.

The Scaffold Update path regenerates `generated/` in place and surfaces the diff as TypeScript compile errors — the fastest path to correctness.

## Prerequisites

Before starting, read `simplix.config.ts` at the project root. It defines:
- **`openapi[].spec`** — the API spec URL (use this exact URL for the `openapi` CLI command)
- **`openapi[].domains`** — domain name → tag list mapping
- **`openapi[].profile`** — API profile (e.g., `simplix-boot`)

All CLI commands derive their configuration from this file.

## Workflow Steps

### Step 0: Register Domain in `simplix.config.ts`

Before running any CLI command, register the new domain in `simplix.config.ts` at the project root. Without this entry, `add-domain` and `openapi` cannot resolve which backend tags belong to the domain.

Open `simplix.config.ts` and add an entry under `openapi[].domains`:

```ts
openapi: [
  {
    spec: "http://localhost:8080/api-docs/all-apis",
    profile: "simplix-boot",
    domains: {
      // ...existing domains...
      "<new-domain-name>": [
        "<backend.tag.Entity1>",
        "<backend.tag.Entity2>",
      ],
    },
  },
],
```

**Decisions captured in this file**:

- **Domain name**: kebab-case (e.g., `inventory`). Must match what you pass to `add-domain` in Step 1 and to `add-module` in Step 4. Used to derive the package names `@<prefix>/domain-<name>` and `@<prefix>/<name>` (`<prefix>` is the package prefix derived from the root `package.json` name — see `framework/configuration.md`).
- **Tag list**: the exact tag strings the backend emits in its OpenAPI spec. Fetch the `spec` URL and inspect `tags[]` (or `paths[*].<method>.tags`):
  ```bash
  curl -s "<spec-url>" | jq -r '.tags[].name' | grep "<expected-prefix>"
  ```
  Copy strings verbatim. Wrong tags → `add-domain` creates an empty domain package ("No operations found"); `openapi` generates zero hooks.

**Verify**: `simplix.config.ts` still parses — run `pnpm exec tsc --noEmit` at the project root, or reload the dev server. If the new domain appears in `openapi[].domains`, Step 1 can proceed.

**Skip this step only for the Update path** — an existing domain is already registered; jump to §[Updating an Existing Domain](#updating-an-existing-domain-api-changed) Update Step 1. **Exception**: when the backend change introduces a NEW tag (a new controller/resource), the existing domain's tag list in `simplix.config.ts` must gain that tag BEFORE regenerating — see the tag allow-list warning at the top of the Update path.

### Step 1: Domain Package Scaffolding

```bash
npx simplix add-domain <domain-name> -y
```

Creates `packages/domain-<domain-name>/` with the full package skeleton.

**Verify**: Directory exists with `package.json`, `tsconfig.json`, `tsup.config.ts`, `src/`.

### Step 2: OpenAPI Code Generation

Use the **exact spec URL** from `simplix.config.ts`:

```bash
npx simplix openapi <spec-url-from-config> -d <domain-name> -y
```

> **Tip**: The domain package created by `add-domain` already includes a `codegen` script:
> ```bash
> pnpm --filter @<prefix>/domain-<domain-name> run codegen
> ```
> This script uses the spec URL from `simplix.config.ts`, so you do not need to specify the URL directly.

This generates into `packages/domain-<domain-name>/src/`:
- `generated/endpoints/` — Orval-generated React Query hooks
- `generated/model/` — TypeScript interfaces from OpenAPI schemas
- `hooks/` — Re-exported hooks for consumer use
- `mock/` — MSW mock handlers + seed data (entity stores)
- `locales/` — i18n translation files

**Critical**: Never use a local JSON file if the config points to a live API URL. The tag names in the live API may differ from a local snapshot.

### Step 3: Install & Build Domain Package

```bash
pnpm install
pnpm --filter @<prefix>/domain-<domain-name> run build
```

The package prefix comes from the root `package.json` name field (e.g., `@<prefix>`).

**Verify**: Build succeeds with `dist/index.js` and `dist/mock.js` output.

**MANDATORY CHECK**: Verify that `package.json` exports include the `"source"` condition for every entry. This is required for Vite dev server HMR — without it, changes to source files are not reflected until the package is rebuilt.

```json
"exports": {
  ".": {
    "source": "./src/index.ts",      ← MUST EXIST
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  },
  "./mock": {
    "source": "./src/mock/index.ts",  ← MUST EXIST
    "types": "./dist/mock.d.ts",
    "import": "./dist/mock.js"
  }
}
```

If `"source"` is missing, add it manually. The CLI template includes it, but packages generated with older CLI versions may lack it.

### Step 4: UI Module Scaffolding

```bash
npx simplix add-module <domain-name> -y
```

Creates `modules/<domain-name>/` with FSD layer structure:
- `src/features/` — feature logic
- `src/widgets/` — reusable UI components
- `src/pages/` — page-level components (added by scaffold)
- `src/shared/` — shared utilities
- `src/locales/` — module-level translations

### Step 5: CRUD Widget Scaffolding

Run for **each entity that needs a UI page** (skip sub-entities that are only used within parent entities):

```bash
npx simplix scaffold <entityName> --module <domain-name>
```

Entity name is camelCase as it appears in the domain package's generated hooks (e.g., `product`, `category`).

This generates per entity:
- `src/widgets/<entity-kebab>/list.tsx` (or `tree.tsx` for hierarchical)
- `src/widgets/<entity-kebab>/form.tsx`
- `src/widgets/<entity-kebab>/detail.tsx`
- `src/widgets/<entity-kebab>/index.ts`
- `src/pages/<entity-kebab>/crud-page.tsx`
- `src/pages/<entity-kebab>/index.ts`

Also updates: `widgets/index.ts`, `pages/index.ts`, `src/index.ts`, `locales/`, `tsup.config.ts`, `package.json`.

### Step 6: Install & Build UI Module

```bash
pnpm install
pnpm --filter @<prefix>/<domain-name> run build
```

**Verify**: Build succeeds with `dist/pages/index.js` and `dist/widgets/index.js`.

**MANDATORY CHECK**: Same as Step 3 — verify `"source"` condition exists in every `package.json` export entry:

```json
"exports": {
  ".":          { "source": "./src/index.ts", ... },
  "./features": { "source": "./src/features/index.ts", ... },
  "./widgets":  { "source": "./src/widgets/index.ts", ... },
  "./locales":  { "source": "./src/locales/index.ts", ... },
  "./pages":    { "source": "./src/pages/index.ts", ... }
}
```

Without `"source"`, Vite's `resolve.conditions: ["source"]` cannot resolve to TypeScript source, and HMR will not work for this module.

### Step 7: App Integration

Three files need updating in the app (`apps/<app-name>/`):

#### 7a. Add Dependencies to `package.json`

Add both domain package and UI module to `dependencies` (alphabetical order):

```json
"@<prefix>/domain-<domain-name>": "workspace:*",
"@<prefix>/<domain-name>": "workspace:*",
```

#### 7b. Register Mock in `main.tsx`

Inside `enableMocking()`, add the dynamic import and domain registration:

```ts
// Import (add alongside other domain mock imports)
const { create<PascalDomain>Mock } = await import("@<prefix>/domain-<domain-name>/mock");

// Register (add to setupMockWorker domains array)
await setupMockWorker({
  domains: [
    // ...existing domains
    create<PascalDomain>Mock(),
  ],
});
```

Naming: domain `inventory` → `createInventoryMock` (camelCase → PascalCase, hyphens removed).

#### 7c. Create Route Files

For each entity page, create a route file following the existing pattern:

**File**: `apps/<app>/src/routes/<section>/<subsection>/index.tsx`

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { validateCrudSearch } from "@simplix-react/ui";

import { <Entity>CrudPage } from "@<prefix>/<domain-name>/pages";

export const Route = createFileRoute("/<route-path>/")({
  component: <RouteName>,
  validateSearch: validateCrudSearch,
});

function <RouteName>() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  return (
    <<Entity>CrudPage
      search={search}
      onNavigate={(search) => navigate({ to: "/<route-path>", search })}
    />
  );
}
```

The route path must match the `href` in the sidebar config (`src/shared/config/sidebar.ts`).

### Step 8: Final Verification

```bash
pnpm install
pnpm --filter <app-name> run build
```

**Verify**: Vite build succeeds without errors. The app should now show the new pages at the configured sidebar routes.

## Updating an Existing Domain (API Changed)

When the server-side API changes (fields added/removed/renamed, new endpoints, etc.), the domain package and its consuming UI module must be updated.

> **Tag allow-list gate (silent-drop trap)**: `openapi[].domains` in `simplix.config.ts` is an ALLOW-LIST — codegen emits hooks/DTOs ONLY for tags in the domain's list. A new backend endpoint under a NEW tag (a new controller/resource) that is not added to the list is **silently dropped**: no endpoint folder, no hook, no DTO model, no warning anywhere in the codegen log (the tag simply never appears in its "Entities:" line). Symptom: the endpoint answers over curl and shows in the spec, yet regeneration produces nothing for it. Before regenerating for a change that adds a tag, add the exact tag string to the domain's array first. (An endpoint added under an EXISTING listed tag needs no config change.)

### Update Step 1: Snapshot Current Fields

Before regenerating, capture the current field list from the generated model types. This enables diff-based detection of changes.

```bash
# Extract field names from DetailDTO types for each entity
grep -h "^\s\+\w\+[?:]\?:" packages/domain-<domain>/src/generated/model/*DetailDTO.ts | \
  sed 's/[?:].*//' | sort > /tmp/fields-before.txt
```

Or read the `FormValues` interface in `modules/<domain>/src/widgets/<entity>/form.tsx` — it lists all fields the UI currently uses.

### Update Step 2: Regenerate Domain Package

Use the `codegen` script built into the domain package (the spec URL is already included):

```bash
pnpm --filter @<prefix>/domain-<domain-name> run codegen
```

Or specify it directly:

```bash
npx simplix openapi <spec-url-from-config> -d <domain-name> -y
```

This overwrites:
- `src/generated/` — endpoints + model types (always regenerated)
- `src/hooks/` — re-exported hooks (always regenerated)
- `src/generated/mock/handlers.ts` — MSW handler factories (always regenerated)
- `src/locales/` — domain-level i18n keys (always regenerated)
- `src/schemas.ts`, `src/translations.ts`, `src/mutator.ts` — support files

This regenerates only when not customized:
- `src/mock/index.ts` — store wiring + generated-handler spreads; regenerated to stay in sync with `handlers.ts` UNLESS it has custom handler overrides (the `// Add custom handler overrides here` region is non-empty), in which case it is preserved untouched.

This preserves:
- `src/mock/seeds.ts` — only generated on first creation, customizable

### Update Step 3: Build Domain Package & Detect Changes

```bash
pnpm --filter @<prefix>/domain-<domain-name> run build
```

Then compare field changes:

```bash
grep -h "^\s\+\w\+[?:]\?:" packages/domain-<domain>/src/generated/model/*DetailDTO.ts | \
  sed 's/[?:].*//' | sort > /tmp/fields-after.txt
diff /tmp/fields-before.txt /tmp/fields-after.txt
```

Alternatively, build the UI module — TypeScript errors will point directly to removed/renamed fields.

### Update Step 4: Update UI Module Widgets

For each changed entity, update the widget files in `modules/<domain>/src/widgets/<entity>/`:

#### Added fields

These files need the new field:

| File | What to add |
| --- | --- |
| `list.tsx` | `interface` field + `<CrudList.Column>` + filter (if filterable) + card content row |
| `form.tsx` | `FormValues` interface field + `useState` hook + `handleSubmit` deps + `<FormFields.*>` |
| `detail.tsx` | `<DetailFields.*>` entry |
| `locales/widgets/*.json` | Field label translation key under the entity's `fields` section |

#### Removed fields

Remove from the same locations. TypeScript build errors guide you — every reference to the deleted field will fail compilation.

#### Changed field types

If a field type changed (e.g., `string` → `number`, or a new enum value added):
- Update `useState` type and default value in `form.tsx`
- Update the `FormFields.*` component type (e.g., `TextField` → `NumberField`)
- Update the `DetailFields.*` component type in `detail.tsx`
- Update enum options in `SelectField` if enum values changed
- Update `CrudList.Column` display prop if the rendering changes

### Update Step 5: Update Mock Seeds (if needed)

If new **required** fields were added, `src/mock/seeds.ts` may need updating so mock data includes values for the new fields. The seeds file is preserved across regenerations, so add new field values manually.

### Update Step 6: Update Domain Locales in Module

The domain package's `src/locales/*.json` files are regenerated with new field keys. But the module's `locales/widgets/*.json` files are NOT regenerated. Manually add/remove translation keys for new/deleted fields.

### Update Step 7: Build & Verify

```bash
pnpm --filter @<prefix>/<domain-name> run build      # UI module
pnpm --filter <app-name> run build                     # App
```

Build errors at this stage indicate missed field updates in widgets.

### Quick Reference: Files Affected by Field Changes

```
packages/domain-<domain>/src/
├── generated/    ← REGENERATED (auto)
├── hooks/        ← REGENERATED (auto)
├── mock/
│   ├── index.ts  ← REGENERATED unless it has custom handler overrides (then PRESERVED)
│   └── seeds.ts  ← PRESERVED — update manually if new required fields
└── locales/      ← REGENERATED (auto)

modules/<domain>/src/
├── widgets/<entity>/
│   ├── list.tsx   ← UPDATE: interface, columns, filters, card
│   ├── form.tsx   ← UPDATE: FormValues, useState, handleSubmit, FormFields
│   └── detail.tsx ← UPDATE: DetailFields
└── locales/widgets/
    ├── en.json    ← UPDATE: add/remove field label keys
    ├── ko.json    ← UPDATE: add/remove field label keys
    └── ja.json    ← UPDATE: add/remove field label keys
```

---

## Decision Guide: Which Entities Get UI Pages?

Not every entity in a domain needs its own CRUD page. Use this heuristic:

| Entity Type | Gets UI Page? | Example |
| --- | --- | --- |
| Top-level entities users manage directly | ✔ Yes | Product, Category |
| Child/sub-entities managed within a parent | ✖ No | ProductVariant (managed inside Product) |
| Lookup/reference entities | ✖ No | ProductTag (reference data for products) |

When unsure, ask the user which entities should have standalone pages.

## Naming Conventions

| Source | Convention | Example |
| --- | --- | --- |
| Domain name (config) | kebab-case | `inventory` |
| Package name | `@<prefix>/domain-<domain>` | `@<prefix>/domain-inventory` |
| Module package name | `@<prefix>/<domain>` | `@<prefix>/inventory` |
| Entity (CLI arg) | camelCase | `product` |
| Entity widget dir | kebab-case | `product/` |
| CrudPage export | PascalCase + `CrudPage` | `ProductCrudPage` |
| Mock factory | `create` + PascalCase + `Mock` | `createInventoryMock` |
| Route file path | matches sidebar href | `/inventory/products/` |

## Common Issues

### "Domain not found in spec config"

The CLI couldn't match the domain name to tags in the provided spec. Possible causes:
- **Wrong spec URL** — make sure to use the exact URL from `simplix.config.ts`, not a local JSON file
- **Tag mismatch** — the live API may use different tag names than a local snapshot
- **Server not running** — if the spec URL points to a live server, ensure it's accessible

### scaffold command `ReferenceError: path is not defined`

Known CLI bug in `scaffold-crud.ts:1538`. Fix: change `path.basename(moduleDir)` to `basename(moduleDir)` in the framework CLI source, then rebuild (`pnpm --filter @simplix-react/cli run build`).

### List page shows an error state immediately after scaffold (first request fails)

Every scaffolded list starts with `defaultSort: { field: "<entityId>", direction: "desc" }`, sent as `sort=<entityId>.desc` on the first page load. This is a backend contract: the entity's SearchDTO PK field must carry `@SearchableField(operators = {EQUALS}, sortable = true)`.

**Symptoms**: the list renders its error empty-state on first load; the network tab shows the `/search?page=0&size=10&sort=<entityId>.desc` request returning a search error whose detail names the id field ("정렬할 수 없습니다: <entityId>" or a sort-format error).

**Fix**: on the BACKEND, add `sortable = true` to the SearchDTO's PK `@SearchableField` (see the `simplix:backend` skill's `review/searchable-field-patterns.md` § PK Sortable Contract). Do NOT work around it by changing the frontend `defaultSort` — ID-desc is the standard newest-first ordering (UUID v7 is time-ordered) and every other module relies on it.

**Verify (per entity, before customizing)**:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/<entity-path>/search?page=0&size=10&sort=<entityId>.desc" | jq .type   # → "SUCCESS"
```
Also confirm every column the widget marks `sortable` maps to a SearchDTO field with `sortable = true` — a non-sortable column header click fails the same way at runtime.

### List page shows no data despite successful API response

The `adaptOrvalList` hook extracts data from `query.data.content`, expecting the Boot envelope to already be unwrapped. If the domain package's `mutator.ts` uses `getMutator()` (default strategy) instead of `getMutator("boot")`, the Boot envelope `{ type: "SUCCESS", body: { content: [...] } }` is returned as-is, and `content` resolves to `undefined`.

**Symptoms**: API returns 200 with valid data, but the CrudList table is empty. No console errors.

**Root cause**: The `mutator.ts` file is only generated once (on first `add-domain`). If the `simplix-boot` profile was added to `simplix.config.ts` after the domain was initially created, the mutator still uses the default strategy.

**Fix**: Update `packages/domain-<domain>/src/mutator.ts`:

```ts
// WRONG — default strategy doesn't unwrap Boot envelope
return getMutator()<T>(url, options);

// CORRECT — the "boot" strategy returns the fetcher the app registered
// via configureMutator("boot", ...), which unwraps the { type, body } envelope
return getMutator("boot")<T>(url, options);
```

**Prevention**: After running `openapi` codegen, verify that all domain packages using `profile: "simplix-boot"` have `getMutator("boot")` in their `mutator.ts`.

**Data access after unwrap**: Because the `"boot"` strategy fetcher strips the envelope, the React Query hook's `data` is the DTO directly. `query.data` is the `DetailDTO`, and multi-level access like `query.data?.data?.body` resolves to `undefined`. The Orval response type (`{ data: GetXxx200; status: 200 }`) exists only at the type level; at runtime the unwrapped result is returned directly.

### Build errors after scaffold

Run `pnpm install` before building — scaffold may add new dependencies to the module's `package.json`.

### Codegen after a backend contract change shows none of the new fields (stale served spec)

When a full-stack change modifies the backend contract (a new field, endpoint, enum, or tag) and then regenerates the frontend, the **running backend still serves its OLD compiled spec** until it is restarted with the new code. Running codegen against that stale spec silently produces none of the new fields/hooks, and the module typecheck then fails on the missing symbols.

**Fix**: restart the backend with the committed contract change, then confirm the SERVED spec actually exposes the new symbol BEFORE running codegen:

```bash
curl -s "$API/api-docs/all-apis" | grep -c '<new-field-or-endpoint-symbol>'   # must be > 0
```

Only after that count is non-zero, run codegen. Use the **headless** form — `npx simplix openapi "$API/api-docs/all-apis" -d <domain> -y -f` — because the package.json `codegen` script may prompt interactively (Y/n) and blocks when its output is redirected. Backend restart is a delegated/authorized step; do not start a second backend on another port (a stale duplicate spec is worse than a restart).

### Codegen printed "Generated ✔" but the hooks vanished (degenerate output)

A spec-resolution failure — most commonly a binary endpoint (`ResponseEntity<byte[]>` / an octet-stream response) that breaks `$ref` resolution — can wipe the generated React Query hooks and leave only the MSW mock files, **while the run still prints a trailing success line**. Trusting "Generated ✔" then ships a domain package whose components import hooks that no longer exist.

**Fix**: after every codegen, scroll the WHOLE log for `Validation failed` (it appears mid-log, before the success line), and positively verify the expected hooks still exist rather than assuming they were written:

```bash
grep -rl 'useGet<Entity>\|useList<Entity>' packages/domain-<domain>/src/generated/   # must hit real endpoint files, not just mock/
```

If the output is degenerate, STOP — do not commit it. The usual root cause is a backend binary endpoint that should carry `@Hidden` (or be split off the domain tag) so it stays out of the codegen'd surface.

### A new backend enum value's frontend label is missing (or a manual edit keeps reverting)

Server enum translations flow into the domain package's `locales/*.json` via codegen's "Applied server i18n translations" overlay — they are NOT hand-authored on the frontend. A manual edit to a frontend enum locale is overwritten by the next codegen.

**Fix**: set the label in the BACKEND `messages/enums/*.properties` (every locale; `EnumMessageTranslationTest` gates this), then regenerate — the label lands in the frontend locale automatically. Symmetrically, after any regeneration spot-check that the enum count in `locales/en.json` did not shrink (an overlay failure can pass typecheck while dropping enums — see Notes & Gotchas).

## File Map

| Purpose | Location |
| --- | --- |
| simplix.config.ts | Project root — all domain/spec configuration |
| Domain package | `packages/domain-<domain>/` |
| UI module | `modules/<domain>/` |
| App entry (mock) | `apps/<app>/src/main.tsx` |
| App routes | `apps/<app>/src/routes/<section>/...` |
| Sidebar config | `apps/<app>/src/shared/config/sidebar.ts` |
| App dependencies | `apps/<app>/package.json` |

## References

- [Route & Widget patterns](patterns.md) — Detailed code patterns for routes, pages, widgets
- [Props conventions](props-conventions.md) — Widget callback props, editor props, usePageHeader patterns, ListDetail sizing

## Workflow placement

This is the **SCAFFOLD** category entry point inside this skill. It sits between framework setup and widget customization:

1. Upstream — **DESIGN** — `../framework/overview.md` — framework API (`defineApi`, `deriveEntityHooks`, `setupMockWorker`, `simplix.config.ts`)
2. Downstream — **CUSTOMIZE** — `../customize/overview.md` — post-scaffold widget customization, framework component composition, custom editors

## Notes & Gotchas

- A domain package created in non-OpenAPI (template) mode lacks the `@faker-js/faker` and `orval` devDependencies. Add them to that package's `package.json` before switching it to Orval MSW mode (`add-domain --force`).
- The CLI's programmatic Orval (`orval.generate()`) can fail silently for a package whose `src/generated/` was produced in single-file output mode. Delete the stale `src/generated/` directory and re-run to resolve.
- When a generated update hook has no path parameter (a body-only update), the form template falls back to wrapping `{ data: dto }` only (`adaptOrvalCreate(_update)`). Account for this when wiring update mutations for body-only updates.
- `scaffold` has no `-y` flag (unlike `add-domain` / `openapi`); it runs without interactive prompts.
- `openapi` regeneration uses `.openapi-snapshot.json` to detect spec changes and skips when nothing changed ("No changes detected"). Pass `--force` to bypass the snapshot and regenerate unconditionally — needed when only a naming-strategy / plugin change occurred while the spec itself is identical.
- Running codegen from inside a package (`pnpm --filter <pkg> run codegen`) still resolves the project root by searching upward for `simplix.config.ts` / `pnpm-workspace.yaml`, so it works from a subdirectory.
- An OpenAPI `operationId` containing an underscore (e.g. `EntityRest_create`) is recorded verbatim into `crud.config.ts`, but Orval strips underscores and PascalCases the hook name (`useEntityRestCreate`). If a scaffolded widget imports a non-existent `use…_…` hook, fix the hook name in `crud.config.ts` by hand (already-generated config files are not regenerated).
- Read-only entities (no create/update) can confuse field extraction if a `*SearchBody` schema (the search request body: `conditions`, `page`, `size`) is mistaken for entity fields — verify the scaffolded field set against the real DTO when scaffolding a read-only entity.
- After regeneration, spot-check that server enum translations were not silently truncated (e.g. compare the enum count in a domain's `locales/en.json` before/after). An i18n overlay failure can pass typecheck/build while dropping enums.
- The i18n overlay is a **rewrite, not a merge**: a full regen replaces `packages/domain-<name>/src/locales/*.json` with what the backend properties provide. Any enum block that exists only on the frontend disappears, and raw keys (`SomeEnum.VALUE`) leak into every badge/label that used it. After each regen, run `git diff packages/domain-<name>/src/locales/` — if enum blocks vanished, `git restore` the three files (the overlay's own changes are usually trivial reorderings). The durable fix is to add those enum labels to the backend `messages/enums/*.properties` so the overlay carries them.
