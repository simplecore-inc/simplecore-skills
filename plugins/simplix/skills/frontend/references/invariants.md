# Non-Negotiable Invariants - the full forms

SKILL.md states every invariant's normative claim; this file carries the full mechanism,
failure story, and code for the ones compressed there, under the **same numbers**. Read an
invariant's full form here before arguing an exception to it, debugging a violation of it,
or implementing the pattern it names for the first time. Paths are relative to this
`references/` directory.

## #1 Contract-first

SKILL.md item 1 states this invariant in full; it has no longer form here.

Enforcement: review - a hand-written hook looks like any other hook in a TSX file; whether a generated one already covers the call is a fact about the domain package's contract, not about the file's text.

## #2 Boot mutator

API calls go through each domain's `src/mutator.ts`, which uses `getMutator("boot")` (the
`simplix-boot` profile). The full Boot envelope is `{ type: string; message: string; body:
T; timestamp: string; errorCode?: string | null; errorDetail?: ErrorDetail | null }` -
`type` is a **free string** (the success marker is the literal `"SUCCESS"`, NOT a closed
enum), and the DTO payload lives in `body`. The boot mutator unwraps this envelope (returns
`.body`) so React Query `data` is the plain DTO directly; for a list hook that is the page
itself, and `adaptOrvalList` reads its rows from `data.content`. Any envelope whose `type !== "SUCCESS"`
throws `ApiResponseError`. Never bypass the mutator or hand-roll fetch - and never re-access
`data.body` after unwrap (it resolves to `undefined`). See `scaffold/overview.md` Common
Issues for the one-time `getMutator("boot")` fix.

## #3 Query builder / params

NEVER hand-assemble query strings. In the hand-authored contract path, use the framework's
`simpleQueryBuilder` (unless custom pagination is required). On a codegen path (`orval` or
`meta`, whichever the project's config declares), list/sort/pagination params are produced by the
generated request params - `simpleQueryBuilder` is not used (see `framework/overview.md`). Either way, no ad-hoc query
string assembly. Paged list reads send `page` and `size` TOGETHER - some searchable-params
parsers reject a lone `{ size }`; confirm the pagination contract from the spec rather than
assuming `size` is independently optional.

## #6 Snapshot before regenerate

SKILL.md item 6 states this invariant in full; it has no longer form here.

Enforcement: review - it is a step carried out before a command runs, and no file records that it happened.

## #7 Live API over local JSON

SKILL.md item 7 states this invariant in full; it has no longer form here.

Enforcement: review - which URL `simplix.config.ts` points at and whether a local JSON stands in for it is a fact about the environment the codegen ran in, not about any source line.

## #11 SelectField async options

Gate rendering on both value AND options loading state. Never render with incomplete
options. Mechanism: a Radix-backed select whose options arrive AFTER first render does not
refresh its closed trigger - a value with no matching option renders an empty trigger and
stays empty even once options load. Gate the whole select on EVERY contributing query
(`aQuery.isLoading || bQuery.isLoading ? <Loading /> : …`), and derive a fallback selection
from the row's own data rather than an effect-populated map (effect state is empty on the
first render).

Enforcement: review - whether a select's options arrive after the first render depends on the queries behind them, which a line scan cannot follow through the hooks that build the options.

## #15 Chip filters - the sanctioned cases

`ChipFilter` is for bitmask fields or visual distinction; standard enum / FK uses
`type: "faceted"`.

**The key's operator is set by the installed `ChipFilter`'s selection mode**, read from the
`@simplix-react/ui` the screen resolves (its `package.json`):

| Selection mode | Release | Key | Value written |
|---|---|---|---|
| multi-select - a second chip widens the narrowing, a lit chip drops its value | 0.3.9 and later | `field.in` | an array; nothing with every chip off |
| single-select - a `columns` grid, pressing the lit chip clears it | 0.3.8 and earlier | `field.equals` | one value |

A row where exactly one pill is chosen, in 0.3.9 and later, is `ChoiceChips` (`value` /
`onChange`, no filter key); a value it hands to a query goes under `field.equals`.
`audit-frontend.mjs`'s `chip-filter-equality-field` reports an `.equals` chip key wherever the
file resolves the multi-select row and stays silent where it resolves the single-select one.

One more sanctioned chip case: **narrowing WITHIN a server-forced scope** - a list locked to
`field.in: "A,B"`. How the chips narrow it follows the same selection modes:

- **Multi-select.** The chips write `field.in`, which is the forced scope's own key, so they
  cannot sit in the list's filter state beside the scope: two values under one key leave the one
  merged first unread. Hold the chip row on a page-level `useFilterBarState`, read
  `chipFilterValues(state, "field.in")`, and force `field.in` to the chosen values when any
  chip is lit and to the whole scope when none is. Offer only the scope's own values as chips.
- **Single-select.** A `CrudList.ChipFilter` on `field.equals` (the params AND together: no
  chip = whole scope, chip = one state inside it). Requires the backend `@SearchableField` to
  allow BOTH `EQUALS` and `IN` on that field - with only one allowed, the combination fails
  disguised as an empty result.

**And a fourth: a narrowing that reaches past the list.** A faceted filter lives inside
`CrudList.FilterBar`, so its value reaches exactly one request - the list's own. Where the
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

## #17 Backend DTO verification

SKILL.md item 17 states this invariant in full; it has no longer form here.

Enforcement: review - it joins the filter fields a screen declares with the fields the backend DTO exposes, two codebases; `simplix meta-info <Entity>` prints the backend side for the reader.

## #18 Column order - the one domain exception

A narrow domain exception to the mandatory column order is allowed only when a category the
list otherwise leaves out IS the entity's primary data - e.g. an audit-log entity whose
actor/timestamp/field-change columns are the whole point of the list; surface those rather
than removing them (#54). The default ordering still applies to every other entity.

Enforcement: review - the order is judged by each column's category, and a column's category (an identifier, a relation, a metric) is a property of the field's meaning, not of its source text.

## #19 User confirmation before restyling

SKILL.md item 19 states this invariant in full; it has no longer form here.

Enforcement: review - it is a step in the conversation with the user, and nothing in the source records that it happened.

## #24 Diataxis single-type

SKILL.md item 24 states this invariant in full; it has no longer form here.

Enforcement: review - a document being exactly one of the four types is a judgment about what its reader is doing with it.

## #25 Language policy

SKILL.md item 25 states this invariant in full; it has no longer form here.

Enforcement: review - which notes are public-facing and which are internal is the project's own call, and a Hangul scan cannot tell a README from an internal note.

## #26 Official terminology

SKILL.md item 26 states this invariant in full; it has no longer form here.

Enforcement: review - a synonym for `contract`, `entity`, `operation`, `derive`, `hook` or `mock handler` cannot be told by a pattern from the same word used correctly in another sense.

## #28 Result-first writing

SKILL.md item 28 states this invariant in full; it has no longer form here.

Enforcement: review - whether a sentence opens with what a thing does or with how it works is a judgment of meaning.

## #29 Backend-change gate

SKILL.md item 29 states this invariant in full; it has no longer form here.

Enforcement: review - the gate compares the backend's current contract with the last codegen; the check is the Detect command in the item (codegen, then `git status` on the generated directory), a command run by the author, not a rule over source text.

## #31 Standard page chrome

Every routed page starts from the crud-page shape (copy an existing scaffolded page and
strip what does not apply; never author a page from a blank file):

a. Page title/description registered via `usePageHeader({ title, description })` - NEVER a
   local `Heading` rendered as the page title.
b. Primary create action ("add X", "new request") lives in `usePageHeader`'s `actions`
   slot - never a local button row above the list. For tabbed pages, the header action
   drives the active tab's create dialog through props.
c. No ad-hoc padding on the page root (`className="p-4"` etc.) - the app layout owns page
   padding.
d. Panel-style list-detail pages render the `Stack flex` root directly - an extra
   `Container` breaks the flex height chain and un-pins the detail footer.
e. **Whatever `ListDetail.Detail` renders owns the scroll.** `ListDetail.Detail` is
   `overflow-hidden` by design - it never scrolls its own content. Its child MUST supply
   the scroll container, and it is supplied in one of these ways:
   - **Read/edit surfaces → `CrudDetail` / `CrudForm`** (header slot / `overflow-auto` body
     slot / pinned footer). This is the default for ANY panel showing entity data,
     including operator consoles and action panels - a panel that runs actions is still a
     detail surface.
   - **Custom editors (canvas, bitmap, timeline)** → `Stack fill` root + `Stack flex
     overflow="auto"` body, reproducing the same chain by hand.

   A panel whose root is a bare `Stack` / `Card` / `Section` (no `fill` + `overflow`) is a
   DEFECT even when today's data happens to fit: the content is silently clipped at the
   panel's height with no scrollbar, so actions below the fold become unreachable. It also
   drifts visually - hand-rolled title rows and close buttons instead of the standard
   detail chrome.

Exceptions: standalone screens outside the app layout (login), and thin wrapper pages that
delegate to a view component which itself owns `usePageHeader`. Full detection recipes →
`audit/audit-checklist.md` § Page Chrome Violations. A page whose header or create button
looks different from its siblings is a defect.

## #32 List screens are paged searchable

Before building ANY screen that renders a list, judge whether its row count can grow
(accumulating records, per-user histories, request queues - when in doubt, assume it
grows). If it can: (1) the backend exposes a standardized template-based paged searchable
endpoint (self-scoped/aggregated surfaces force scope conditions server-side on the same
searchable params); (2) the frontend is CLI-generated then customized - `useCrudList` +
`adaptOrvalList` with `CrudList.Table` / `CrudList.FilterBar` / `CrudList.Pagination`. A
hand-built table over an unpaged array endpoint is NOT an acceptable list screen; a plain
`Table` is reserved for provably bounded, small collections.

**Filtering, sorting and tab counts are the server's too - there is no small-enough
exception.** Not a fixed set, not a set that fits on one screen, not a condition the server
has no column for. Where the server cannot express the condition, that is **backend work**,
and until it is done the tab is disabled with the reason on it - the screen does not stand
in.

Filtering a page in the browser gets **three things wrong at once**: the row count, the
total, and the second page. All three are invisible while the whole set fits in one page,
and all three appear together the moment it does not - by which time the screen has been
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
reference) are never plain text inputs - they come from a picker or the framework file
field.

