# API Patterns Reference

Orientation for simplix-react package APIs **as used on the codegen path**.

> Posture: this is the PROJECT handbook, written from the perspective of a framework USER.
> For the authoritative, full type signatures of generic framework mechanics (`defineApi`,
> `deriveEntityHooks`, `deriveMockHandlers`, `EntityDefinition`, etc.), defer to the
> **simplix-react framework documentation** — those signatures evolve in the framework repo and rot if
> duplicated here. The summaries below exist only to orient; where a framework name or fact
> appears it must be correct, but do not treat this file as the source of truth for signatures.
>
> What the codegen path actually uses (see "How the codegen path wires the API" at the bottom):
> Orval codegen + `getMutator("boot")` + `createMockEntityStore` + `adaptOrval*` — NOT
> hand-authored `defineApi` / `deriveEntityHooks` / `deriveMockHandlers` / `simpleQueryBuilder`
> (grep for those in this repo returns zero hits).

## @simplix-react/contract

### defineApi(config, options?)

```ts
function defineApi<TEntities, TOperations>(
  config: ApiContractConfig<TEntities, TOperations>,
  options?: { fetchFn?: FetchFn },
): ApiContract<TEntities, TOperations>;
```

Returns `{ config, client, queryKeys }`.

### ApiContractConfig

```ts
interface ApiContractConfig<TEntities, TOperations> {
  domain: string;
  basePath: string;
  entities: TEntities;           // Record<string, EntityDefinition>
  operations?: TOperations;      // Record<string, OperationDefinition>
  queryBuilder?: QueryBuilder;
}
```

### EntityDefinition

```ts
interface EntityDefinition<TSchema, TOperations> {
  schema: TSchema;               // z.ZodType -- response shape (required)
  identity?: string[];           // identity field names, default ["id"]
  operations: TOperations;       // Record<string, EntityOperationDef> (required)
  parent?: EntityParent;
  queries?: Record<string, EntityQuery>;
  filterSchema?: z.ZodType;
}
```

There is no `path` / `createSchema` / `updateSchema` on the entity itself. Create/update
payloads live in each operation's `input` schema, and the URL path lives in each operation's
`path`. See the simplix-react framework documentation for the full `EntityDefinition` / `EntityOperationDef`
contract — the codegen path does not hand-author these (it uses Orval codegen; see below).

### EntityParent

```ts
interface EntityParent {
  param: string;   // route parameter name, e.g. "projectId"
  path: string;    // parent URL segment, e.g. "/projects"
}
```

URL pattern: `basePath + parent.path + /:param + entity.path`

Example: `/api/v1/projects/:projectId/tasks`

### EntityQuery

```ts
interface EntityQuery {
  parent: string;   // parent entity name, e.g. "project"
  param: string;    // route parameter name, e.g. "projectId"
}
```

### OperationDefinition

```ts
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface OperationDefinition<TInput, TOutput> {
  method: HttpMethod;
  path: string;                  // with :paramName, e.g. "/tasks/:taskId/assign"
  input: TInput;                 // z.ZodType
  output: TOutput;               // z.ZodType
  contentType?: "json" | "multipart";
  responseType?: "json" | "blob";
  invalidates?: (
    queryKeys: Record<string, QueryKeyFactory>,
    params: Record<string, string>,
  ) => readonly (readonly unknown[])[];   // array of query-key arrays
}
```

Path parameters are positionally mapped to client function arguments.

### ApiContract (return type of defineApi)

```ts
interface ApiContract<TEntities, TOperations> {
  config: ApiContractConfig<TEntities, TOperations>;
  client: {
    [K in keyof TEntities]: EntityClient<...>;
  } & {
    [K in keyof TOperations]: (...args) => Promise<z.infer<TOutput>>;
  };
  queryKeys: {
    [K in keyof TEntities]: QueryKeyFactory;
  };
}
```

### EntityClient

Each entity operation produces a callable on the client; signatures vary by CRUD role.
`EntityId = string | Record<string, string>` (composite identity supported):

