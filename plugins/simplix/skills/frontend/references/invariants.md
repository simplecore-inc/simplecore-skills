# Non-Negotiable Invariants — the full forms

SKILL.md states every invariant's normative claim; this file carries the full mechanism,
failure story, and code for the ones compressed there, under the **same numbers**. Read an
invariant's full form here before arguing an exception to it, debugging a violation of it,
or implementing the pattern it names for the first time. Paths are relative to this
`references/` directory.

## #2 Boot mutator

API calls go through each domain's `src/mutator.ts`, which uses `getMutator("boot")` (the
`simplix-boot` profile). The full Boot envelope is `{ type: string; message: string; body:
T; timestamp: string; errorCode?: string | null; errorDetail?: ErrorDetail | null }` —
`type` is a **free string** (the success marker is the literal `"SUCCESS"`, NOT a closed
enum), and the DTO payload lives in `body`. The boot mutator unwraps this envelope (returns
`.body`) so React Query `data` is the plain DTO directly; `adaptOrvalList` then reads the
already-unwrapped `.body.content` for list hooks. Any envelope whose `type !== "SUCCESS"`
throws `ApiResponseError`. Never bypass the mutator or hand-roll fetch — and never re-access
`data.body` after unwrap (it resolves to `undefined`). See `scaffold/overview.md` Common
Issues for the one-time `getMutator("boot")` fix.

## #3 Query builder / params

NEVER hand-assemble query strings. In the hand-authored contract path, use the framework's
`simpleQueryBuilder` (unless custom pagination is required). In the Orval-codegen path (the
CLI default), list/sort/pagination params are produced by the generated request params —
`simpleQueryBuilder` is not used (see `framework/overview.md`). Either way, no ad-hoc query
string assembly. Paged list reads send `page` and `size` TOGETHER — some searchable-params
parsers reject a lone `{ size }`; confirm the pagination contract from the spec rather than
assuming `size` is independently optional.

## #11 SelectField async options

Gate rendering on both value AND options loading state. Never render with incomplete
options. Mechanism: a Radix-backed select whose options arrive AFTER first render does not
refresh its closed trigger — a value with no matching option renders an empty trigger and
stays empty even once options load. Gate the whole select on EVERY contributing query
(`aQuery.isLoading || bQuery.isLoading ? <Loading /> : …`), and derive a fallback selection
from the row's own data rather than an effect-populated map (effect state is empty on the
first render).

## #15 Chip filters — the sanctioned cases

`ChipFilter` is for bitmask fields or visual distinction; standard enum / FK uses
`type: "faceted"`. One more sanctioned chip case: **narrowing WITHIN a server-forced
scope** — a list locked to `field.in: "A,B"` takes a single-select `CrudList.ChipFilter` on
`field.equals` (the params AND together: no chip = whole scope, chip = one state inside
it). Requires the backend `@SearchableField` to allow BOTH `EQUALS` and `IN` on that
field — with only one allowed, the combination fails disguised as an empty result.

**And a fourth: a narrowing that reaches past the list.** A faceted filter lives inside
`CrudList.FilterBar`, so its value reaches exactly one request — the list's own. Where the
same narrowing also has to reach the tab counts, a census, a sibling list, or a set of
tiles above the list, it belongs on its own `useFilterBarState` held by the page and
rendered as a chip row, because that is the only state both the list and its neighbours can
read. **Converting one of these to a facet is the defect it looks like a fix for**: the rows
narrow and the counts above them do not, so a tab reads 228 over four rows and nothing on
screen says which of the two answers the question. Nothing errors and both halves are
individually correct.

**The test is one line of code, not a judgement**: does anything other than the list hook
read this filter's committed value? A page that passes it into a census hook, into a second
`useCrudList`, or into a `narrowed` flag that withholds the tab counts has answered yes.
Where the answer is no, it is a plain axis and it becomes a facet.

## #18 Column order — the one domain exception

A narrow domain exception to the mandatory column order is allowed only when a hidden
category IS the entity's primary data — e.g. an audit-log entity whose
actor/timestamp/field-change columns are the whole point of the list; surface those rather
than hiding them. The default ordering still applies to every other entity.

