# Recipes

Project-side recipes for working with generated domain packages. A CLI-scaffolded project does **not** hand-write `defineApi` contracts — every domain package is produced by the `openapi` CLI (Orval codegen), and the application consumes the generated Orval hooks. The recipes below show that real flow. For the underlying simplix-react framework contract mechanics (`defineApi`, `deriveEntityHooks`, `deriveEntityFormHooks`, `deriveMockHandlers`, full type signatures), see the simplix-react framework documentation rather than re-deriving them here.

## Basic CRUD

A domain package re-exports Orval-generated hooks; the application consumes them through framework adapters.

### 1. Generate the Domain Package

Codegen comes from the `openapi` CLI (Orval v8), driven by `simplix.config.ts`. The generated output lands under `packages/domain-<name>/src/generated/` (model DTOs, endpoint hooks, mock handlers). Do not hand-write these files — they are overwritten on the next codegen (#30). For the full Initial / Update workflow see `../scaffold/overview.md`.

### 2. Re-export the Generated Hooks

Each entity's hook file simply re-exports the Orval endpoint module — no `deriveEntityHooks` call on this path.

```ts
// packages/domain-inventory/src/hooks/product.ts
export * from "../generated/endpoints/inventory-product/inventory-product";
```

```ts
// packages/domain-inventory/src/index.ts
import "./translations";
export * from "./hooks";
export * from "./generated/model";
```

> Some domain packages add an extra `export * from "./constants";` line to this barrel when the package ships hand-authored constants (enum value lists, role maps, etc.) alongside the generated output. Include it only when a `src/constants.ts` exists; it is not part of the codegen output.

Every domain `src/mutator.ts` routes through the **boot** profile so the Boot envelope (`{ type: "SUCCESS", body: { content: [...] } }`) is unwrapped before it reaches React Query — see `../scaffold/overview.md` Common Issues:

```ts
// packages/domain-inventory/src/mutator.ts
import { getMutator } from "@simplix-react/api";

export async function customFetch<T>(url: string, options: RequestInit): Promise<T> {
  return getMutator("boot")<T>(url, options);
}
```

### 3. Use in a Widget

Generated Orval hooks (`useListProducts`, `useCreateProduct`, `useOrderProduct`, …) are wired into framework widgets via adapters such as `adaptOrvalList`. The list hook's `data` is already the unwrapped Boot `.body.content` thanks to the boot mutator. (`<prefix>` is the package prefix derived from the root `package.json` name — see `framework/configuration.md`.)

```tsx
// modules/inventory/src/widgets/product/list.tsx
import { adaptOrvalList, CrudList, useCrudList } from "@simplix-react/ui";
import { useListProducts } from "@<prefix>/domain-inventory";

interface Product {
  id: string;
  name: string;
  displayOrder: number;
}

export function useProductList() {
  return useCrudList<Product>(adaptOrvalList(useListProducts), {
    stateMode: "server",
    defaultPageSize: 10,
    defaultSort: { field: "displayOrder", direction: "asc" },
    filterMode: "deferred",
  });
}
```

---

## Hierarchical (Self-Referencing) Entities

On the codegen path, hierarchy is modeled on the backend and surfaced through the OpenAPI spec, so Orval codegen produces it directly — there is no framework `parent` config to hand-write. A self-referencing entity (e.g. `category`) carries a `parentId` FK on its DTO and exposes dedicated **tree-role** endpoints that codegen turns into hooks.

### Generated DTO and Hooks

The generated DTO holds the self-reference; the generated endpoint module exposes both the flat list and the tree hooks.

```ts
// packages/domain-inventory/src/generated/model/categoryDetailDTO.ts
export interface CategoryDetailDTO {
  id?: string;
  parentId?: string;         // self-referencing FK for the tree
  parent?: Category;
  name?: string;
  sortOrder?: number;        // ordering among siblings
  // ...audit fields
}
```

The `crud.config.ts` for the package maps the tree roles to their generated hook names (`tree: "getCategoryTree"`, `subtree: "getCategorySubtree"`), so the scaffolder wires the right hooks. The re-export surfaces them all:

```ts
// packages/domain-inventory/src/hooks/category.ts
export * from "../generated/endpoints/inventory-category/inventory-category";
```

### Use the Generated Tree Hooks

```tsx
import {
  useListCategories,
  useGetCategoryTree,
  useGetCategorySubtree,
  useCreateCategory,
} from "@<prefix>/domain-inventory";

function CategoryTree() {
  // Full tree: GET /api/v1/category/tree
  const { data: tree } = useGetCategoryTree();

  // Subtree rooted at one node: GET /api/v1/category/tree/:id
  const { data: subtree } = useGetCategorySubtree("cat-1");

  // Flat, paginated list (server filter/sort) — feed through adaptOrvalList in a widget
  const { data: flat } = useListCategories();

  const createCategory = useCreateCategory();
  // Child rows are created by setting parentId on the create DTO,
  // not by a parent-scoped URL.
  // createCategory.mutate({ data: { parentId: "cat-1", name: "Accessories" } });

  return null;
}
```

Mutation argument shapes (`{ data: ... }`, path params) come straight from Orval's generated hook signatures — read the generated endpoint module for the exact mutation variables rather than assuming a framework convention.

---

## Custom Operation

File upload, batch delete, RPC-style calls.

> On the codegen path custom operations (upload, batch delete, order, …) arrive as ordinary OpenAPI endpoints and are produced by Orval codegen — e.g. `useOrderProduct`, `useBatchDeleteProducts`. The hand-written `defineApi` / `OperationDefinition` form below is the framework primitive these endpoints build on; see the simplix-react framework documentation for its full contract. The snippet is kept for orientation, not because the project hand-writes operations.

### Define an Operation

```ts
import { z } from "zod";
import type { OperationDefinition } from "@simplix-react/contract";

const assignTask = {
  method: "POST",
  path: "/tasks/:taskId/assign",
  input: z.object({ userId: z.string() }),
  output: z.object({
    id: z.string(),
    title: z.string(),
    assigneeId: z.string(),
  }),
  invalidates: (queryKeys) => [queryKeys.task.all],
} satisfies OperationDefinition;
```

### Register and Use

```ts
const api = defineApi({
  domain: "project",
  basePath: "/api/v1",
  entities: { task: taskEntity },
  operations: { assignTask },
  queryBuilder: simpleQueryBuilder,
});

// Client: path params are positional, then input body
await api.client.assignTask("task-1", { userId: "user-42" });
```

### Use Hook

```tsx
const hooks = deriveEntityHooks(api);

function AssignButton({ taskId }: { taskId: string }) {
  const { mutate, isPending } = hooks.assignTask.useMutation();

  return (
    <button
      disabled={isPending}
      onClick={() => mutate({ taskId, userId: "user-42" })}
    >
      Assign
    </button>
  );
}
```

### File Upload (multipart)

```ts
const uploadAttachment = {
  method: "POST",
  path: "/tasks/:taskId/attachments",
  input: z.object({
    file: z.instanceof(File),
    description: z.string().optional(),
  }),
  output: z.object({
    id: z.string(),
    url: z.string(),
    filename: z.string(),
  }),
  contentType: "multipart",
} satisfies OperationDefinition;

// Usage
const upload = hooks.uploadAttachment.useMutation();
upload.mutate({ taskId: "task-1", file: selectedFile, description: "Screenshot" });
```

### Blob Response (file download)

```ts
const downloadReport = {
  method: "GET",
  path: "/projects/:projectId/export",
  input: z.object({}),
  output: z.instanceof(Blob),
  responseType: "blob",
} satisfies OperationDefinition;

// Usage
const blob = await api.client.downloadReport("proj-1");
const url = URL.createObjectURL(blob);
```

### Batch Delete

```ts
const bulkDelete = {
  method: "DELETE",
  path: "/tasks/bulk",
  input: z.object({ ids: z.array(z.string()) }),
  output: z.object({ deletedCount: z.number() }),
  invalidates: (queryKeys) => [queryKeys.task.all],
} satisfies OperationDefinition;
```

---

## Optimistic Updates

Use `useUpdate` with `optimistic: true` for instant UI feedback.

```tsx
function TaskItem({ task }: { task: Task }) {
  const updateTask = hooks.task.useUpdate({ optimistic: true });

  const toggleComplete = () => {
    updateTask.mutate({
      id: task.id,
      dto: { completed: !task.completed },
    });
  };

  return (
    <li>
      <input
        type="checkbox"
        checked={task.completed}
        onChange={toggleComplete}
      />
      {task.title}
    </li>
  );
}
```

How it works:

1. Cancels in-flight queries for this entity
2. Snapshots current list data
3. Immediately updates the list cache with new values
4. On error: rolls back to snapshot
5. On settlement (success or error): invalidates all entity queries

---

## Filter and Sort

Using `ListParams` with `useList`.

### Basic Filtering

```tsx
function ActiveProducts() {
  const { data } = hooks.product.useList({
    filters: { status: "active" },
  });

  return <ul>{data?.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

### Sorting

```tsx
function SortedProducts() {
  const { data } = hooks.product.useList({
    sort: { field: "price", direction: "desc" },
  });

  return <ul>{data?.map((p) => <li key={p.id}>{p.name} - ${p.price}</li>)}</ul>;
}
```

### Multiple Sort Fields

```tsx
const { data } = hooks.product.useList({
  sort: [
    { field: "status", direction: "asc" },
    { field: "name", direction: "asc" },
  ],
});
```

### Pagination

```tsx
const { data } = hooks.product.useList({
  filters: { status: "active" },
  sort: { field: "createdAt", direction: "desc" },
  pagination: { type: "offset", page: 1, limit: 20 },
});
```

### Infinite Scrolling

```tsx
function ProductInfiniteList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    hooks.product.useInfiniteList(undefined, {
      limit: 20,
      filters: { status: "active" },
    });

  return (
    <div>
      {data?.pages.map((page) =>
        page.data.map((product) => (
          <div key={product.id}>{product.name}</div>
        )),
      )}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

### Child Entity with Filters

```tsx
function FilteredTasks({ projectId }: { projectId: string }) {
  const { data } = hooks.task.useList(projectId, {
    filters: { status: "todo" },
    sort: { field: "createdAt", direction: "desc" },
  });

  return <ul>{data?.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

---

## Custom Fetch

Add authentication headers, response transformation, retry logic.

### Auth Headers

```ts
import { defineApi, defaultFetch } from "@simplix-react/contract";

const api = defineApi(config, {
  fetchFn: async (path, options) => {
    const token = localStorage.getItem("access_token");
    return defaultFetch(path, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  },
});
```

### Token Refresh on 401

```ts
import { defineApi, defaultFetch, ApiError, type FetchFn } from "@simplix-react/contract";

let refreshPromise: Promise<string> | null = null;

const fetchWithRefresh: FetchFn = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = localStorage.getItem("access_token");
  const headers = {
    ...((options?.headers as Record<string, string>) ?? {}),
    Authorization: `Bearer ${token}`,
  };

  try {
    return await defaultFetch<T>(path, { ...options, headers });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => { refreshPromise = null; });
    }

    const newToken = await refreshPromise;
    return defaultFetch<T>(path, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
    });
  }
};