```ts
type EntityId = string | Record<string, string>;

interface EntityClient<TSchema> {
  list(parentIdOrParams?: EntityId | ListParams, params?: ListParams): Promise<z.infer<TSchema>[]>;
  get(id: EntityId): Promise<z.infer<TSchema>>;
  create(parentIdOrDto: EntityId | unknown, dto?: unknown): Promise<z.infer<TSchema>>;
  update(id: EntityId, dto: unknown): Promise<z.infer<TSchema>>;
  delete(id: EntityId): Promise<void>;
}
```

Create/update payload types come from each operation's `input` schema (not a fixed
`TCreate`/`TUpdate`). For child entities (with `parent`):

- `list(parentId, params?)` -- scoped to parent
- `create(parentId, dto)` -- POST under parent URL
- `get(id)`, `update(id, dto)`, `delete(id)` -- use entity's own ID

### QueryKeyFactory

```ts
interface QueryKeyFactory {
  all: readonly unknown[];                              // [domain, entity] -- property, not a method
  lists(): readonly unknown[];                          // [domain, entity, "list"]
  list(params: Record<string, unknown>): readonly unknown[];  // [domain, entity, "list", params]
  details(): readonly unknown[];                        // [domain, entity, "detail"]
  detail(id: EntityId): readonly unknown[];             // [domain, entity, "detail", id]
  trees(): readonly unknown[];                          // [domain, entity, "tree"]
  tree(params?: Record<string, unknown>): readonly unknown[]; // [domain, entity, "tree", params]
}
```

Tree-role operations derive a `useTree` hook keyed off `trees()`/`tree(params?)`.

### ListParams

```ts
interface ListParams<TFilters = Record<string, unknown>> {
  filters?: TFilters;
  sort?: SortParam | SortParam[];
  pagination?: PaginationParam;
}

interface SortParam {
  field: string;
  direction: "asc" | "desc";
}

type PaginationParam =
  | { type: "offset"; page: number; limit: number }
  | { type: "cursor"; cursor: string; limit: number };
```

### PageInfo

```ts
interface PageInfo {
  total?: number;
  hasNextPage: boolean;
  nextCursor?: string;
}
```

### QueryBuilder

```ts
interface QueryBuilder {
  buildSearchParams(params: ListParams): URLSearchParams;
  parsePageInfo?(response: unknown): PageInfo;
}
```

Built-in: `simpleQueryBuilder` (framework default — see the simplix-react framework documentation for its exact
serialization). The codegen path does NOT use `simpleQueryBuilder`; its boot/Orval list adapter
emits **dot-separated** sort tokens `field.direction` (e.g. `sort=name.asc`), not the framework
default's `field:direction`. See "How the codegen path wires the API" below.

### FetchFn

```ts
type FetchFn = <T>(path: string, options?: RequestInit) => Promise<T>;
```

### defaultFetch

```ts
async function defaultFetch<T>(path: string, options?: RequestInit): Promise<T>;
```

- Adds `Content-Type: application/json` only for `POST`/`PUT`/`PATCH` AND non-`FormData`
  bodies (`FormData` is left untouched so the browser sets the multipart boundary)
- Always adds `X-Timezone` (resolved IANA zone) when the caller hasn't set it
- Adds `Authorization: Bearer <token>` only when `getToken()` returns a truthy token and the
  header isn't already present
- Returns `undefined` for 204 No Content
- Throws `ApiError` for non-2xx responses
- Unwraps `{ data: T }` only when `data` is defined

Note: codegen domain packages do not call `defaultFetch` directly — they route through
Orval-generated clients and a `getMutator("boot")` mutator (see the Orval + boot section below).

### ApiError

```ts
class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  );
}
```

### buildPath

```ts
function buildPath(template: string, params?: Record<string, string>): string;
```

Replaces `:paramName` placeholders with URI-encoded values.

### Case Transform Utilities

```ts
function camelToSnake(str: string): string;
```

---

## @simplix-react/react

### deriveEntityHooks(contract)

```ts
function deriveEntityHooks<TEntities, TOperations>(
  contract: {
    config: ApiContractConfig<TEntities, TOperations>;
    client: Record<string, unknown>;
    queryKeys: Record<string, QueryKeyFactory>;
  },
): DerivedEntityHooksResult<TEntities, TOperations>;
```