## #31 Standard page chrome

Every routed page starts from the crud-page shape (copy an existing scaffolded page and
strip what does not apply; never author a page from a blank file):

a. Page title/description registered via `usePageHeader({ title, description })` — NEVER a
   local `Heading` rendered as the page title.
b. Primary create action ("add X", "new request") lives in `usePageHeader`'s `actions`
   slot — never a local button row above the list. For tabbed pages, the header action
   drives the active tab's create dialog through props.
c. No ad-hoc padding on the page root (`className="p-4"` etc.) — the app layout owns page
   padding.
d. Panel-style list-detail pages render the `Stack flex` root directly — an extra
   `Container` breaks the flex height chain and un-pins the detail footer.
e. **Whatever `ListDetail.Detail` renders owns the scroll.** `ListDetail.Detail` is
   `overflow-hidden` by design — it never scrolls its own content. Its child MUST supply
   the scroll container, and there are exactly two ways to do that:
   - **Read/edit surfaces → `CrudDetail` / `CrudForm`** (header slot / `overflow-auto` body
     slot / pinned footer). This is the default for ANY panel showing entity data,
     including operator consoles and action panels — a panel that runs actions is still a
     detail surface.
   - **Custom editors (canvas, bitmap, timeline)** → `Stack fill` root + `Stack flex
     overflow="auto"` body, reproducing the same chain by hand.

   A panel whose root is a bare `Stack` / `Card` / `Section` (no `fill` + `overflow`) is a
   DEFECT even when today's data happens to fit: the content is silently clipped at the
   panel's height with no scrollbar, so actions below the fold become unreachable. It also
   drifts visually — hand-rolled title rows and close buttons instead of the standard
   detail chrome.

Exceptions: standalone screens outside the app layout (login), and thin wrapper pages that
delegate to a view component which itself owns `usePageHeader`. Full detection recipes →
`audit/audit-checklist.md` § Page Chrome Violations. A page whose header or create button
looks different from its siblings is a defect.

## #32 List screens are paged searchable

Before building ANY screen that renders a list, judge whether its row count can grow
(accumulating records, per-user histories, request queues — when in doubt, assume it
grows). If it can: (1) the backend exposes a standardized template-based paged searchable
endpoint (self-scoped/aggregated surfaces force scope conditions server-side on the same
searchable params); (2) the frontend is CLI-generated then customized — `useCrudList` +
`adaptOrvalList` with `CrudList.Table` / `CrudList.FilterBar` / `CrudList.Pagination`. A
hand-built table over an unpaged array endpoint is NOT an acceptable list screen; a plain
`Table` is reserved for provably bounded, small collections.

**Filtering, sorting and tab counts are the server's too — there is no small-enough
exception.** Not a fixed set, not a set that fits on one screen, not a condition the server
has no column for. Where the server cannot express the condition, that is **backend work**,
and until it is done the tab is disabled with the reason on it — the screen does not stand
in.

Filtering a page in the browser gets **three things wrong at once**: the row count, the
total, and the second page. All three are invisible while the whole set fits in one page,
and all three appear together the moment it does not — by which time the screen has been
photographed, reviewed and approved.

- **A condition with no column is resolved to identifiers before the query, not filtered
  after it.** A standing-state or role-membership filter that cannot be compared as a column
  is expanded into the ids it matches and forced into the search params. "There is no
  column" is the reason to resolve it early, never the reason to filter in the browser.
- **The total comes from the server** (`list.pagination.total`). Counting the rows on screen
  prints a number smaller than the truth and offers one page of a pager.
- **What this rule is about is rows a person reads as data.** A menu, an enum's options, a
  tab definition is not a record list; the test is not the size of the collection or the
  intent behind it.

## #33 A screen that shows a lifecycle must be able to drive it

For every entity-scoped action the backend exposes (`@PostMapping("/{id}/<action>")` and
friends), the UI must offer a way to reach it, and every state the UI shows must have an
exit. Before finishing a CUSTOMIZE task, diff the module's action endpoints against the
hooks the frontend actually calls, and check the states an entity can sit in for one with
no affordance out of it (a submit-for-approval that only a non-existent portal calls, an
assigned card whose only release path is a desk that lists today's rows, a settled week
nothing can resettle). A row that is stuck is a defect even when every screen renders.