**The generator holds this, and `simplix check-screen` proves it on the written files.** The form's
field table is built from the create body: every field the body requires is in the table and marked
`required: true` (a boolean switch always holds a value and is not marked), a string whose contract
allows 500 characters or more is `longText`, and a reference is edited through the picker the
project names for its entity (`scaffold.referencePickers.<peekKind>.hook`). A required key whose
record is not nested beside it still stays in the form: left out, every create the form sends is
refused. A form edited by hand after the scaffold is judged by the same check, so a dropped field or
a lost mark fails before a browser shows it.

## #35 Edit is a state, not a button

SKILL.md item 35 states this invariant in full; it has no longer form here.

Enforcement: review - which condition the server enforces and whether the UI gates on the same one is a join between the backend lifecycle and the screen; the visible half, a row action that hides itself with `when`, is reported by `row-action-that-only-some-rows-draw`.

## #36 Server values are rendered, never echoed

A boot-enum object (`{type,value,label}`) fed into a `SelectField` renders blank and
submits an object (`??` never fires - the object is truthy; use
`resolveBootEnum(x) || "DEFAULT"`). **`??` fails at the other end of the same call too**:
`resolveBootEnum` answers an **empty string** for an absent value, which `??` also passes
through, so the select's value matches no option and the trigger renders blank. One
operator covers both - `||`, never `??`, on anything that comes out of `resolveBootEnum`. An `Instant` field rendered with the default
`DetailDateField` / `datePart` silently drops the time an approver needs. A raw id or ISO
stamp shown to a user is a machine value leaking through. Resolve enums, format instants
with `format="datetime"`, and title panels with an identifying value (a name), never an id.

**The audit strip at the foot of a detail is the one place a raw identifier belongs, and it is not
an exception somebody keeps finding.** `CrudDetail.AuditFooter` shortens a UUID, offers the whole
of it in the tooltip and copies the whole of it on a press: the short form, the tooltip and the
copy all point at one thing, and the control exists precisely so a reader raising a support ticket
can pick the identifier up. Everything a person recognises the record by - its name, its code - is
already above, in the title and the fields.

**Do not replace it with a human-readable code** by applying 「a raw id is not drawn on a screen」
to this line, and do not write an audit rule asking for a `code` prop: the component has none. The
framework's own source carries the warning at that line. Read it before changing it, and do not
write a rule that fires on it.


## #38 A choice the server constrains is a choice the server must publish

When the backend narrows a set of values per record (a visit type's allowed check-in
channels, a policy's permitted actions), the read/readiness DTO for that record MUST carry
the narrowed set, and the UI builds its options from it. Rendering the full enum and
letting the server reject the pick is a defect: the operator has no way to know which value
would have worked, and the rejection message is the only feedback. Same rule for a resource
pool (cards, seats): the picker offers only what is actually assignable, and an auto-pick
that hits an unusable candidate retries rather than failing at the first one. And a state
that ends the flow (checked out, cancelled, closed) hides the form that drives it -
`presence === "X" ? A : B` is a two-state assumption that silently offers a dead action for
every third state.

## #39 A list filter is the operator's index

The scaffold emits a filter per searchable field, including the entity's UUID and the
`createdAt` / `updatedAt` audit stamps. No operator searches by those. Prune them, add the
axis the persona actually searches by (the person's name, not just the owner's), and lay
the survivors out in 2–3 columns (`popoverColumns` + `columnBreak`) once the form scrolls.
When the search axis is a field of an internalized child (a participant's name on a visit),
give the SearchDTO a `@SearchableField` over a read-only association on the parent - and
NEVER name that association the same as a DTO collection the entity's create/update path
maps (ModelMapper will bind transient children onto it and the save fails at flush).

The survivors follow the category order of #16 (String, Date, Number, Attribute), and the design
entry's `filters` list names them in that order. A sibling screen that places the period last or a
choice first predates the rule and is not a precedent for order (#67: a survey of hand-written
screens measures drift). The stamp a log is read by keeps its period filter (#54).

## #40 Failure messages are a product surface

A user-facing exception carries a message key (`"{error.<module>.<case>}"`), resolved at
the HTTP layer, with every locale filled; a literal English string thrown from a service
reaches the user's dialog verbatim. Enum labels resolve through the enum resolver
(`LabeledEnum#getLabel` / `EnumMessageResolver`), not the application `MessageSource` - the
`messages/enums` bundles are not on its basename list. And the dialog leads with the
server's concrete reason; a generic per-code line is a fallback for a message-less error,
never a companion to one.

## #41 One search form everywhere

Every screen-level query condition renders through the standard FilterBar: list screens via
`useCrudList`'s `filters`, and non-CrudList surfaces (aggregation reports, dashboards,
required-param queries) via the standalone `useFilterBarState` hook with params derived
from `committedValues`. An inline `FormFields.*` row acting as a report's search conditions
is a defect. The total badge is the FilterBar `count` prop (it renders the shared
`ListTotalBadge`) - never a hand-placed badge in `leading`, which is reserved for extra
summary content (aggregate totals, a pending-count badge). On a page with a status-card
strip, tab bodies carry no status cards of their own - tab aggregates live on this toolbar
line. Detection recipes → `audit/audit-checklist.md` § 11.

## #43 Badge density parity

Badges on detail/form surfaces render at the SAME size as the list's. `StatusBadge` (and
domain wrappers built on it) defaults to `size="sm"` (`text-xs`) - omit `size` and the
three surfaces align; base `Badge` already matches. Explicit `size="xs"` only in genuinely
denser contexts (legend, live strip, high-density status table). Never enlarge a
detail/form badge (`size="default"`, `text-sm`/`text-base` classNames).

## #44 The component's real prop contract - recurring traps

`DetailTextField` has no `children` (custom-rendered detail values use
`DetailFieldWrapper`); `Flex`/`Stack` `wrap` is a boolean (`wrap`, not `wrap="wrap"`);
`ConfirmDialog` supports neither `children` nor `hideConfirm` (custom-content dialogs
compose `Dialog`/`DialogContent` directly). A prop you expected but cannot find means read
the component source - never typecast past it.

## #45 Peek dialogs are host-mounted

A `DetailPeekDialog` kept inside the subtree that triggered it (a list cell, a mapped row,
a card in a refetching panel) is unmounted the moment that subtree re-renders, so it closes
itself within seconds of opening; the surfaces that show references are exactly the ones an
activity stream keeps invalidating. Every `*PeekLabel` dispatches through `usePeekHost()`
from the UI kit's `peek` entry (`@simplix-react-ui-kits/<kit>/peek`; the project UI package's
own peek segment where the project draws with no kit), and the `PeekHost` provider wraps the
routed tree once in the app's provider stack. Labels take no `onPeek` prop and hold no open state.

- **A new peek label follows the same shape**: export the dialog as its own component and
  have the label's trigger call
  `peek.open({ render: ({ open, onOpenChange }) => <XPeekDialog … /> })`. The host is
  kind-agnostic, so a module's own entity needs no registration.
- Hand-rolled peeks (`usePeekTarget` + `DetailPeekDialog` at a widget root) remain valid
  for a one-off trigger that is not a reusable reference label - the state is already
  outside the row. Never place one inside a cell render or a `.map()` callback.

## #46 Delete is cloned, gated, and human-named