The form deriver is `deriveEntityFormHooks` (`@simplix-react/form`). For the full mechanics of
these derivers, defer to the simplix-react framework documentation — the codegen path does not call them directly
(its hooks re-export Orval-generated hooks; see below).

### Entity Hook Signatures

#### useList

```ts
type DerivedListHook<TData> = (
  parentIdOrParams?: string | ListParams,
  paramsOrOptions?: ListParams | Omit<UseQueryOptions<TData[], Error>, "queryKey" | "queryFn">,
  options?: Omit<UseQueryOptions<TData[], Error>, "queryKey" | "queryFn">,
) => UseQueryResult<TData[]>;
```

Overloaded calling conventions:

- `useList()` -- all entities
- `useList(options)` -- with query options
- `useList(params)` -- filtered list
- `useList(params, options)` -- filtered list with options
- `useList(parentId)` -- child entity list
- `useList(parentId, params)` -- filtered child list
- `useList(parentId, params, options)` -- filtered child list with options

Auto-disables when `parentId` is falsy for child entities.

#### useGet

```ts
type DerivedGetHook<TData> = (
  id: string,
  options?: Omit<UseQueryOptions<TData, Error>, "queryKey" | "queryFn">,
) => UseQueryResult<TData>;
```

Auto-disables when `id` is falsy.

#### useCreate

```ts
type DerivedCreateHook<TInput, TOutput> = (
  parentId?: string,
  options?: Omit<UseMutationOptions<TOutput, Error, TInput>, "mutationFn">,
) => UseMutationResult<TOutput, Error, TInput>;
```

Invalidates all entity queries on success.

#### useUpdate

```ts
type DerivedUpdateHook<TInput, TOutput> = (
  options?: Omit<UseMutationOptions<TOutput, Error, { id: string; dto: TInput }>, "mutationFn">
    & { optimistic?: boolean },
) => UseMutationResult<TOutput, Error, { id: string; dto: TInput }>;
```

Mutation variable shape: `{ id: string; dto: TInput }`.

When `optimistic: true`:

1. Cancels in-flight queries
2. Snapshots current list data
3. Optimistically updates list cache
4. Rolls back on error
5. Invalidates on settlement

#### useDelete

```ts
type DerivedDeleteHook = (
  options?: Omit<UseMutationOptions<void, Error, string>, "mutationFn">,
) => UseMutationResult<void, Error, string>;
```

Mutation variable: entity `id` string. Invalidates all entity queries on success.

#### useInfiniteList

```ts
type DerivedInfiniteListHook<TData> = (
  parentId?: string,
  params?: Omit<ListParams, "pagination"> & { limit?: number },
  options?: Record<string, unknown>,
) => UseInfiniteQueryResult<{ data: TData[]; meta: PageInfo }, Error>;
```

Supports both cursor-based and offset-based pagination. Default limit: 20.

### Operation Hook Signatures

```ts
interface OperationHooks<TInput, TOutput> {
  useMutation: (
    options?: Omit<UseMutationOptions<TOutput, Error, TInput>, "mutationFn">,
  ) => UseMutationResult<TOutput, Error, TInput>;
}
```

Automatically invalidates query keys specified in the operation's `invalidates` callback.

---

## @simplix-react/mock

### deriveMockHandlers(config, mockConfig?)

```ts
function deriveMockHandlers<TEntities, TOperations>(
  config: ApiContractConfig<TEntities, TOperations>,
  mockConfig?: Record<string, MockEntityConfig>,
): HttpHandler[];
```

Generates MSW handlers for each entity:

- `GET list` -- filtering, sorting, offset-based pagination
- `GET :id` -- with optional `belongsTo` relation loading
- `POST create` -- assigns a numeric auto-increment `id` via `getNextId(storeName)`
- `PATCH :id` -- partial update; stamps a camelCase `updatedAt` (ISO string) when absent
- `DELETE :id` -- remove by id

This `deriveMockHandlers` path is distinct from the testing `createMockClient` path (which uses
UUID ids — see @simplix-react/testing below). Do not conflate the two. Note: the codegen path's mock
layer is neither of these — it uses `createMockEntityStore` + generated handlers + `wrapEnvelope`
(see the Orval + boot section below).