## #34 A form writes what the create/update DTO accepts

A DTO field the form never edits is a field the user cannot fill, and if it drives the
entity's downstream behaviour the record is born broken (a visit whose participant list is
unwritable can never be checked in). Compare `FormValues` against the generated
`*CreateDTO` / `*UpdateDTO` and account for every field: edited, deliberately server-owned,
or deliberately out of scope. Ids the user cannot know (an `attachmentFileId`, an entity
reference) are never plain text inputs — they come from a picker or the framework file
field.

## #36 Server values are rendered, never echoed

A boot-enum object (`{type,value,label}`) fed into a `SelectField` renders blank and
submits an object (`??` never fires — the object is truthy; use
`resolveBootEnum(x) || "DEFAULT"`). **`??` fails at the other end of the same call too**:
`resolveBootEnum` answers an **empty string** for an absent value, which `??` also passes
through, so the select's value matches no option and the trigger renders blank. One
operator covers both — `||`, never `??`, on anything that comes out of `resolveBootEnum`. An `Instant` field rendered with the default
`DetailDateField` / `datePart` silently drops the time an approver needs. A raw id or ISO
stamp shown to a user is a machine value leaking through. Resolve enums, format instants
with `format="datetime"`, and title panels with an identifying value (a name), never an id.

## #38 A choice the server constrains is a choice the server must publish

When the backend narrows a set of values per record (a visit type's allowed check-in
channels, a policy's permitted actions), the read/readiness DTO for that record MUST carry
the narrowed set, and the UI builds its options from it. Rendering the full enum and
letting the server reject the pick is a defect: the operator has no way to know which value
would have worked, and the rejection message is the only feedback. Same rule for a resource
pool (cards, seats): the picker offers only what is actually assignable, and an auto-pick
that hits an unusable candidate retries rather than failing at the first one. And a state
that ends the flow (checked out, cancelled, closed) hides the form that drives it —
`presence === "X" ? A : B` is a two-state assumption that silently offers a dead action for
every third state.

## #39 A list filter is the operator's index

The scaffold emits a filter per searchable field, including the entity's UUID and the
`createdAt` / `updatedAt` audit stamps. No operator searches by those. Prune them, add the
axis the persona actually searches by (the person's name, not just the owner's), and lay
the survivors out in 2–3 columns (`popoverColumns` + `columnBreak`) once the form scrolls.
When the search axis is a field of an internalized child (a participant's name on a visit),
give the SearchDTO a `@SearchableField` over a read-only association on the parent — and
NEVER name that association the same as a DTO collection the entity's create/update path
maps (ModelMapper will bind transient children onto it and the save fails at flush).

## #40 Failure messages are a product surface

A user-facing exception carries a message key (`"{error.<module>.<case>}"`), resolved at
the HTTP layer, with every locale filled; a literal English string thrown from a service
reaches the user's dialog verbatim. Enum labels resolve through the enum resolver
(`LabeledEnum#getLabel` / `EnumMessageResolver`), not the application `MessageSource` — the
`messages/enums` bundles are not on its basename list. And the dialog leads with the
server's concrete reason; a generic per-code line is a fallback for a message-less error,
never a companion to one.

## #41 One search form everywhere

Every screen-level query condition renders through the standard FilterBar: list screens via
`useCrudList`'s `filters`, and non-CrudList surfaces (aggregation reports, dashboards,
required-param queries) via the standalone `useFilterBarState` hook with params derived
from `committedValues`. An inline `FormFields.*` row acting as a report's search conditions
is a defect. The total badge is the FilterBar `count` prop (it renders the shared
`ListTotalBadge`) — never a hand-placed badge in `leading`, which is reserved for extra
summary content (aggregate totals, a pending-count badge). On a page with a status-card
strip, tab bodies carry no `StatusCard`s of their own — tab aggregates live on this toolbar
line. Detection recipes → `audit/audit-checklist.md` § 11.

## #43 Badge density parity

Badges on detail/form surfaces render at the SAME size as the list's. `StatusBadge` (and
domain wrappers built on it) defaults to `size="sm"` (`text-xs`) — omit `size` and the
three surfaces align; base `Badge` already matches. Explicit `size="xs"` only in genuinely
denser contexts (legend, live strip, high-density status table). Never enlarge a
detail/form badge (`size="default"`, `text-sm`/`text-base` classNames).