const api = defineApi(config, { fetchFn: fetchWithRefresh });
```

### No Envelope (API returns JSON directly)

> **The codegen path does NOT use this.** A codegen project talks to a `simplix-boot` backend that wraps every response in the Boot envelope (`{ type: "SUCCESS", body: { content: [...] } }`). Each domain `src/mutator.ts` calls `getMutator("boot")`, whose `bootMutator` unwraps the envelope (and throws `ApiResponseError` on non-`SUCCESS`) before the data reaches React Query — so widgets never see the envelope or a bare `{ data }` wrapper. The snippet below is the framework-level no-envelope override, kept only for the rare case of a non-boot backend; see the simplix-react framework documentation for `defaultFetch` / `FetchFn` contract details.

Set `Content-Type` only for body-bearing, non-`FormData` requests (this is what `defaultFetch` does — never stamp it on GET/DELETE or `FormData` uploads, where it breaks multipart boundaries):

```ts
import { defineApi, ApiError, type FetchFn } from "@simplix-react/contract";

const noEnvelopeFetch: FetchFn = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const method = (options?.method ?? "GET").toUpperCase();
  const hasJsonBody =
    ["POST", "PUT", "PATCH"].includes(method) && !(options?.body instanceof FormData);

  const res = await fetch(path, {
    ...options,
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

const api = defineApi(config, { fetchFn: noEnvelopeFetch });
```

---

## i18n Integration

Setting up translations with `@simplix-react/i18n`.

### Basic Setup

```ts
// src/app/i18n/index.ts
import { createI18nConfig } from "@simplix-react/i18n";

const appTranslations = import.meta.glob("../../locales/**/*.json", { eager: true });

export const { adapter, i18nReady } = createI18nConfig({
  defaultLocale: "ko",
  fallbackLocale: "en",
  appTranslations,
});
```

### App Entry Point

```tsx
// src/main.tsx
import { I18nProvider } from "@simplix-react/i18n/react";
import { adapter, i18nReady } from "./app/i18n/index.js";

async function bootstrap() {
  await i18nReady;

  createRoot(document.getElementById("root")!).render(
    <I18nProvider adapter={adapter}>
      <App />
    </I18nProvider>,
  );
}

bootstrap();
```

### Using Translations in Components

```tsx
import { useTranslation } from "@simplix-react/i18n/react";

function Greeting() {
  const { t, locale } = useTranslation("common");

  return <p>{t("greeting", { name: "Alice" })}</p>;
  // ko: "Alice님, 안녕하세요!"
  // en: "Hello, Alice!"
}
```

### Locale Switcher

```tsx
import { useI18n } from "@simplix-react/i18n/react";

function LocaleSwitcher() {
  const i18n = useI18n();
  if (!i18n) return null;

  return (
    <select value={i18n.locale} onChange={(e) => i18n.setLocale(e.target.value)}>
      {i18n.availableLocales.map((code) => {
        const info = i18n.getLocaleInfo(code);
        return <option key={code} value={code}>{info?.name ?? code}</option>;
      })}
    </select>
  );
}
```

### Formatting

```tsx
import { useI18n } from "@simplix-react/i18n/react";

function OrderSummary({ total, date }: { total: number; date: Date }) {
  const i18n = useI18n();
  if (!i18n) return null;

  return (
    <dl>
      <dt>Date</dt>
      <dd>{i18n.formatDate(date, { dateStyle: "long" })}</dd>
      <dt>Total</dt>
      <dd>{i18n.formatCurrency(total, "KRW")}</dd>
      <dt>Placed</dt>
      <dd>{i18n.formatRelativeTime(date)}</dd>
    </dl>
  );
}
```

### Lazy-Loading Module Translations

```ts
import { buildModuleTranslations } from "@simplix-react/i18n";

export const dashboardTranslations = buildModuleTranslations({
  namespace: "dashboard",
  locales: ["en", "ko"],
  components: {
    header: {
      en: () => import("./header/locales/en.json"),
      ko: () => import("./header/locales/ko.json"),
    },
  },
});

// Pass to createI18nConfig
const { adapter, i18nReady } = createI18nConfig({
  defaultLocale: "ko",
  appTranslations,
  moduleTranslations: [dashboardTranslations],
});
```

---

## Mock Layer Setup

Setting up MSW + in-memory stores for development and testing.

> **Framework-primitive path — not the codegen default.** The `deriveMockHandlers(<api>.config)` / `setupMockWorker` snippets below derive MSW handlers from a hand-written `defineApi` contract (`@simplix-react/contract` → `@simplix-react/mock`). That is the **contract-deriver** path. The **common path in an Orval-codegen project** is different: each `packages/domain-<name>/src/mock/index.ts` builds an in-memory store with `createMockEntityStore(seeds)` (also from `@simplix-react/mock`) and registers the Orval-generated `create<Entity>Handlers` (from `../generated/mock/handlers`, which wrap responses with `wrapEnvelope` from the boot-auth ext), returning a `MockDomainConfig` `{ name, handlers }`. See `overview.md` ("Mock layer") for that flow; the `deriveMockHandlers` snippets here are kept for orientation on the framework primitive, not because a codegen project hand-derives handlers.

### Basic Mock Setup

```ts
// src/mocks/handlers.ts
import { deriveMockHandlers } from "@simplix-react/mock";
import { shopApi } from "../contract";

export const handlers = deriveMockHandlers(shopApi.config, {
  product: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultSort: "createdAt:desc",
  },
});
```

### With Relations

```ts
const handlers = deriveMockHandlers(projectApi.config, {
  task: {
    relations: {
      project: {
        entity: "project",
        localKey: "projectId",
        type: "belongsTo",
      },
    },
  },
});
```

### Full Mock Worker Setup

```ts
// src/mocks/setup.ts
import { setupMockWorker, deriveMockHandlers } from "@simplix-react/mock";
import { projectApi } from "../contract";

export async function startMocks() {
  await setupMockWorker({
    domains: [
      {
        name: "project",
        handlers: deriveMockHandlers(projectApi.config),
        seed: {
          project_projects: [
            { id: 1, name: "Demo Project", status: "active" },
          ],
          project_tasks: [
            { id: 1, projectId: "1", title: "First Task", completed: false },
          ],
        },
      },
    ],
  });
}
```

### Conditional Mock Loading in main.tsx

```tsx
async function bootstrap() {
  if (import.meta.env.DEV) {
    const { startMocks } = await import("./mocks/setup");
    await startMocks();
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
```

---

## Testing

Setting up the mock layer for unit and integration tests.

> **Contract-deriver path — adapt for Orval codegen.** The examples below pass a hand-written `defineApi` contract's `.config` / `.queryKeys` (e.g. `createMockClient(<api>.config, …)`, `<api>.queryKeys.<entity>.lists()`) to `@simplix-react/testing` / `@simplix-react/mock`. Those helpers (`createMockClient`, `createTestQueryClient`, `createTestWrapper`, `waitForQuery`, `seedEntityStore`, `resetStore`) are real framework exports, but an **Orval-codegen project has no `<api>.config` / `<api>.queryKeys` object** — it seeds the generated in-memory store (`createMockEntityStore` + the generated `create<Entity>Handlers`, see Mock Layer Setup and `overview.md`) and asserts against the React Query keys produced by the generated `use<Verb><Entity>` hooks. Treat the snippets here as the framework-primitive shape and substitute the generated store/hooks when testing a codegen domain.

### Unit Test with Mock Client

```ts
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  createTestQueryClient,
  createTestWrapper,
  createMockClient,
} from "@simplix-react/testing";
import { shopApi } from "./contract";
import { hooks } from "./hooks";

describe("product hooks", () => {
  const queryClient = createTestQueryClient();
  const wrapper = createTestWrapper({ queryClient });

  afterEach(() => {
    queryClient.clear();
  });

  it("lists products", async () => {
    const mockClient = createMockClient(shopApi.config, {
      product: [
        { id: "1", name: "Widget", price: 100 },
        { id: "2", name: "Gadget", price: 200 },
      ],
    });

    // Use mockClient with your hooks...
  });
});
```

### Integration Test with MSW

```ts
import { setupServer } from "msw/node";
import { deriveMockHandlers, seedEntityStore, resetStore } from "@simplix-react/mock";
import { shopApi } from "./contract";

const handlers = deriveMockHandlers(shopApi.config);
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});

beforeEach(() => {
  resetStore();
  seedEntityStore("shop_products", [
    { id: 1, name: "Widget", price: 100, status: "active" },
    { id: 2, name: "Gadget", price: 200, status: "active" },
  ]);
});

afterEach(() => server.resetHandlers());

afterAll(() => {
  server.close();
  resetStore();
});
```

### Wait for Query

```ts
import { waitForQuery, createTestQueryClient } from "@simplix-react/testing";

const queryClient = createTestQueryClient();

// ... trigger a query fetch ...

await waitForQuery(queryClient, shopApi.queryKeys.product.lists());
const data = queryClient.getQueryData(shopApi.queryKeys.product.lists());
expect(data).toBeDefined();
```

### Custom Timeout

```ts
await waitForQuery(queryClient, ["products"], { timeout: 10000 });
```