### MockEntityConfig

```ts
interface MockEntityConfig {
  defaultLimit?: number;       // default: 50
  maxLimit?: number;           // default: 100
  defaultSort?: string;        // default: "createdAt:desc"
  relations?: Record<string, {
    entity: string;
    localKey: string;
    foreignKey?: string;       // default: "id"
    type: "belongsTo";
  }>;
  resolvers?: Record<string, (params) => unknown>;
}
```

### setupMockWorker(config)

```ts
async function setupMockWorker(config: MockServerConfig): Promise<void>;

interface MockDomainConfig {
  name: string;
  enabled?: boolean;                            // default: true
  handlers: RequestHandler[];
  seed?: Record<string, Record<string, unknown>[]>;
}

interface MockServerConfig {
  domains: MockDomainConfig[];
}
```

Steps: filter enabled domains -> reset in-memory stores -> seed stores -> start MSW worker.

### In-Memory Store

```ts
function getEntityStore(storeName: string): Map<string | number, Record<string, unknown>>;
function getNextId(storeName: string): number;
function seedEntityStore(storeName: string, records: Record<string, unknown>[]): void;
function resetStore(): void;
```

Store naming convention: `{domain}_{snake_case_entity}` (e.g., `"project_tasks"`).

### MockResult

```ts
interface MockResult<T> {
  success: boolean;
  data?: T;
  error?: MockError;
}

interface MockError {
  code: string;    // "not_found" | "unique_violation" | "foreign_key_violation" | ...
  message: string;
}

function mockSuccess<T>(data: T): MockResult<T>;
function mockFailure<T>(error: MockError): MockResult<T>;
```

---

## @simplix-react/i18n

### createI18nConfig(options)

```ts
function createI18nConfig(options: CreateI18nConfigOptions): I18nConfigResult;

interface CreateI18nConfigOptions {
  defaultLocale?: LocaleCode;        // default: "en"
  fallbackLocale?: LocaleCode;       // default: "en"
  supportedLocales?: LocaleConfig[];
  detection?: { order: string[] };
  appTranslations?: Record<string, unknown>;   // from import.meta.glob
  moduleTranslations?: ModuleTranslations[];
  debug?: boolean;
}

interface I18nConfigResult {
  adapter: I18nextAdapter;
  i18nReady: Promise<void>;
}
```

### I18nextAdapter

```ts
class I18nextAdapter implements II18nAdapter {
  constructor(options?: I18nextAdapterOptions);

  // Properties
  readonly locale: LocaleCode;
  readonly fallbackLocale: LocaleCode;
  readonly availableLocales: LocaleCode[];

  // Lifecycle
  initialize(defaultLocale?: LocaleCode): Promise<void>;
  dispose(): Promise<void>;

  // Locale
  setLocale(locale: LocaleCode): Promise<void>;
  getLocaleInfo(locale: LocaleCode): LocaleInfo | null;

  // Translation
  t(key: string, values?: TranslationValues): string;
  tn(namespace: string, key: string, values?: TranslationValues): string;
  tp(key: string, count: number, values?: TranslationValues): string;
  exists(key: string, namespace?: string): boolean;

  // Formatting
  formatDate(date: Date, options?: DateTimeFormatOptions): string;
  formatTime(date: Date, options?: DateTimeFormatOptions): string;
  formatDateTime(date: Date, options?: DateTimeFormatOptions): string;
  formatRelativeTime(date: Date): string;
  formatNumber(value: number, options?: NumberFormatOptions): string;
  formatCurrency(value: number, currency?: string): string;

  // Resource management
  loadTranslations(locale: string, namespace: string, translations: Record<string, string | PluralForms>): void;
  addResources(locale: string, namespace: string, resources: Record<string, unknown>): void;
  getLoadState(locale: string, namespace?: string): TranslationLoadState;

  // Events
  onLocaleChange(handler: (locale: string) => void): () => void;

  // Advanced
  getI18nextInstance(): I18nextInstance;
}
```

### I18nextAdapterOptions