## #44 The component's real prop contract — recurring traps

`DetailTextField` has no `children` (custom-rendered detail values use
`DetailFieldWrapper`); `Flex`/`Stack` `wrap` is a boolean (`wrap`, not `wrap="wrap"`);
`ConfirmDialog` supports neither `children` nor `hideConfirm` (custom-content dialogs
compose `Dialog`/`DialogContent` directly). A prop you expected but cannot find means read
the component source — never typecast past it.

## #45 Peek dialogs are host-mounted

A `DetailPeekDialog` kept inside the subtree that triggered it (a list cell, a mapped row,
a card in a refetching panel) is unmounted the moment that subtree re-renders, so it closes
itself within seconds of opening; the surfaces that show references are exactly the ones an
activity stream keeps invalidating. Every `*PeekLabel` dispatches through `usePeekHost()`
from the project UI package's peek segment, and the `PeekHost` provider wraps the routed
tree once in the app's provider stack. Labels take no `onPeek` prop and hold no open state.

- **A new peek label follows the same shape**: export the dialog as its own component and
  have the label's trigger call
  `peek.open({ render: ({ open, onOpenChange }) => <XPeekDialog … /> })`. The host is
  kind-agnostic, so a module's own entity needs no registration.
- Hand-rolled peeks (`usePeekTarget` + `DetailPeekDialog` at a widget root) remain valid
  for a one-off trigger that is not a reusable reference label — the state is already
  outside the row. Never place one inside a cell render or a `.map()` callback.

## #46 Delete is cloned, gated, and human-named

