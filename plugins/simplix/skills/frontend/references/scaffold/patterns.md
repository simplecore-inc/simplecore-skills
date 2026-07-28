# Code Patterns Reference

Detailed code patterns for each integration point. Examples use the neutral `inventory` domain with a `product` entity.

## Route File Pattern

**Location**: `apps/<app>/src/routes/<section>/<subsection>/index.tsx`

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { validateCrudSearch } from "@simplix-react/ui";

import { ProductCrudPage } from "@<prefix>/inventory/pages";

export const Route = createFileRoute("/inventory/products/")({
  component: ProductsRoute,
  validateSearch: validateCrudSearch,
});

function ProductsRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  return (
    <ProductCrudPage
      search={search}
      onNavigate={(search) => navigate({ to: "/inventory/products", search })}
    />
  );
}
```

(`<prefix>` is the package prefix derived from the root `package.json` name — see `framework/configuration.md`.)

Key rules:
- `createFileRoute` path must match the file system path with trailing slash
- `validateCrudSearch` handles `?view=`, `?id=` search params
- The `onNavigate` callback uses the **same route path** (without trailing slash) as `to:`
- Route component name = Section + "Route" (e.g., `ProductsRoute`, `<Section>Route`)
- Import page from `@<prefix>/<module>/pages` subpath

## Sidebar Config Pattern

**Location**: `apps/<app>/src/shared/config/sidebar.ts`

```ts
import { Boxes, Package, Tags } from "lucide-react";

// Flat items
{ key: "products", icon: Package, href: "/inventory/products" },

// Grouped items (parent with children)
{
  key: "inventory",
  icon: Boxes,
  children: [
    { key: "products", icon: Package, href: "/inventory/products" },
    { key: "categories", icon: Tags, href: "/inventory/categories" },
  ],
},
```

The sidebar is pre-configured — the `href` values define where routes must be created.

## Mock Registration Pattern

**Location**: `apps/<app>/src/main.tsx`

```ts
async function enableMocking() {
  if (import.meta.env.PROD || import.meta.env.VITE_DISABLE_MOCK === 'true') return;

  const { setupMockWorker } = await import("@simplix-react/mock");
  const { createAuthMock } = await import("@simplix-react-ext/simplix-boot-auth/mock");
  const { createInventoryMock } = await import("@<prefix>/domain-inventory/mock");

  const { MOCK_USERS } = await import("./shared/auth/mock/mock-users");
  const authMock = createAuthMock({ users: MOCK_USERS });

  await setupMockWorker({
    domains: [
      authMock,
      createInventoryMock(),
    ],
  });
}
```

Rules:
- All mock imports are dynamic (inside `enableMocking()`) — they only load in dev mode
- Domain mocks are called with no arguments: `create<PascalDomain>Mock()`
- Only `authMock` receives arguments (`{ users: MOCK_USERS }`)
- Import from `@<prefix>/domain-<domain>/mock` subpath

## App package.json Dependencies

Add both domain package AND UI module:

```json
{
  "dependencies": {
    "@<prefix>/domain-inventory": "workspace:*",
    "@<prefix>/inventory": "workspace:*"
  }
}
```

Add the two new entries anywhere in `dependencies` — ordering is not significant (your package manager / formatter will normalize it; do not hand-sort).

## CrudPage Props Interface

All scaffolded CrudPages share this interface:

```tsx
interface EntityCrudPageProps {
  variant?: "panel" | "dialog" | "page";
  search: CrudSearch;
  onNavigate: (search: CrudSearch) => void;
}
```

- `variant` defaults to `"panel"` (list-detail side-by-side)
- `search` comes from TanStack Router's `useSearch()`
- `onNavigate` wires back to TanStack Router's `navigate()`

## Module Structure After Scaffold

```
modules/<domain>/src/
├── index.ts                    # re-exports all + registers locales
├── manifest.ts                 # module metadata
├── features/
│   └── index.ts                # empty: {}
├── pages/
│   ├── index.ts                # exports all CrudPages
│   ├── <entity-kebab>/
│   │   ├── index.ts            # export { EntityCrudPage }
│   │   └── crud-page.tsx       # full CRUD page component
├── widgets/
│   ├── index.ts                # exports all widgets
│   ├── <entity-kebab>/
│   │   ├── index.ts            # export { List, Form, Detail, useList }
│   │   ├── list.tsx            # CrudList widget
│   │   ├── form.tsx            # CrudForm widget
│   │   └── detail.tsx          # CrudDetail widget
├── shared/
│   ├── config/.gitkeep
│   ├── lib/.gitkeep
│   └── ui/.gitkeep
└── locales/
    ├── index.ts                # registerModuleTranslations()
    ├── features/{en,ko,ja}.json
    └── widgets/{en,ko,ja}.json
```

## Domain Package Structure After OpenAPI

```
packages/domain-<domain>/src/
├── index.ts                    # public API barrel (imports ./translations; re-exports ./hooks + ./generated/model)
├── schemas.ts                  # form / validation schemas
├── translations.ts             # registerDomainTranslations() wiring
├── mutator.ts                  # getMutator("boot") custom fetch wrapper
├── hooks/                      # app-facing hooks (one file per entity)
│   ├── index.ts                # barrel: export * from "./<entity>"
│   └── <entity>.ts             # adaptOrval* wrappers over generated hooks
├── generated/
│   ├── endpoints/              # Orval React Query hooks (use<Verb><Entity>)
│   ├── model/                  # generated DTO TypeScript interfaces
│   └── mock/                   # Orval-generated MSW handlers
├── mock/
│   ├── index.ts                # create<PascalDomain>Mock() factory
│   └── seeds.ts                # initial mock data
└── locales/
    ├── index.ts
    ├── en.json
    ├── ko.json
    └── ja.json
```

Note: there is no `contract.ts` and no flat `hooks.ts` on the OpenAPI/Orval path — hooks live in a `hooks/` directory (per-entity files behind an `index.ts` barrel), and the domain's public surface is the top-level `index.ts` barrel. (A `constants.ts` may also appear when a domain has shared enums/constants.)

## CLI Command Reference

```bash
# 1. Create domain package skeleton
npx simplix add-domain <domain-name> -y

# 2. Generate code from OpenAPI spec
npx simplix openapi <spec-url> -d <domain-name> -y

# 3. Create UI module skeleton
npx simplix add-module <domain-name> -y

# 4. Scaffold CRUD widgets for a specific entity
npx simplix scaffold <entityName> --module <domain-name>
```

All commands accept `-y` to skip confirmation prompts (except `scaffold`).