```ts
interface I18nextAdapterOptions {
  defaultLocale?: LocaleCode;        // default: "en"
  fallbackLocale?: LocaleCode;       // default: "en"
  locales?: LocaleConfig[];          // default: built-in ko/en/ja
  resources?: TranslationResources;
  i18nextInstance?: I18nextInstance;
  debug?: boolean;
}
```

### buildModuleTranslations(options)

```ts
function buildModuleTranslations(options: BuildModuleTranslationsOptions): ModuleTranslations;

interface BuildModuleTranslationsOptions {
  namespace: string;
  locales: string[];
  components: Record<string, ComponentTranslations>;
}

interface ComponentTranslations {
  [locale: string]: () => Promise<{ default: Record<string, unknown> }>;
}

interface ModuleTranslations {
  namespace: string;
  locales: string[];
  load(locale: string): Promise<Record<string, Record<string, unknown>>>;
}
```

### React Hooks (from `@simplix-react/i18n/react`)

```ts
function useTranslation(namespace: string): {
  t: (key: string, values?: TranslationValues) => string;
  locale: string;
  exists: (key: string) => boolean;
};

function useLocale(): LocaleCode;

function useI18n(): II18nAdapter | null;
```

### Type Constants

```ts
const DATE_TIME_STYLES = { FULL: "full", LONG: "long", MEDIUM: "medium", SHORT: "short" };
const NUMBER_FORMAT_STYLES = { DECIMAL: "decimal", CURRENCY: "currency", PERCENT: "percent", UNIT: "unit" };
const TEXT_DIRECTIONS = { LTR: "ltr", RTL: "rtl" };
const TRANSLATION_LOAD_STATES = { IDLE: "idle", LOADING: "loading", LOADED: "loaded", ERROR: "error" };
```

---

## @simplix-react/testing

### createTestQueryClient()

```ts
function createTestQueryClient(): QueryClient;
```

Returns a `QueryClient` with: `retry: false`, `gcTime: 0`, `staleTime: 0`.

### createTestWrapper(options?)

```ts
function createTestWrapper(options?: {
  queryClient?: QueryClient;
}): FC<{ children: ReactNode }>;
```

Returns a component wrapping children with `QueryClientProvider`.

### createMockClient(config, data)

```ts
function createMockClient<TEntities>(
  config: Pick<ApiContractConfig<TEntities>, "entities">,
  data: Record<string, unknown[]>,
): Record<string, { list, get, create, update, delete }>;
```

In-memory CRUD client backed by plain arrays. Methods:

- `list(params?)` -- returns all items
- `get(id)` -- find by id, rejects if not found
- `create(dto)` -- appends with auto-generated UUID id (contrast: the MSW `deriveMockHandlers`
  path above uses numeric auto-increment ids)
- `update(id, dto)` -- merges fields, rejects if not found
- `delete(id)` -- removes, rejects if not found

### waitForQuery(queryClient, queryKey, options?)

```ts
async function waitForQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  options?: { timeout?: number },   // default: 5000
): Promise<void>;
```

Polls every 10ms until query leaves "pending" status. Throws on timeout.

---

## How the codegen path wires the API (Orval + boot)

The signatures above describe the framework surface. The codegen path does **not** hand-author
contracts or call the derivers — it generates clients with **Orval** and routes them through the
**simplix-boot** profile. This is the path you will actually read and edit.

### Generated clients + boot mutator

- **Codegen is Orval** (`orval` v8.5.3). Each domain's `src/generated/` holds Orval output;
  `packages/domain-*/src/hooks/` **re-export** the generated React Query hooks.
- Every domain's `src/mutator.ts` returns `getMutator("boot")<T>(url, options)` (simplix-boot
  profile). `bootMutator` unwraps the Boot envelope `{ type: "SUCCESS", body: { content: [...] } }`;
  a non-`SUCCESS` envelope throws `ApiResponseError`.
- Because the mutator already unwraps, a React Query hook's `data` is the DTO directly — multi-step
  access like `query.data?.data?.body` resolves to `undefined`. Orval's response type
  (`{ data: GetXxx200; status: 200 }`) exists only at the type level.