Wire deletion by cloning an existing `useCrudDeleteWired` + `adaptOrvalDelete` +
`{deleteDialog}` page, on EVERY crud-page variant (page AND panel — one-variant wiring
makes deletability depend on screen shape). A detail's `onDelete` activates only when
`onDeleted` exists (`onDelete={onDeleted ? del.requestDelete : undefined}` — no dead
buttons on callback-less renders). The dialog names the record with a human-readable value
(a resolver or a related entity's name, readable fallback), never a raw id. An irreversible
purge (anonymization / PII erasure) is a visually distinct action (own icon/tone) with a
type-the-name confirmation the server re-validates, and its dialog states the
delete-vs-purge difference and scope. Server-side blocks (referential/legal) surface their
SPECIFIC message key — what references it and how many — never a generic integrity phrase.

## #47 A widened operator read never crosses the trust boundary

When an operator surface needs the full gate picture (screening, identity verification,
compliance, capacity), that widened read (e.g. a `readiness`) is NOT shared with
data-subject-facing surfaces (portal / kiosk / public). Those call a narrow read listing
only what the subject can act on (approval, agreements, trainings). Sharing the wide read
leaks internal verdicts (watchlist hits, identity failures) to the subject, inverts
`ready`-style flags into dead-end loops on conditions the subject cannot fix, and
multiplies SPI/screening cost per candidate. The backend splits the two reads; each screen
wires its own.

## #48 Red badges mean "act now"

A red notification badge (`Badge variant="destructive"`, round) counts ONLY a set the
viewer must act on; informational counts (totals, per-status tab distribution) are muted
`tabular-nums` spans. Nav, sidebar, and tab badges counting the same set share the same
query figure and the same red treatment, and demote to muted at 0 (no red zero). The screen
a badge leads to opens BY DEFAULT on exactly the set the badge counts — a badge of N
landing on a default view showing 0 rows is a wiring defect. Tab/nav counts read
`totalElements` from a `size: 1` list query (cache-shared with the list).

## #49 Always-open master-detail boards

An operator board whose detail must never close composes `ListDetail` with a constant
`activePanel="detail"` + `listWidth` (fixed list column, detail fills the rest), and the
detail panel component's `onClose` is optional and omitted — with no `onClose`, no close
affordance renders. Select the first item on entry; when the selected item leaves the list
(processed), fall back to the new first item, and when the list empties, clear the
selection and swap to a full-width `EmptyState`. Judge selection survival by item id, never
by index — index survival silently selects a different record on refetch.

## #50 Reference cards vs workstation cards

A read-only reference card on a detail panel (screening verdicts, declared items, vehicles
— "read it if present" data) renders nothing when it has no rows; a card holding only a
"none" line is noise. A card that carries actions (an assignment workstation) always
renders, holding its empty-state line plus the hint that explains why its action is
currently unavailable. Custom row-action buttons outside the framework action column match
the row-action size (`size="xs"`) and join into ONE segmented group (`gap="none"`, `-ml-px`
neighbor overlap, outer-corner-only rounding, `whitespace-nowrap`) — a run of individual
`size="sm"` buttons inflates row height and wraps.

## #52 Every action affordance is permission-gated

A button that leads to a call the server will refuse must not render. Read the group from
the module's `src/shared/auth/subjects.ts` (`SUBJECTS.<screenKey>`), mirroring the
backend's `hasPermission('<group>', '<action>')`, and gate with
`useCan("<action>", SUBJECTS.<screenKey>)` from `@simplix-react/access/react` — never a
group literal inline, so a screen's gate and the server's rule move together. Create
affordances: the page-header create button on BOTH header variants (page and panel — gating
one leaves the other open), a tree's per-row `add-child`, and any create button composed
into an action group (drop the button out of the group, not the whole `actions` entry). The
scaffold emits the gate and the CLI creates an empty `subjects.ts` when a module has none,
so a missing entry is a compile error on the generated page — supply the real group, never
a plausible one. The audit script (`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`)
fails on an ungated `showNew`.

## #53 Detail-row enums go through `DetailBadgeField`, resolved first

The component looks its tone up by the RAW `value` (`variants[value] ?? "default"`), so
handing it the boot-enum object the DTO carries makes every lookup miss: the badge renders
`default` however the variant map is written, while `displayValue` still shows the right
label. The failure is silent and reads as a broken tone map. Pass
`value={resolveBootEnum(x) ?? ""}` beside
`displayValue={enumLabel("<EnumType>", resolveBootEnum(x) ?? "")}`; the scaffold emits the
unresolved form (`value={displayData.<field>}`), so every generated detail needs this fixed
at customization time.

**A nullable enum row uses `DetailBadgeField` too, never a bare badge inside
`DetailFieldWrapper`.** Module badge shells (`StatusBadge` / `EnumBadge` wrappers over
`resolveBootEnum`) return `null` for an absent value — right in a list cell or an inline
flex row, but inside a `DetailFieldWrapper` it leaves a silently blank row while every
sibling `DetailFields.*` row shows the shared no-value badge. For a detail or dialog row
whose enum can legitimately be absent (a verdict that exists only when something matched),
render `DetailBadgeField` with `value={resolveBootEnum(x) || null}` so the empty state goes
through the shared fallback. A row whose enum is always present may keep the
wrapper-plus-badge shape.

## #54 The scaffold emits fields that say nothing

A SimpliX-backed entity carries `deleted` and `deletedTimestamp`, and the scaffold turns
both into a list column, a `cardContent` row, and a detail field. They carry no
information: a soft-deleted row is filtered out of the list, so the flag always reads false
and the stamp always reads `-1`. Strip them from the column set, the `cardContent` block,
the detail section, the form, and the filter set, then clean up the imports left unused.
Same treatment for the entity PK and the audit quartet (`createdAt` / `createdBy` /
`updatedAt` / `updatedBy`) — `CrudDetail`'s `auditData` slot already carries those. The
framework has no declarative "hidden by default": `hiddenColumns` is a runtime toggle the
operator can open, so hiding means removing from source.

## #55 Contact messages are written twice

Deployment-configured addresses (sales, support, an escalation path) are optional fields on
a settings read, and the chrome that displays them hides them when they are absent. A
single message saying "get in touch" then leaves the reader instructed to do something the
page gives them no way to do, worst on a public surface where they have no other channel.
Write both variants (`<key>` and `<key>NoContact`), choose between them in ONE shared hook
that owns the read (`useContactText(withContact, withoutContact, params)`), and route every
such message through it. A codebase that gates one message this way and not the next two
has the defect, not the convention. The check when writing any such string: does this page
render the address it just told them to use?

## #60 A context-owning package resolves to ONE copy

`createContext` at module scope makes one context object per physical copy of the
package, and pnpm answers two importers with two copies whenever their peer sets
differ: an app declaring `simplix-react` and a module declaring `@simplix-react/ui` is
enough. The provider one copy renders is then invisible to the consumer that imported
the other, and **nothing throws** — the consumer silently takes its default. A page
served from a `modules/*` package registers its title through `usePageHeader` while the
shell reads an empty provider, so the screen renders with no heading and no create
button and every line of the source is correct; the same split produces "No QueryClient
set", a toast that never appears, and a translation that stays a key.

The list in the project's bundler config (`resolve.dedupe`) must name the FRAMEWORK
packages — `@simplix-react/ui` first — not only `react` and TanStack, because a
workspace that consumed the framework through a single local checkout could never hit
this and the list written under those conditions does not name them.

- **Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-duplicate-contexts.mjs"` after ANY
  change to dependency resolution** — a version bump, a new dependency, switching a
  local-link profile to the registry, any `pnpm install` that rewrites the lockfile. It
  reports same-version copies of directly-depended packages whose code creates a context
  and which the dedupe list does not name; different major versions living side by side
  are ordinary resolution and are not reported.
- **Missing chrome has TWO causes, and WHICH pages lost it tells them apart before you
  touch anything.** Duplication takes out every page past the package boundary — the
  app's own pages keep their header while every `modules/*` page loses it. When only
  SOME pages lose it with no boundary in common, the cause is in the hook rather than in
  resolution: a cleanup that empties the store without forgetting what it installed
  loses the second publish of React's development remount rehearsal, so only pages whose
  title and description never change after mount render nothing. Run this audit first
  because it is one command, then read the installed hook's source and compare against a
  sibling project on a different framework version. Report neither from reasoning alone —
  in the DOM, an ABSENT header element means no title ever reached the store, a PRESENT
  but blank one means it arrived empty.
- Findings under React Native / Expo names are real duplicates too, but Metro bundles
  those — the Vite dedupe list does not reach them, so fix them in the RN toolchain.
- **How the second copy arrived decides the fix.** A peer-hash split of one registry
  version (what the script reports) is fixed in the dedupe list. A **linked local
  checkout** answering its own peer imports beside registry copies is fixed in the
  install — link the whole framework scope or none of it; the diagnosis by loaded
  resources and the leftover-symlink sweep are in `framework/overview.md` § One physical
  copy per framework package, together with the framework-side `globalThis` anchoring
  rule that keeps a duplicate copy from becoming a correctness failure.

## #61 Hiding a surface is not the same as not asking for it

A hook runs wherever it is written. Gating only what a component *renders* leaves the
request it makes untouched, so a screen that correctly hides a feature it did not buy
still calls the endpoint that feature owns — and the server refuses. What the user sees
is a bare "access denied" dialog over a panel showing nothing that could explain it, on
a screen that is otherwise entirely theirs to use. The half that did the hiding believes
it is finished, because from inside that component the affordance really is gone.

**Put the condition where the request is.** The hook's own `enabled`, or the shared
factory's `useEnabled` — not the route, not the parent that composes the widget. A gate
at the composing layer is a rule the NEXT caller has to remember; a gate inside the hook
is one they cannot get wrong. When the same read is offered as several primitives (a
picker, a facet, a name lookup over one roster), route all of them through one predicate
so a new primitive inherits the gate rather than reintroducing the hole.

**Check the framework before inventing a channel.** Entity-search and entity-facet
factories commonly already take a `useEnabled`; query hooks take `enabled`. Reaching for
those keeps the gate one line and keeps hook order stable, which a conditional call
would not.

**Drop the affordance as well as the request.** A filter or picker left standing with an
empty option list reads as "failed to load", not as "your tier does not include this" —
the reader retries, then reports a bug against a screen that is behaving exactly as
designed. Remove the control, or replace it with a sentence naming what is missing.

Three shapes this takes, all found in one afternoon on one product:

| Shape | Where it hid | What still fired |
| --- | --- | --- |
| Tab bodies gated, list hooks at component top | detail panel with log tabs | both list searches |
| Composing route gated, draft hook above it | account detail with a scoped section | the scope read, twice |
| Feature-owned picker on a base-edition screen | customer list filter and form field | the roster search |
| Chrome sourcing a list from an admin endpoint | app shell, every role | the administrative search, at sign-in |

**The chrome row is the worst of the four, because it fires for everybody.** A shell reads
the signed-in account and whatever it needs to draw itself; the moment one of those reads
comes from an administrative endpoint, **every role without that permission meets a
refusal dialog on the first screen after signing in** — before touching anything. The rule
generalizes past hooks: **a surface hidden from a role is not requested on that role's
behalf either.** Chrome takes its data from reads no role can be refused — the account's
own permission set, and whatever the shell's own endpoint returns for the caller. Where the
shell needs a list, the read that serves it returns the caller's own scope rather than the
administrator's.

**Detecting this mechanically is left undone on purpose.** The shape — "a hook whose
value is used only inside a conditional" — describes far more legitimate code than
defective code (loading states, empty states, every optional panel), and the part that
makes it a defect is that the endpoint is gated, which no static rule can see without
the project's own gate vocabulary. A rule that fires on the correct cases teaches the
reader to ignore it. Find these by driving the screens as an account that lacks the
thing, and watch for a refusal dialog with nothing behind it.

## #66 A field that names another record peeks at it, never travels to it

A detail field, a list cell or a panel row whose value is the NAME of another record
renders that name plus the peek trigger, and the trigger opens that record's detail in a
host-mounted dialog (#45). The dialog's go-to action is the only way out of the screen the
reader is on. A viewer with no grant to read the referenced record keeps the name and
loses the trigger — never a control that comes back refused.

**What goes wrong is not that the reader cannot get there. It is that they arrive.**
Somebody reading a record presses the name of a thing it refers to, to check one value,
and the record they were reading is gone — its tab, its scroll position, its filters, and
whatever they had half-decided. Nothing errors and the label was correct, so the only
thing that noticed is the reader's own memory of where they were.

**Two shapes, and the second does not even navigate:**

| Shape | What it does |
| --- | --- |
| `<Link>` (or a `variant="link"` button wrapping one) inside a detail field | leaves the screen |
| a link-styled button wired to the panel's own `onSelect` / `showDetail` | replaces the record under the reader — same panel, same chrome, different subject |

**A link is right when the destination is a screen rather than a record** — a canvas, a
register, a wizard, a filtered roster. Those belong in the panel's action row, not in a
field: a field's value is a value, and a control sitting where a value belongs is read as
that value.

**Peeks stack.** A reference inside a peek dialog is a reference like any other, so the
host pushes rather than replaces and its close pops one level. Without that, walking two
steps down a tree and pressing 「close」 drops the reader to the bottom of the pile.

**The failure mode this invariant exists for is disuse, not misuse.** On one product the
peek host, the trigger button and the dialog were built, reviewed and wired into the app
root — and then exactly ONE label used them. Every screen written in the months after
reached for a router link instead, because a link is what a reference looks like
everywhere else on the web, and nothing failed when they did. By the time anybody counted,
the wireframe board drew 225 reference fields and the code held one. **A convention that
has to be remembered at each field is kept the day it is written and broken every day
after** — so the moment the machinery exists, the rule that every reference goes through
it needs a detector, not a paragraph.

**Which value gets one is decided by the domain model, not by the label.** A field is a
reference when it carries a foreign key — when its value identifies a record of another
entity, or another record of the same entity. The generated DTO types are the evidence,
because they are what the server actually sends. Three cases decide themselves once that
is the test:

| The value | Peek? | Why |
| --- | --- | --- |
| a foreign key (`parentOrgId`, `siteId`, `grantedBy`) | yes | it names a record somebody can open |
| the parent of the same entity | yes | a different record, and the reader is walking a tree |
| a denormalized name snapshot (`actorUsername`, 「그때 그렇게 읽혔다」) | no | it records what was true then; today's record may not match, and opening it would answer a question nobody asked |
| an enum | no | a value, not a record |
| a count (`21명`) | no | it names no record — it points at the list that does |

**The two shapes, and one question decides which: does the trigger stand alone in its own
region, or does it sit at the end of a value?** Standing alone — a card, a footer action
row — it takes `appearance="inline"`, an outline button carrying the label and the icon,
because nothing precedes it to say what it opens and nothing beside it for a word to crowd.
Sitting at the end of a value — a detail field, a list column, a detail-list row, a section
header's trailing slot — it takes `appearance="icon"`, because the word takes the width the
value needs: a bordered button at the end of a two-column detail row truncated the name the
row exists to show to 「대한건설…」 while the control for opening it stayed whole, and a
column of them left the panel with two right edges.

**The two ways to get this wrong are opposite, and both were made on one screen in one
day.** Reading the rule as 「the label is for cards」 strips the footer's verbs to identical
glyphs in an empty band, which a sighted reader cannot tell apart at all. Reading it as
「the label is for anything with a label beside it」 puts a button at the end of every detail
row and eats the values. What separates them is neither the component nor the container but
the question above: is there something in front of this control already saying what it is
about? The default is `"icon"`, so a
trigger written without thinking about its place is right rather than loud.

**An icon-only trigger names what it opens.** With the label gone, `aria-label` is all a
screen reader has, and a detail panel or a list column holds several triggers whose label
is the same word — pass `target` so the name is 「남부현장 보기」 rather than the fourth
「보기」 on the screen.

**A dialog holds the referenced record's whole detail, tabs included** — not a summary
somebody chose six fields for. A summary is a second description of the record that drifts
from the first, and the reader who opened it to check one thing usually needs the next
thing too. This makes each peek cost what that entity's detail component costs: where none
exists yet, the reference waits for the chapter that builds one rather than getting a
hand-written card.

**That detector belongs to the project, not to this script.** The shape is mechanically
plain — a `<Link>`, or a call to the surrounding panel's selector, inside a
`DetailFieldWrapper` — but the fix names components (`PeekTriggerButton`, `usePeekHost`)
that live in the project's own UI package and are absent from a project that has not built
them. `audit-frontend.mjs` runs against projects with no peek machinery at all, where the
finding would name a component that does not exist. Put the rule in the project's own gate
script, and prove it on the broken form and the fixed form there.

## #70 A sentence holding a value that can be absent is judged by the value, not by the record

`t("closure.confirmTitle", { site: site?.siteName ?? "" })` against 「사업장 종료 — {{site}}」
renders an em dash with nothing after it. Nothing throws, the type is satisfied, and the build is
green — `?? ""` is what makes it typecheck and it is also what makes the hole. **Everybody meets
it, not only a reader whose scope withholds the value**: the value arrives with a fetch, so the
first paint of every one of these is the broken one.

**Guard the value, never the record.** `record ? <p>{t(…)}</p> : null` is the wrong test — it is
already true in the case that ships, where the record loaded and the field came back null. The
condition names `record?.fieldName`.

**Two shapes, and the sentence decides which.** Read what is left once the value is substituted
away:

- **The sentence means nothing without it** — 「{{version}} 버전을 설치합니다」. Do not render that
  clause until the value is there. Narrow the condition to the clause, not to the panel around it.
- **The sentence stands without it** — 「번역률 {{rate}}%」 still says what it says with a name
  missing from the front. Give it a paired key with no interpolation (`title` / `titleUnnamed`),
  and pick between them at the call site.

A paired key goes into every locale that has a catalogue for it, and any generated pseudo-locale is
rebuilt afterwards.

**Never apply one shape across the whole finding list.** Twenty-five call sites sorted by which of
the two they are produce twenty-five sentences somebody meant; twenty-five given the same treatment
produce a screen nobody designed. Where a value has a second-best form — an equipment record with
no name but a management number, on a confirmation the operator reads to check what is about to be
destroyed (#46) — the fallback is that value, not the paired key.