Wire deletion by cloning an existing `useCrudDeleteWired` + `adaptOrvalDelete` +
`{deleteDialog}` page, on EVERY crud-page variant (page AND panel - one-variant wiring
makes deletability depend on screen shape). A detail's `onDelete` activates only when
`onDeleted` exists (`onDelete={onDeleted ? del.requestDelete : undefined}` - no dead
buttons on callback-less renders). The dialog names the record with a human-readable value
(a resolver or a related entity's name, readable fallback), never a raw id. An irreversible
purge (anonymization / PII erasure) is a visually distinct action (own icon/tone) with a
type-the-name confirmation the server re-validates, and its dialog states the
delete-vs-purge difference and scope. Server-side blocks (referential/legal) surface their
SPECIFIC message key - what references it and how many - never a generic integrity phrase.

## #47 A widened operator read never crosses the trust boundary

When an operator surface needs the full gate picture (screening, identity verification,
compliance, capacity), that widened read (e.g. a `readiness`) is NOT shared with
data-subject-facing surfaces (portal / kiosk / public). Those call a narrow read listing
only what the subject can act on (approval, agreements, trainings). Sharing the wide read
leaks internal verdicts (watchlist hits, identity failures) to the subject, inverts
`ready`-style flags into dead-end loops on conditions the subject cannot fix, and
multiplies SPI/screening cost per candidate. The backend splits the two reads; each screen
wires its own.

Enforcement: review - which reads are widened operator reads and which surfaces are subject-facing is the product's trust model, and no source line states it.

## #48 Red badges mean "act now"

A red notification badge (`Badge variant="destructive"`, round) counts ONLY a set the
viewer must act on; informational counts (totals, per-status tab distribution) are muted
`tabular-nums` spans. Nav, sidebar, and tab badges counting the same set share the same
query figure and the same red treatment, and demote to muted at 0 (no red zero). The screen
a badge leads to opens BY DEFAULT on exactly the set the badge counts - a badge of N
landing on a default view showing 0 rows is a wiring defect. Tab/nav counts read
`totalElements` from a `size: 1` list query (cache-shared with the list).

Enforcement: review - whether a count is a set the viewer must act on, and whether the screen it leads to opens on exactly that set, needs the meaning of the count and the default filter of its destination.

## #49 Always-open master-detail boards

An operator board whose detail must never close composes `ListDetail` with a constant
`activePanel="detail"` + `listWidth` (fixed list column, detail fills the rest), and the
detail panel component's `onClose` is optional and omitted - with no `onClose`, no close
affordance renders. Select the first item on entry; when the selected item leaves the list
(processed), fall back to the new first item, and when the list empties, clear the
selection and swap to a full-width `EmptyState`. Judge selection survival by item id, never
by index - index survival silently selects a different record on refetch.

Enforcement: review - a constant `activePanel="detail"` is a valid shape elsewhere, and whether a board's detail must never close is a product decision; selection survival under a refetch is behavior, not text.

## #50 Reference cards vs workstation cards

A read-only reference card on a detail panel (screening verdicts, declared items, vehicles -
"read it if present" data) renders nothing when it has no rows; a card holding only a
"none" line is noise. A card that carries actions (an assignment workstation) always
renders, holding its empty-state line plus the hint that explains why its action is
currently unavailable. Custom row-action buttons outside the framework action column match
the row-action size (`size="xs"`) and join into ONE segmented group (`gap="none"`, `-ml-px`
neighbor overlap, outer-corner-only rounding, `whitespace-nowrap`) - a run of individual
`size="sm"` buttons inflates row height and wraps.

## #51 Precedent-first screens

SKILL.md item 51 states this invariant in full; it has no longer form here.

Enforcement: review - whether two precedent screens were read and their structure cloned is a step in the work; the completion report names them.

## #52 Every action affordance is permission-gated

A button that leads to a call the server will refuse must not render. Read the group from
`SUBJECTS.<screenKey>` where the module's screens already import `SUBJECTS` - the module's own
`src/shared/auth/subjects.ts`, or the project UI package where the project keeps the table
there (a sibling screen's import says which) - mirroring the backend's
`hasPermission('<group>', '<action>')`, and gate with
`useCan("<action>", SUBJECTS.<screenKey>)` from `@simplix-react/access/react` - never a
group literal inline, so a screen's gate and the server's rule move together. Create
affordances: the page-header create button on BOTH header variants (page and panel - gating
one leaves the other open), a tree's per-row `add-child`, and any create button composed
into an action group (drop the button out of the group, not the whole `actions` entry). The
scaffold emits the gate and the CLI creates an empty `subjects.ts` when a module has none,
so a missing entry is a compile error on the generated page - supply the real group, never
a plausible one. Where the project keeps `SUBJECTS` in its UI package, that empty file
shadows the real table and is reverted instead, with the page importing from the package
(`scaffold/overview.md` § Scaffolding into a module that already has widgets). The audit script (`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`)
fails on an ungated `showNew`. The menu entry a scaffold inserts follows the same rule: a project
that keeps its groups in a table sets `routes.<group>.menu.gate` in `simplix.config.ts`
(`screen-workflow.md`), so the entry reads `SUBJECTS.<key>` and the table gains the key instead of
the entry carrying the group as a string literal.

## #53 Detail-row enums go through the field their tone source names, resolved first

`DetailStatusField` and `DetailBadgeField` both draw an enum on a detail row (`@simplix-react/ui`
`fields/detail/`), and the source of the tone picks between them:

| Tone source | Field | What it takes |
|---|---|---|
| a shared `StatusTone` map in the project UI package (`<enum>ToTone`) | `DetailFields.DetailStatusField` | `tone` (the resolved `StatusTone`), `value` (the translated label) |
| a Badge variants map (`Record<value, BadgeVariant>`) | `DetailFields.DetailBadgeField` | `value` (the raw value, the variant key), `displayValue` (the label), `variants` |

An enum that has a tone map uses `DetailStatusField`, so the status colour stays the one the
list and the badges draw. The scaffold emits `DetailBadgeField` with an all-`"default"` variants
map, which is a placeholder: it is replaced by a real variants map or by `DetailStatusField`,
never kept.

`DetailStatusField` takes the tone already resolved, so the lookup sits at the call site and
needs the resolved key: `tone={<enum>ToTone[resolveBootEnum(x) || ""] ?? "neutral"}` beside
`value={enumLabel("<EnumType>", resolveBootEnum(x) || "")}`.

`DetailBadgeField` looks its tone up by the RAW `value` (`variants[value] ?? "default"`), so
handing it the boot-enum object the DTO carries makes every lookup miss: the badge renders
`default` however the variant map is written, while `displayValue` still shows the right
label. The failure is silent and reads as a broken tone map. Pass
`value={resolveBootEnum(x) || ""}` beside
`displayValue={enumLabel("<EnumType>", resolveBootEnum(x) || "")}` (`||` for the reason #36
gives); the scaffold emits the
unresolved form (`value={displayData.<field>}`), so every generated detail needs this fixed
at customization time.

**A nullable enum row uses `DetailStatusField` or `DetailBadgeField` too, never a bare badge
inside `DetailFieldWrapper`.** Module badge shells (`<Domain>StatusBadge` wrappers over
`resolveBootEnum`) return `null` for an absent value - right in a list cell or an inline
flex row, but inside a `DetailFieldWrapper` it leaves a silently blank row while every
sibling `DetailFields.*` row shows the shared no-value badge. For a detail or dialog row
whose enum can legitimately be absent (a verdict that exists only when something matched),
render the field with an empty value - `DetailBadgeField` with
`value={resolveBootEnum(x) || null}`, or `DetailStatusField` with an empty `value` - so the
empty state goes through the shared fallback; both render it when `value` is null, undefined
or an empty string. A row whose enum is always present may keep the
wrapper-plus-badge shape.

Enforcement: review - `DetailBadgeField` takes any string, so whether `value` holds a boot-enum object or a plain string depends on the DTO field's type, which no line of the call shows.

## #54 The scaffold emits fields that say nothing

A SimpliX-backed entity carries `deleted` and `deletedTimestamp`. They carry no
information: a soft-deleted row is filtered out of the list, so the flag always reads false
and the stamp always reads `-1`. The CLI marks them (`isAuditField`) together with the system
fields (`isSystemField`), and the console kit's list and detail templates skip every marked
field, so a screen that draws one was edited by hand or came from a template that still emits
it. Strip them from the column set, the `cardContent` block, the detail section, the form, and
the filter set, then clean up the imports left unused.
Same treatment for the entity PK and the audit quartet (`createdAt` / `createdBy` /
`updatedAt` / `updatedBy`) - `CrudDetail`'s `auditData` slot already carries those. The
framework has no declarative "hidden by default": `hiddenColumns` is a runtime toggle the
operator can open, so hiding means removing from source.

**Two cases are settled by the generator, so the author removes nothing and adds nothing.**

- **The stamp the list is read by stays.** An entity whose rows are events (a log, a ledger)
  declares a default sort that names an audit stamp (`createdAt`, `occurredAt`). The generated
  list keeps that stamp as its leading column and as its period filter, because the order the
  list opens in has to be readable off a column and narrowable by a filter. The detail's
  `auditData` strip still carries it. Every other stamp is stripped as above; a log whose
  actor or change columns are its primary data takes the domain exception of #18 by hand.
- **A masked twin replaces the field it masks.** SimpliX Meta marks no personal data, so the
  pairing is the statement: a record carrying `recipientEmail` (decrypted for display) beside
  `recipientEmailMasked` is drawn with the masked one only. The project names the suffix once
  (`scaffold.maskedSuffix: "Masked"` in `simplix.config.ts`), and the list, the detail and the
  sample rows leave the unmasked field out. `simplix meta-info <Entity>` lists the fields it
  left out. A personal-data field with no masked twin is not detected: it is a backend gap to
  raise (a masked form, or the field removed from the read DTO), never a field to draw.

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

## #56 A shared catalogue is edited key by key

**A shared catalogue is edited key by key; a whole-file write re-reads inside the same step.**
Locale catalogues (`modules/<domain>/src/locales/**/*.json`) and codegen output are appended to by
many tasks that never otherwise touch the same file. The hazard is not two writers at one moment; it
is ONE writer that reads the file early, works for a while, and writes the whole file late.
Everything added in between is silently gone - the keys vanish, the widgets naming them stay, and
the screens print `<namespace>.<key>`; nothing errors, and git shows a plausible small diff because
the lost keys were never committed. When a whole-file write is genuinely needed (a scripted bulk
edit, a sort, a reformat), re-read the file inside the same step that writes it. A sudden crop of
the audit's `missing-translation-key` error across files you did not touch is this, not somebody
forgetting their keys.

Enforcement: review - a whole-file write is a read-modify-write across time, and a machine reading the source sees one ordinary file write; whether the read happened inside the same step is a property of the task, not of the text.

## #57 An idempotency key is scoped to the payload it guards

**A client-generated idempotency key is scoped to the payload it guards, never to the screen or the
record it was reached from.** A key scoped to something coarser (the plan, the entity, the tab)
survives the user going back and CHANGING the form, so the server answers the new basket with the
old record and the screen after the submit shows values nobody typed: a cross-screen disagreement no
test catches, because both screens are individually correct. Derive the stored key from the
submitted values, keep it under a scope string built from them, and release it once the record it
wrote can no longer move (paid, closed, cancelled) so a second identical purchase is a second
record. The release half is the one that gets written and never wired - a `clearX`-style helper with
no importer means the flow does not have it.

Enforcement: review - which scope a key is derived from, and whether the release is wired, are properties of the flow across screens; the same helper call is right in one flow and wrong in another.

## #59 A preference that outlives a session gets its own namespace

**A preference that outlives a session gets its own namespace, outside any token-store prefix.**
`localStorageStore(prefix)` / `sessionStorageStore(prefix)` clear by sweeping every key starting
with `prefix`, and signing out calls that clear. A stay-signed-in preference written to
`"<prefix>remember-me"` is therefore erased by the one act it has to outlive: the box comes back
unchecked on the sign-in screen the operator was just returned to. Nothing errors and the token
handling is correct throughout - the key is simply inside the blast radius of a prefix sweep. Give
any preference that outranks a session its own namespace (`"<app>.prefs:<name>"`), and when reading
a store's `clear()`, ask what else lives under that prefix. Same trap for any non-token value parked
beside the tokens for convenience: a last-used tenant, a remembered sign-in address, a "do not show
again" flag.

Enforcement: review - whether a key falls under a token store's prefix depends on the prefix a store was constructed with elsewhere in the app, which no line-based check sees.

## #60 A context-owning package resolves to ONE copy

`createContext` at module scope makes one context object per physical copy of the
package, and pnpm answers two importers with two copies whenever their peer sets
differ: an app declaring `simplix-react` and a module declaring `@simplix-react/ui` is
enough. The provider one copy renders is then invisible to the consumer that imported
the other, and **nothing throws** - the consumer silently takes its default. A page
served from a `modules/*` package registers its title through `usePageHeader` while the
shell reads an empty provider, so the screen renders with no heading and no create
button and every line of the source is correct; the same split produces "No QueryClient
set", a toast that never appears, and a translation that stays a key.

The list in the project's bundler config (`resolve.dedupe`) must name the FRAMEWORK
packages - `@simplix-react/ui` first - not only `react` and TanStack, because a
workspace that consumed the framework through a single local checkout could never hit
this and the list written under those conditions does not name them.

- **Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-duplicate-contexts.mjs"` after ANY
  change to dependency resolution** - a version bump, a new dependency, switching a
  local-link profile to the registry, any `pnpm install` that rewrites the lockfile. It
  reports same-version copies of directly-depended packages whose code creates a context
  and which the dedupe list does not name; different major versions living side by side
  are ordinary resolution and are not reported. It reads the list from the module
  `--dedupe=<file>` names, else a dedupe module at `config/vite/dedupe.js` (or `.mjs`, or
  `vite.dedupe.js`), else every `resolve.dedupe: [...]` written as a literal list in a Vite
  config; a Vite config declaring the list any other way (an identifier, a spread) stops the
  run with exit 2, because a list it cannot read is not an empty one.
- **A UI kit installed from a checkout of its own can resolve its own framework copy.** The
  script follows each `@simplix-react-ui-kits/*` package the app resolves (through the
  `node_modules` of the root and of each workspace package, never through a path written in
  the script), finds the `@simplix-react/ui` that package resolves from where it lives, and
  fails when its real path differs from the app's. A dedupe list does not excuse it: the list
  decides which copy a bundle holds, and the type checker still reads the kit's. Install the
  kit with `SIMPLIX_FRAMEWORK_PATH` set to the app's framework checkout. `--selftest` proves
  the comparison on two temporary trees.
- **Missing chrome has TWO causes, and WHICH pages lost it tells them apart before you
  touch anything.** Duplication takes out every page past the package boundary - the
  app's own pages keep their header while every `modules/*` page loses it. When only
  SOME pages lose it with no boundary in common, the cause is in the hook rather than in
  resolution: a cleanup that empties the store without forgetting what it installed
  loses the second publish of React's development remount rehearsal, so only pages whose
  title and description never change after mount render nothing. Run this audit first
  because it is one command, then read the installed hook's source and compare against a
  sibling project on a different framework version. Report neither from reasoning alone -
  in the DOM, an ABSENT header element means no title ever reached the store, a PRESENT
  but blank one means it arrived empty.
- Findings under React Native / Expo names are real duplicates too, but Metro bundles
  those - the Vite dedupe list does not reach them, so fix them in the RN toolchain.
- **How the second copy arrived decides the fix.** A peer-hash split of one registry
  version (what the script reports) is fixed in the dedupe list. A **linked local
  checkout** answering its own peer imports beside registry copies is fixed in the
  install - link the whole framework scope or none of it; the diagnosis by loaded
  resources and the leftover-symlink sweep are in `framework/overview.md` § One physical
  copy per framework package, together with the framework-side `globalThis` anchoring
  rule that keeps a duplicate copy from becoming a correctness failure.
- **The same split has a type-level twin, and it surfaces on a ref prop.** A linked
  checkout resolves its own `@types/react`, so `Ref<T>` written in the consuming package
  is a different declaration from the `Ref<T>` the framework component's props were
  declared against. An OBJECT ref crosses that boundary because it is structural
  (`{ current: T | null }`); a CALLBACK ref does not, because its return type reaches
  `VoidOrUndefinedOnly`, which is nominal - so `tsc` refuses the assignment with "Two
  different types with this name exist, but they are unrelated" naming a type the author
  never wrote. **A shared component that forwards a ref to a framework primitive declares
  that prop as `RefObject<T | null>`, not `Ref<T>`**: it is what a caller reading the
  element holds anyway, and it is the half of `Ref` that is assignable across the two
  copies. Widening it back to `Ref<T>` to "be more permissive" is what re-breaks it.

Enforcement: review - `check-duplicate-contexts.mjs` decides it from the resolved package copies in the lockfile and `node_modules`, which no source line shows; run it after any change to dependency resolution.

## #61 Hiding a surface is not the same as not asking for it

A hook runs wherever it is written. Gating only what a component *renders* leaves the
request it makes untouched, so a screen that correctly hides a feature it did not buy
still calls the endpoint that feature owns - and the server refuses. What the user sees
is a bare "access denied" dialog over a panel showing nothing that could explain it, on
a screen that is otherwise entirely theirs to use. The half that did the hiding believes
it is finished, because from inside that component the affordance really is gone.

**Put the condition where the request is.** The hook's own `enabled`, or the shared
factory's `useEnabled` - not the route, not the parent that composes the widget. A gate
at the composing layer is a rule the NEXT caller has to remember; a gate inside the hook
is one they cannot get wrong. When the same read is offered as several primitives (a
picker, a facet, a name lookup over one roster), route all of them through one predicate
so a new primitive inherits the gate rather than reintroducing the hole.

**Check the framework before inventing a channel.** Entity-search and entity-facet
factories commonly already take a `useEnabled`; query hooks take `enabled`. Reaching for
those keeps the gate one line and keeps hook order stable, which a conditional call
would not.

**Drop the affordance as well as the request.** A filter or picker left standing with an
empty option list reads as "failed to load", not as "your tier does not include this" -
the reader retries, then reports a bug against a screen that is behaving exactly as
designed. Remove the control, or replace it with a sentence naming what is missing.

The shapes this takes:

| Shape | Where it hid | What still fired |
| --- | --- | --- |
| Tab bodies gated, list hooks at component top | detail panel with log tabs | both list searches |
| Composing route gated, draft hook above it | account detail with a scoped section | the scope read, twice |
| Feature-owned picker on a base-edition screen | customer list filter and form field | the roster search |
| Chrome sourcing a list from an admin endpoint | app shell, every role | the administrative search, at sign-in |

**The chrome row is the worst of them, because it fires for everybody.** A shell reads
the signed-in account and whatever it needs to draw itself; the moment one of those reads
comes from an administrative endpoint, **every role without that permission meets a
refusal dialog on the first screen after signing in** - before touching anything. The rule
generalizes past hooks: **a surface hidden from a role is not requested on that role's
behalf either.** Chrome takes its data from reads no role can be refused - the account's
own permission set, and whatever the shell's own endpoint returns for the caller. Where the
shell needs a list, the read that serves it returns the caller's own scope rather than the
administrator's.

**Detecting this mechanically is left undone on purpose.** The shape - "a hook whose
value is used only inside a conditional" - describes far more legitimate code than
defective code (loading states, empty states, every optional panel), and the part that
makes it a defect is that the endpoint is gated, which no static rule can see without
the project's own gate vocabulary. A rule that fires on the correct cases teaches the
reader to ignore it. Find these by driving the screens as an account that lacks the
thing, and watch for a refusal dialog with nothing behind it.

## #62 A screen with no list beside it still lays out in columns

SKILL.md item 62 states this invariant in full; it has no longer form here.

Enforcement: review - whether a stack of short fields is drawn a thousand pixels wide is a property of the painted page at a viewport width.

## #63 Tab strip, chip filter and rows sit together

**Tab strip, chip filter and rows sit together, in that order, with nothing between them** -
and **anything** means anything: a tile row, a banner, a help card, a rule, a heading, a
caption, a view-mode button. Both controls narrow the same set, so read down the screen they
are the two cuts in the order they apply - the tab picks the set, the chips pick inside it -
and the rows follow immediately under the last thing that changed which rows they are. Chips
drawn *above* the strip are a second strip with nothing saying which of the two the reader is
inside.

- **A number that counts one set directly above a table showing another reads as counting that
  table**, and the caption written to explain the difference is the layout confessing: a
  sentence saying why two figures on one screen disagree means the arrangement is wrong, and
  the fix is to make the figures agree, to label what each counts, or to move the tiles out -
  never to add the sentence.
- **A message the chip selection needs goes to the right of the chips, on their row** -
  `<Flex align="center" gap="sm"><ChipFilter …/><Text size="caption" tone="muted">…</Text></Flex>`,
  never a line of its own under the chips and never a band over the table. The row is one flex
  line, so whatever else belongs beside the chips (an unbuilt layer, a count) sits there too;
  that is the one place the rule leaves open, and it is open because a note beside the control
  it describes is read as belonging to that control.
- **A notice true of one tab only goes under that tab's rows**, not over them - a footnote is
  read after the thing it annotates. A notice true of every tab goes above the strip.
- **A heading inside a tab panel repeating the tab's own name is deleted, not moved.** The tab
  the reader just pressed already said it.
- **Sibling tab panels and the list's own states are not "between".** `TabsContent` /
  `PageTabPanel` siblings are alternatives, and the arms of the conditional that draws the rows
  (`{isLoading ? <Skeleton/> : rows.length === 0 ? <EmptyState/> : <Table/>}`) replace the table
  rather than stand over it.

## #64 Every chip carries a mark

**Every chip carries a mark, and the mark says whether this chip is on.** A chip row and a
tab strip are the same shape at a glance and a reader cannot tell which one narrows, so the
row has to say before it is pressed both that pressing narrows and which option is narrowing
now. An empty ring when the chip is off and a check when it is on carries both in one mark;
the pill shape (`rounded-full`, muted ground, solid when chosen) is what separates the row
from the strip above it. **A chip supplying its own icon gives that up** - a colour dot or a
count replaces the mark - so pass one only where the chip's own colour already says whether
it is on.

- **The chips flow from the left at their label's width and wrap**, never stretched to divide
  the row evenly. Stretched, an option's width is decided by how many options happen to sit
  beside it: the same filter is a segmented control on one screen and chips on the next, and a
  two-option filter draws two half-page buttons.

Enforcement: review - whether a chip carries its mark and flows at its label's width is a property of the painted page.

## #65 Actions belong to the panel footer, in two rows when one will not hold them

SKILL.md item 65 states this invariant in full; it has no longer form here.

Enforcement: review - which buttons are the panel's actions, and whether they sit in the body or the footer, is the screen's composition, not a pattern.

## #66 A field that names another record peeks at it, never travels to it

A detail field, a list cell or a panel row whose value is the NAME of another record
renders that name plus the peek trigger, and the trigger opens that record's detail in a
host-mounted dialog (#45). The dialog's go-to action is the only way out of the screen the
reader is on. A viewer with no grant to read the referenced record keeps the name and
loses the trigger - never a control that comes back refused.

**What goes wrong is not that the reader cannot get there. It is that they arrive.**
Somebody reading a record presses the name of a thing it refers to, to check one value,
and the record they were reading is gone - its tab, its scroll position, its filters, and
whatever they had half-decided. Nothing errors and the label was correct, so the only
thing that noticed is the reader's own memory of where they were.

**Two shapes, and the second does not even navigate:**

| Shape | What it does |
| --- | --- |
| `<Link>` (or a `variant="link"` button wrapping one) inside a detail field | leaves the screen |
| a link-styled button wired to the panel's own `onSelect` / `showDetail` | replaces the record under the reader - same panel, same chrome, different subject |

**A link is right when the destination is a screen rather than a record** - a canvas, a
register, a wizard, a filtered roster. Those belong in the panel's action row, not in a
field: a field's value is a value, and a control sitting where a value belongs is read as
that value.

**Peeks stack.** A reference inside a peek dialog is a reference like any other, so the
host pushes rather than replaces and its close pops one level. Without that, walking two
steps down a tree and pressing 「close」 drops the reader to the bottom of the pile.

**The failure mode this invariant exists for is disuse, not misuse.** On one product the
peek host, the trigger button and the dialog were built, reviewed and wired into the app
root - and then exactly ONE label used them. Every screen written in the months after
reached for a router link instead, because a link is what a reference looks like
everywhere else on the web, and nothing failed when they did. By the time anybody counted,
the wireframe board drew 225 reference fields and the code held one. **A convention that
has to be remembered at each field is kept the day it is written and broken every day
after** - so the moment the machinery exists, the rule that every reference goes through
it needs a detector, not a paragraph.

**Which value gets one is decided by the domain model, not by the label.** A field is a
reference when it carries a foreign key - when its value identifies a record of another
entity, or another record of the same entity. The generated DTO types are the evidence,
because they are what the server actually sends. These cases decide themselves once that
is the test:

| The value | Peek? | Why |
| --- | --- | --- |
| a foreign key (`parentOrgId`, `siteId`, `grantedBy`) | yes | it names a record somebody can open |
| the parent of the same entity | yes | a different record, and the reader is walking a tree |
| a denormalized name snapshot (`actorUsername`, 「그때 그렇게 읽혔다」) | no | it records what was true then; today's record may not match, and opening it would answer a question nobody asked |
| an enum | no | a value, not a record |
| a count (`21명`) | no | it names no record - it points at the list that does |

**The two shapes, and one question decides which: does the trigger stand alone in its own
region, or does it sit at the end of a value?** Standing alone - a card, a footer action
row - it takes `appearance="inline"`, an outline button carrying the label and the icon,
because nothing precedes it to say what it opens and nothing beside it for a word to crowd.
Sitting at the end of a value - a detail field, a list column, a detail-list row, a section
header's trailing slot - it takes `appearance="icon"`, because the word takes the width the
value needs: a bordered button at the end of a two-column detail row truncated the name the
row exists to show to 「대한건설…」 while the control for opening it stayed whole, and a
column of them left the panel with two right edges.

**The ways to get this wrong are opposite, and both were made on one screen in one
day.** Reading the rule as 「the label is for cards」 strips the footer's verbs to identical
glyphs in an empty band, which a sighted reader cannot tell apart at all. Reading it as
「the label is for anything with a label beside it」 puts a button at the end of every detail
row and eats the values. What separates them is neither the component nor the container but
the question above: is there something in front of this control already saying what it is
about? The default is `"icon"`, so a
trigger written without thinking about its place is right rather than loud.

**An icon-only trigger names what it opens.** With the label gone, `aria-label` is all a
screen reader has, and a detail panel or a list column holds several triggers whose label
is the same word - pass `target` so the name is 「남부현장 보기」 rather than the fourth
「보기」 on the screen.

**A dialog holds the referenced record's whole detail, tabs included** - not a summary
somebody chose six fields for. A summary is a second description of the record that drifts
from the first, and the reader who opened it to check one thing usually needs the next
thing too. This makes each peek cost what that entity's detail component costs: until that
component exists, the field renders the name without a trigger rather than getting a
hand-written card, and the first screen that needs the peek once it exists creates the entity's
`*PeekLabel` (`customize/consistency-checklist.md` § Referenced records link out).

**That detector belongs to the project, not to this script.** The shape is mechanically
plain - a `<Link>`, or a call to the surrounding panel's selector, inside a
`DetailFieldWrapper` - but the fix names components (`PeekTriggerButton`, `usePeekHost`)
that live in the project's own UI package and are absent from a project that has not built
them. `audit-frontend.mjs` runs against projects with no peek machinery at all, where the
finding would name a component that does not exist. Put the rule in the project's own gate
script, and prove it on the broken form and the fixed form there.

Enforcement: review - the finding names project components (`PeekTriggerButton`, `usePeekHost`) that a project without peek machinery lacks, so the detector belongs to the project's own gate script, as the section above says.

## #67 The shape the scaffold emits is the product's shape

**The shape the scaffold emits is the product's shape, and a census of hand-written screens is
not evidence of a convention** - every screen here starts from the CLI (`simplix scaffold` or `simplix add-page`), so what the
generator draws IS the house style and a screen departing from it is the thing that needs a
reason. Where a default is genuinely wrong for a product, it is changed once at the app root
(`UIProvider`'s `defaults`) and never per screen.

- **Counting the existing code is the trap.** 「fifteen of the sixteen literals say `ghost`, so
  `ghost` is the convention」 is a valid count of an invalid corpus: all sixteen were hand-typed
  onto screens that never went through the generator, so the census measured the drift and
  called it the standard. **Before a survey settles anything, ask what produced the things being
  counted** - if the answer is "somebody typed them", the count says how often a mistake was
  made, not what is right.
- **This is why a survey is the weakest kind of evidence here** and the generator's output is
  the strongest: one of them is a decision, the other is a residue.
- **A departure is written down where it departs, or it is a defect.** "The base form needs no
  reason and a deviation does" is only enforceable if the reason is somewhere a reader lands -
  so it goes in the code at the point of departure, as a comment saying what the generated
  shape was and why this screen is not it. **Without that, a considered exception and a
  forgotten line are the same bytes**, and the only way anyone finds out is a person opening
  the product.
  - **The count is what makes it obvious, and only afterwards.** One list missing the standard
    filter bar reads as a screen with a reason; eight of eight missing it while every other
    module's list has one is not a set of exceptions, it is the base form never having been
    applied. **So compare against the siblings before writing the reason** - if you cannot say
    what makes this screen different from the ones that kept it, there is no reason to write
    and the answer is to restore the base form.
  - **A missing standard component is invisible to every check that is not looking for it.**
    It type-checks, it builds, it renders, and the screen looks deliberate. Where a component
    is standard across a project, its absence is one grep and belongs in that project's gate
    script - firing on the screens that lack it and silent on the ones that have it.
- **A shape the generator does not emit is added to the project's template, never to one
  screen.** The CLI reads `.simplix/templates/<name>.hbs` before its own bundled template and
  falls through per name, so a project takes over the page shapes it cares about and leaves the
  rest - `crud-page`, `tree-crud-page`, `hub-page` and `page-index` are the page-side names for
  list screens, `list`, `form`, `detail` and `editor` the widget-side ones, and `record-page`,
  `dashboard-page`, `static-page`, `error-page`, `auth-page` and `app-shell` the kinds
  `simplix add-page` draws.
  That directory is the seam between what the CLI knows (the entity's operations) and what only
  the product knows (its chrome, its tiles, its notice cards, its tab strip), which is why
  shipping the chrome in the CLI is not the alternative.
  - **So "this screen needs a different shape" is a template task, not a hand-written page.**
    Write the template, scaffold through it, and the next screen that needs the same shape gets
    it for free. Hand-write it instead and the shape exists nowhere anybody can find: the next
    author re-invents it, and the screens end up similar and not the same.
  - **The tell is length.** A generated page runs to a stable size for a given project; a page
    several times longer is either carrying content genuinely its own, or carrying structure
    every screen needs. **For the second, the file to change is the template.** Compare against
    a sibling the generator wrote before concluding either way.
  - **Changing a template changes every screen it emitted, and that is the point.** Run
    `simplix generated --all` after the edit: untouched files re-render, edited ones are merged
    against the render they last came from, and a conflict is reported rather than written. Read the diff. The template is tracked, so the change is visible in the commit - a
    per-screen fix is not.

## #68 A row that means to sit as two groups has two children

**A row that means to sit as two groups has two children.** A wrapping flex row with
`justify="between"` or an auto margin says 「these belong at one end and those at the other」,
and with three or more flat children the width decides where it breaks instead: one line wide,
the last control alone on a second line narrower, all of them stacked narrower still, and a
fourth arrangement when a detail panel opens beside it. Put each end in its own element
(`<Flex wrap>{lead}<Flex className="ml-auto min-w-0">{rest}</Flex></Flex>`) so there is exactly
one place the row can break; another utility class on the row cannot do it, because an auto
margin moves children apart on whichever line they land on and says nothing about which line
that is. **A row of badges or chips is not the subject** - many items of one kind with no ends
to sit at, meant to reflow. **Judge it at three widths, with the detail panel open and shut**:
this is invisible at the width it was written at, which is the width it will be checked at.

## #69 How the detail appears is an installation's setting

**How the detail appears is an installation's setting, not a screen's shape - and a board drawn
as list-detail does not contradict a drawer** - `ListDetail` opens the record beside the list
(`panel`) or slid in from the right edge (`drawer`), and which one is in force is one line at
the app root (`UIProvider`'s `defaults.detailPresentation`). A screen passes `variant` only
where the shape is genuinely its own, and `"dialog"` is the case that usually is: a centred
modal claims the record is an interruption rather than the thing being worked on.

- **A wireframe board goes on drawing list-detail whichever is in force.** The board's claim is
  that the detail opens next to the list, holding that content, reachable from that row - not
  that it is a column. **A screen rendering a drawer against a board drawn as list-detail is
  not a divergence**, and an audit reporting it as one is reporting the setting.
- **So a visual check asks three things and not a fourth**: does the detail open from the row,
  is the content in it what the frame draws, does closing it come back to the list unchanged.
  Panel-or-drawer is the fourth, and it is not the screen's to answer. **Nor is what the drawer
  covers** - it sits over the list rather than narrowing it, so a row's right-hand columns are
  under it while it is open. That is the shape, not a defect, and reporting it as one reports
  the setting.
- **Moving between records under a drawer is 「close, then choose」, and writing it as 「two
  presses」 sends the next reader after a bug.** A press on a row's middle lands on the drawer
  and does nothing; the reader presses the part of the list still showing, which the backdrop
  takes as close, and then picks the row. One of those sentences describes an interaction and
  the other describes a click that fails to register.
- **Record which presentation the installation is on, as a fact.** 「이 설치는 서랍으로 서 있다」
  belongs in the report; 「보드와 다르다」 does not. The difference matters: the first tells the
  next reader what they are looking at, the second sends them to fix something that is not
  broken.
- **They give the detail the same room, and where they differ in behaviour that difference is
  the framework's to own - as a decision, not as an accident.** Under a modal drawer the
  backdrop takes the first press, so moving between records is 「close, then choose」 where a
  panel takes one press; a product chooses the modal drawer to have the backdrop block and
  close. That choice is written in the framework's comment beside the code, so the next reader
  knows they are re-opening a decision rather than fixing an oversight. What is never a
  screen's business either way: a screen must not work around the difference.
- **Each presentation takes its width from its own tokens, and the user resizes all three.**
  The panel shares the row with the list, so its default is the widest that leaves the list
  its own minimum; the drawer and the dialog cover the list and default wider. Default, minimum
  and maximum come from the design tokens (`detail-panel`, `detail-drawer`, `detail-dialog`),
  never from a screen. The resize handle is centred on the presentation's edge, and the chosen
  width is kept only when the operator asks the browser to remember it. An audit judges a
  screen at each presentation's own default, never one presentation's width against another's.

## #70 A sentence holding a value that can be absent is judged by the value, not by the record

`t("closure.confirmTitle", { site: site?.siteName ?? "" })` against `사업장 종료 - {{site}}`
renders an em dash with nothing after it. Nothing throws, the type is satisfied, and the build is
green - `?? ""` is what makes it typecheck and it is also what makes the hole. **Everybody meets
it, not only a reader whose scope withholds the value**: the value arrives with a fetch, so the
first paint of every one of these is the broken one.

**Guard the value, never the record.** `record ? <p>{t(…)}</p> : null` is the wrong test - it is
already true in the case that ships, where the record loaded and the field came back null. The
condition names `record?.fieldName`.

**Two shapes, and the sentence decides which.** Read what is left once the value is substituted
away:

- **The sentence means nothing without it** - 「{{version}} 버전을 설치합니다」. Do not render that
  clause until the value is there. Narrow the condition to the clause, not to the panel around it.
- **The sentence stands without it** - 「번역률 {{rate}}%」 still says what it says with a name
  missing from the front. Give it a paired key with no interpolation (`title` / `titleUnnamed`),
  and pick between them at the call site.

A paired key goes into every locale that has a catalogue for it, and any generated pseudo-locale is
rebuilt afterwards.

**Never apply one shape across the whole finding list.** Twenty-five call sites sorted by which of
the two they are produce twenty-five sentences somebody meant; twenty-five given the same treatment
produce a screen nobody designed. Where a value has a second-best form - an equipment record with
no name but a management number, on a confirmation the operator reads to check what is about to be
destroyed (#46) - the fallback is that value, not the paired key.

## #71 A collection inside a panel or a tab is one of two shapes, and paging decides which

**One question separates them: do the rows grow?**

| The set | What it renders as | What it must NOT have |
| --- | --- | --- |
| Fixed - a catalogue, an enum, a matrix, the four sharing modes | a bordered card table (`CrudDetail.Table` with no pager, or the project's zero-argument `TableCard`) | a pager, which promises a second page that does not exist |
| Growing - a history, the accounts holding a role, sessions, grants, anything a person adds to | `CrudList`, the same compound the list screen uses | nothing; it carries the total, the search, the filters, sortable headers and the pager |

**A pager under a bordered row list is the shape this rule exists to remove.** `CrudDetail.List`
and `CrudDetail.Table` hand a growing collection its pages and nothing else - so a reader who can
see there are 240 rows has no way to find one. They reach for the search box the list screen has,
the column header they sorted by there, and the total that told them how many; a tab gives them
page 7 of 12 and a scroll.

**Bind it to the parent with a forced request parameter, never with a filter.** `adaptForcedList`
(or the same merge by hand) puts the parent id into the request itself, so it is in the query key
and outside the state machine's filter gate. `transformFilters` looks like the place for it and is
not: the list only puts a `filters` object into the request once the reader has committed one, so
on first view the request goes out unnarrowed, the whole register comes back, and the tab's count
and its rows disagree. Nothing errors.

```tsx
const list = useCrudList<HolderRow>(
  adaptForcedList(useListAccounts, { "positionId.equals": positionId }),
  { stateMode: "server" },
);
```

**The tab's count and the list's total are the same number** - read the total off the list rather
than firing a second count, or the two disagree the moment a filter is committed.

**What the panel's width costs, and what it does not.** A `CrudList` in a 560px panel draws fewer
columns than the same list on a page, and choosing them is design work. It is not a reason to fall
back: the four things the reader reaches for do not become optional because the panel is narrow.

Detected by `paged-panel-collection-is-not-a-list` in `audit-frontend.mjs`.

## #72 The audit strip belongs to the record, so it sits in the first tab and nowhere else

A record's identifier and its created / updated stamps describe **the record**. On the
`CrudDetail` root they render under every tab, so beneath a tab listing other records the
record's stamps read as those rows'; in a later tab they are the same claim made again where
nobody looks for it.

Put `CrudDetail.AuditFooter` at the end of the FIRST tab's panel, and give the panel one strip.
A detail with no tabs keeps `auditData` on the root, which is what the scaffold emits and what is
right there.

Detected by `audit-strip-outside-the-first-tab` in `audit-frontend.mjs`.

## #73 Every standing message is a card; only a transient failure stays a banner

**A standing message and a transient failure look identical and behave oppositely - and the line
between them is not what the message says, it is whether it survives the reader doing nothing.**

| | A standing message | A transient failure |
| --- | --- | --- |
| Still there a minute later, untouched | yes | no - it answers something the reader just did |
| Example | 「계정과 근로자는 따로입니다」 · 「정책이 없는 안전구역이 1개 있습니다」 | 「코드가 틀렸습니다」 on a sign-in panel · 「연결하지 못했습니다」 after a test button |
| Drawn with | the notice card, closable, on the header control for its kind | a bare `AlertBanner`, left where it is |

A standing message goes on taking the same space after the reader has read it, and what it pushes
below the fold is the rows they came for. So it is drawn with the notice component rather than a
bare banner, which gives it two things a banner does not have: the reader can put it away,
remembered for them across sessions, and the way back is a header control that is in the same
place on every route. There is one control per kind (help · warning · info · danger), each with
**its own glyph AND its own tint** - colour alone does not reach a reader who cannot separate the
two tints, and a glyph alone does not reach one scanning the page without reading it. The card's
own button (「설명 보기」) is drawn inside that control too, so the explanation it opens stays one
press away after the card has been put away.

**The notice card is the kit's, and the rule presumes it.** The console kit ships `NoticeCard`,
the header control `NoticeMenu`, the per-message `noticeKey` and `NoticeDeclaration` (which
lists a card that lives inside a dialog while the dialog is closed); a product on no kit reads
its own component from the project. Where a product has no header
control to bring a closed card back - a sign-in panel, a kiosk body, a product that never built
one - a close would lose the message rather than move it, and the rule does not apply; the
rendered check below makes the same exception.

**Every kind closes, and a live count in the title changes nothing.** The worry a count raises -
an operator who dismissed 「미확인 2건」 on a day it read 2 is not shown it on the day it reads 40 -
is answered by the header control: a kind with a hidden card is tinted and pulses, so a dismissed
warning is a message MOVED rather than a message lost, and the reader can see from any route that
one of that kind is standing. That holds for every kind, `danger` included.

**The test before writing either**: does this message survive the reader doing nothing? If it is
still there a minute later, it stands, and it closes. If it is the answer to a press - a read that
failed, a submit the server refused, a field rejecting the value being typed - it is transient and
it stays a banner.

**Two shapes sit next to the transient one and are not it.** A banner that is the ONLY thing its
pane renders in that state - a pane's empty state, the other arm of the ternary that draws the
table - is the pane's content rather than a message standing over content, and putting it away
would leave the reader a blank pane, which #76 forbids. A banner drawn once per row of a
collection is a data row wearing a banner, and a per-row dismissal key is a key that moves. Both
stay banners; neither is an excuse for a message that genuinely stands beside content.

**Every message carries a glyph, card or banner.** The rule about a glyph AND a tint is about every
message, not only about cards, because a message carried by tint alone does not reach a reader who
cannot separate the two tints. A card takes its glyph from `kind`. `AlertBanner` takes the glyph
its tone carries (danger and warning the triangle, success the check, info the info circle,
pending the clock, processing the spinner; `neutral` carries no tint and no glyph), so `icon` is
passed only to name the subject of the banner instead of its severity. A framework release that
predates that default draws no glyph unless the caller passes `icon`: read the installed
`AlertBanner` before relying on it.

**The rule is read in one direction far more often than the other, and the direction that gets
skipped is the standing message's.** A transient failure wearing a card is visible - somebody
presses the ✕ and meets the wrong behaviour. A standing sentence drawn as a loose caption is
invisible, because a muted sentence under the page header looks like every other muted sentence on
the screen and nothing about it says it was supposed to be something else. So it accumulates: a
`PageNote`-style component, a bare `<Text size="caption" tone="muted">{t("page.note")}</Text>`
above the tab strip, a sub-caption the board drew as a caption. Each is a message the reader can
never put away, sitting exactly where the rows they came for should be.

**A component whose whole job is to draw a standing sentence is the shape to look for.** It reads
as a deliberate primitive because it is one, and its own documentation will argue that the
sentence is short enough not to be worth hiding. That argument is the rule's other direction being
re-derived from scratch, one component at a time; the answer to it is that the header control
costs one press and the sentence costs the same room every day forever. Such a component takes its
`noticeKey` from the caller rather than fixing one, because the card belongs to the screen it
stands on and the header control lists that screen's cards.

**A message has a single key, never one per branch.** A screen that draws the same sentence in more
than one place - a phone body and a desktop panel, the arms of a layout switch - is one message in several places, and it
takes one `noticeKey`. Splitting it feels safe, because each branch then owns its own dismissal and
nothing leaks between them; what it actually does is make the operator put the card down twice. The
dismissal is kept per operator on the server **so that it follows them between devices**, which is
the whole reason it is not in the browser, and a key per width throws exactly that away: they
dismiss it at their desk and meet it again on the phone.

**Watch what that reason is not.** 「A phone-only key would be restorable from nowhere, because the
header lists only the keys the current screen registers」 is a true sentence about a header that
draws no control on that width, and it stops being true the moment the header is fixed - which is a
one-line change somebody will make. A reason that rests on a defect expires when the defect is
repaired, and it expires silently, still written down and still being copied. The durable reason is
the one above, which never depended on the header at all.

**The board does not settle it by which primitive it drew.** A board can carry three vocabularies
for a standing sentence - a page note, a sub-caption, a message - and only the message records
whether it closes. Where the board drew a caption, or marked a message as drawing no close
control, and the message stands, the board is the thing that moves.

**Detecting it**: `standingMessageDrawsNoClose` in `audit-rendered.mjs` decides it on the painted
page - a standing message in the page's own column with no way to put it away, or with no glyph
saying its kind. The close is owed only on a page that carries the console header's restore
control (`restoreControlSelector`, drawn whenever the screen registers a closable message), so
the irreversibility warning of an identity provider's confirmation page stays without one; the
glyph is owed on every page. It reads a page that has only been loaded, where nothing answers a
press, so whatever message is there is standing; run past a submit, it reports the refusal too. A source
gate in the project can hold the unconditional half as well - walk the JSX, skip any banner
contained in a dialog / sheet / help card / notice card or in a file that is a sign-in surface end
to end, and report the rest. A banner drawn under a condition is NOT decidable that way: a state
and a transient failure have the same shape, so such a gate holds the unconditional half and the
conditional half is read by whoever writes the screen. Say so where the gate is declared rather
than leaving the silence to read as coverage.

Enforcement: review - the standing half is decided from the painted page by `standingMessageDrawsNoClose` in `audit-rendered.mjs`; whether a message stands or answers a press is not in the source.

## #74 One value's state is changed in one place, on every screen that shows it

A record's active / suspended / closed state is moved by an **action** - a row action on the list,
a button in the detail panel's footer - with the confirmation and the reason prompt that belong to
it. It is not also a switch inside the edit form: a second way to make the same change brings a second audit
trail, a second confirmation behaviour and a second answer to 「어디서 끄나요」, and the form's switch is
the one that skips the reason.

So a create/update form does not carry the state field, and the DTO's value for it comes from the
record being edited. Where the state genuinely has to be set at creation time, the create form may
carry it and the edit form still may not.

Enforcement: review - which field is a record's state, and whether an action also moves it, is a fact about the entity.

## #75 A field the DTO accepts as absent can be returned to absent

A select moves from one option to another and nothing else, so an optional field becomes permanent
the moment somebody picks a value. The rank set on the wrong account, the parent chosen for a node
that belongs at the top level, the zone type applied to an area that turned out not to be one -
each can be changed and none can be taken off, and the route back is a database column the screen
does not offer.

**The form itself says which fields these are.** A submit path writing `X: values.X || undefined`
has declared the empty string legal; a control that cannot produce the empty string contradicts it
in the same file. That pairing is what `optional-select-cannot-be-emptied` reads.

Pass `clearable` on those selects. It puts an entry at the top of the list - the framework's word
for an empty choice, or `clearLabel` where the absence has a name of its own (`사업장 바로 아래`
for a node with no parent) - and hands `""` back through `onChange`. A sentinel carries it inside
the component because Radix refuses an item valued at the empty string, which is also why a
hand-rolled `{ value: "", label: … }` option does not work: it throws when the list opens.

`required` withholds the entry however the caller asked, since a required field has no empty state
to return to.

The same question is asked of every other control an optional field can use - a combobox, a tree
select, a date field - and the answer is the same: what the DTO accepts as absent, the screen can
set to absent.

## #76 A pane a reader reached by pressing something owes them words in every state it can reach

`return null` is right in a dozen places - a cell with no value, a badge whose enum resolved to
nothing, a banner nobody armed, a reference card with no rows. What separates those from a defect
is not the statement, it is **where the statement runs**. A tab strip is a promise the reader can
see being made: pressing this shows what is behind it. A pane that answers a press with nothing has
broken that promise, and the reader is left in front of a rectangle with no way to tell an empty
installation from a screen that failed.

The shape it takes in a settings screen is always the same. The pane renders a record, the record
is absent, and the component ends:

```tsx
const draft = policy.draft;
if (!draft) {
  return null;          // ✖ the whole area under the tab strip is 16px of its own padding
}
```

Everything else on the screen is correct - the header, the tiles, the banner saying the record is
missing, the four tabs with their counts - so the screen reads as populated right up to the strip
and then stops. `document.body.innerText` ends at the last tab's label.

**A spinner is the same defect wearing a different face, and the harder one to see.** A pane held
on a lookup renders a loading fallback, and the condition is usually `!id`:

```tsx
const roleId = catalogue.idOfCode(AUDITOR_ROLE);   // undefined WHILE READING, and also
{roleId ? <List forced={{ "roleIds.in": roleId }} /> : <QueryFallback isLoading />}
```

`undefined` there is two different facts - the catalogue has not answered yet, and the catalogue
answered and holds no such role - and only the first is a wait. Written as one condition the second
spins for ever. Read the lookup's own `isLoading` to separate them; a lookup that does not expose
one is the thing to fix.

**What the pane owes.** A title and a sentence saying what this pane holds and what makes it
appear, through the project's shared empty-state component (registry: `EmptyState`, and whatever
panel wrapper the project keeps around it). Not the banner's sentence again - a banner above the
strip has already said the record is absent, and what the reader still cannot tell is what they
would have been looking at.

**Where the check lives.** `openPaneDrawsNothing` in `audit-rendered.mjs` decides it from the
painted page, because that is the only place it is decidable: a source rule cannot tell this
`return null` from the twelve correct ones. It needs the screen open in the state that produces it
(`?data=empty`, a fresh installation, a record nobody created), which is why the browser pass is
the gate and a green build is not.

## #77 A session token reaches the browser in the fragment

**A session token reaches the browser in the fragment, never in the query string.** A query string
is part of the GET, so it is written to the server's access log, to every proxy in front of it, and
into `Referer` on any resource the page requests. None of those is reachable from the page, so
`history.replaceState` does not help: by the time any client-side code runs, the credential has
already been sent and recorded. A fragment (`#accessToken=…`) is never transmitted, which is why it
is the standard carrier for a token handed to a browser - and it costs nothing, because a page that
holds its own tokens and sends them in a header reads either one the same way. Two halves and they
ship together: whatever redirects to the page writes the fragment, and the page reads
`location.hash`. **What the query string keeps** is everything that is not a credential - an error
code, a returned tab, a page number - and an OAuth `code` and `state`, which the provider must send
that way and which are single-use and bound to a client secret. **The fragment is read before the
router mounts, and consumed once**: a router builds its location from `window.location` on load and
may normalise the address, so a fragment read from inside a component is a fragment a future router
version can drop, and a value read twice re-opens a session under a hot reload. Capture at module
scope in the app that owns the entry point, strip it in the same breath, and hand it to the
component the way any other app-owned fact is handed in. `session-token-read-from-the-query-string`
in `audit-frontend.mjs` catches the read half.

## #78 A read that decides whether a field is required is never gated on that field

A screen that previews before it commits usually grows one request builder, because the preview and
the submit send the same DTO. The builder refuses to produce anything until every required field is
filled, which is right for the submit and is the whole defect for the preview - as soon as one of
those fields is required *because of what the preview says*, the gate and the answer that justifies
it close a cycle.

```tsx
// ✖ one builder, two callers, and `recipientId` is required because of what the preview answers
export function exportRequestOf(values: Values): RequestDTO | undefined {
  if (!values.periodFrom || !values.periodTo || !values.recipientId) return undefined;
  return { ...everything };
}
const preview = usePreview(exportRequestOf(values));   // never fires
const canSubmit = Boolean(exportRequestOf(values));    // correct
```

**Nothing throws, and every screen inside the cycle is individually correct.** The tiles draw an
em-dash over 「조건을 채우면 계산합니다」, which is true - nobody counted. The column preview says
「목적과 대상과 기간을 채우면 …」, which is the hint it was written with. The journey rail shows the
first step live, which is what an uncounted scope means. Each of those sentences is honest about a
measurement nobody took, and together they describe a screen that cannot count fields it is looking
at. **That is what makes this class hard to see: the bug is not in any of the parts, it is in the
edge between two of them**, and a reviewer reading either half finds nothing wrong.

**Split the builder by what each call actually reads.** The preview builder takes the fields the
server reads for the preview and nothing else; the submit builder composes that with the rest:

```tsx
export function exportScopeOf(values: Values): ScopeDTO | undefined {
  if (!values.periodFrom || !values.periodTo) return undefined;   // ✔ what the preview reads
  return { ...scopeFields };
}
export function exportRequestOf(values: Values): RequestDTO | undefined {
  const scope = exportScopeOf(values);
  if (!scope || !values.recipientId) return undefined;
  return { ...scope, recipientId: values.recipientId };
}
```

**The server splits with it, or the fix is only half made.** A preview endpoint typed to the full
request DTO still validates the field it never reads, so the narrowed client call comes back 400 and
the screen is as blank as before. Give the preview its own DTO carrying the scope, and let the
request DTO extend it with what only a submit needs - the same shape the backend handbook's
`UpdateDTO extends CreateDTO` already uses (`simplix:backend` → `references/review/dto-type-reference.md` § 3. UpdateDTO).

**The tell, when you are looking for it rather than at it: a required field whose requirement is
stated by a sentence the screen has not been able to render yet.** "The recipient is required
because the message contains personal data" is a warning the preview produces, and the recipient
field was the gate on the preview - the rule stood behind the field it makes mandatory. Any time a form explains why a field
is required, ask where that explanation comes from, and whether the field gates it.

**No script rule.** A builder returning `undefined` and feeding two callers is the ordinary shape of
every preview-then-submit screen, so a check over it is almost all false positives, and what
separates the defect from the pattern is a semantic fact - that one gated field's requirement is
decided downstream. It is caught by asking the question of a gated read, which is why it lives here
and not in `audit-frontend.mjs`.

**Generalise past the preview.** The same cycle appears wherever a gate's condition is produced by
the thing it gates: a filter list whose options come from a read the filter narrows, a tab whose
count is fetched by a query enabled only when that tab is open, a permission check reading a field
the refused call would have returned. Ask of every gated read: **does anything the gate demands
depend on this read's answer?**

Enforcement: review - a builder returning `undefined` for two callers is the ordinary shape of every preview-then-submit screen, and what separates the defect is a fact about what the server decides downstream.

## #79 Every screen is generated from kit templates, then customised

SKILL.md item 79 carries the steps. The cases behind each rule, the lint fence and the gaps are in `screen-workflow.md`; the preflight a change reaching several screens runs is `screen-preflight.md`, and the traps a screen move meets are in `screen-playbook.md`.