### List adapter + paging + sort

- `adaptOrvalList` (from `@simplix-react/ui`) reads the already-unwrapped `.body.content`. If a
  domain's `mutator.ts` still uses the default `getMutator()` instead of `getMutator("boot")`,
  `content` is `undefined` and the list renders empty. (See `scaffold/overview.md` for the
  diagnosis/fix.) The read-side (detail) counterpart is `adaptOrvalGet`, which re-types a
  boot-unwrapped `useGet*` query so `data` is the plain DTO (`T | undefined`) — it is runtime-safe
  (returns the same query object, only the static type narrows). Companion mutation adapters:
  `adaptOrvalCreate` / `adaptOrvalUpdate` / `adaptOrvalDelete` / `adaptOrvalOrder`.
- Sort tokens are **dot-separated**: `field.direction` (e.g. `name.asc`), not `field:direction`
  and not `field,direction`. The generated client types `sort` as `string[]`, so a comma form
  typechecks; the parser then splits the array element on the comma, finds two entries where it
  expected one, and refuses the whole request with a sort-format error naming only the field.
  **The screen shows no sign of it**: the list hook reads an error envelope as an empty page, so
  the panel draws its "nothing registered" empty state, and the network tab shows a 200 because
  the envelope carried one. Nothing anywhere points at the sort parameter. When a list is
  unexpectedly empty, read the response **body**, not its status.
- Paging shape is the Spring-style `PagedResult`:

```ts
interface PagedResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page index
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
```

### The access-policy read, and what the route guard needs from it

The route guard renders a screen only when the access-policy snapshot holds a **user**, and
the adapter's default extraction reaches into the nested envelope for the permission map
alone — the user is left behind. Give the adapter a `transformResponse` that flattens the
envelope into the four keys the guard reads (`permissions`, `roles`, `isSuperAdmin`, `user`).

**Without it every request is 200, the console is clean, and the shell renders with nothing
inside it.** The permission map did arrive, so `useCan` answers correctly and the side nav
filters correctly — the two layers anybody would check are the two that work. Only opening
the application in a browser shows the empty frame; a route that answers 200 on every probe
and paints the shell is what this looks like from below.

### A hook that reads a governed endpoint carries its own permission

A shared hook that takes its permission from whatever screen called it asks for whatever
that screen is allowed — which is the wrong question, because the endpoint's rule is fixed
and the screen's is not. A change-history hook wired that way put a permission-refused
dialog over a correctly-rendered record for one role: the screen opened, the record drew,
and nothing said which request had been turned down.

**Put the condition next to the request** (invariant #61), naming the group the endpoint
itself requires. A caller then cannot forget it, and the hook stays right when a screen with
different permissions starts using it.

### Never call a mutation from an effect

React runs effects twice on a development mount, so an effect that opens something with a
`POST` sends it twice. Where the server has a uniqueness rule one of the two is refused, and
**the screen receives a success and a failure for the same action** — an error dialog over a
screen that also worked.

The fix is in two places and both are needed:

- **The server treats the second call as the same call** — catch the constraint violation
  and return the row that already exists, so the operation is idempotent for any client.
- **The screen requests once per target**, guarded by a `useRef` keyed on that target.

**Do not add the effect-cleanup cancellation flag here.** The second run makes no request,
so the first run's cleanup sets a flag that discards the only response there is, and the
screen sits on its loading state forever. Whether to accept a response is decided by the
same `ref`, never by a cancellation flag.

### Mock layer

Codegen mocks are neither `deriveMockHandlers` nor `createMockClient`. Each domain's
`src/mock/index.ts` builds an in-memory store with `createMockEntityStore<EntityDetailDTO>(seeds)`
(from `@simplix-react/mock`), wires the generated `create<Entity>Handlers`, and wraps responses
with `wrapEnvelope` (from `@simplix-react-ext/simplix-boot-auth`) so the mock returns the same
Boot envelope the real API does. The store exposes `listPaged(page, size, sort)` returning a
`PagedResult`.

For the framework-level mechanics behind any of the names above, defer to the `simplix-react`
skill — this section documents only how the codegen path composes them.
