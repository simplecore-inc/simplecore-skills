# Screen Checklist — the census every screen goes through

Open every screen in the area under test, one at a time, and run all axes below. Each axis has a browser check (what the persona experiences) and, where possible, a code-level detection recipe (so the same defect type can be swept across screens that were not opened yet). The judgment standard for every axis comes from `judgment-lenses.md` — findings are anchored to the `simplix:frontend` skill's invariants, a precedent screen, a server contract, or a persona failure. This checklist is per-screen; the connected-screen agreement censuses run separately over the cluster (`cross-screen-consistency.md`, axis H below).

Paths in the recipes are written generically (`modules/`, `apps/`, `<backend>/modules/`) — substitute this repo's directories.

---

## A. List screen

1. **Does the row tell the story?** The subject (who / what), the state, and the time that matters must be readable without opening the row. A list whose columns are all ids, codes, or system flags fails.
2. **Column order and alignment** follow the `simplix:frontend` skill's column rules — the fix goes through its CUSTOMIZE · Columns references.
3. **Search actually searches.** Type a value a user knows (a person's name, a code), submit, and confirm the result set changes. A search box wired to a field nobody knows is worse than none.
4. **Filter dropdown, read as the persona.** Prune to what this person filters by, order deterministically, tier it (2–3 groups) when long. See SKILL.md § Search Is Part of the Product.
5. **Pagination and empty state** — a growing list must be paged (the framework's paged-searchable path), and the empty state must come from the shared component, not an inline `<p>No data</p>`.
6. **Row actions** — every action offered on a row must be legal for that row's state (see axis E).

---

## B. Detail surface

1. **The title identifies the record to a human.** Never a UUID, never `편집: <id>`, never a bare code.

   ```bash
   # header expressions that involve an id — REVIEW each hit, do not bulk-report
   rg -n 'Heading[^>]*>\{[^}]*Id' modules/*/src/widgets/*/{form,detail}.tsx
   rg -n '\{\{ *id *\}\}' modules/*/src/locales
   ```
   Review standard: an id fed through a name resolver (`userName(...)`, `siteName(...)`, `nameOf(...)`) is correct; an id used only as the *fallback* behind a name (`name ?? t("editHeader", { id })`) is acceptable; an id rendered as the title itself is the defect. The browser-side UUID snippet (`browser-driving.md` § Verdict snippets) is the ground truth — grep only widens the sweep. When the name is absent because the server's detail projection filled a relation with its id only (list shows a name, detail shows a UUID), fix the projection in the backend — do not paper over it with an extra frontend lookup.

2. **Relations show names, not ids.** Every `*Id` rendered as a value is a finding.

   ```bash
   rg -n 'value=\{[^}]*Id[a-z]*[^(}]*\}' modules/*/src/widgets/*/detail.tsx
   ```
   Review standard: an id wrapped in a name resolver (`ownerName(x.ownerId)`, `nameOf(...)`) or a relation object's name (`x.owner?.name ?? x.ownerId` — fallback only) is correct; a bare `value={x.somethingId}` is the defect. Expected after review: 0 outside a deliberate technical-id row.

3. **Timestamps show the time when the time matters.** An `Instant` rendered date-only silently drops the hour an approver needs.

4. **Enum values are resolved labels**, in every locale — never the raw enum name, never `[object Object]`, never blank (a boot-enum object fed straight into a field renders empty).

5. **Scroll ownership.** Open the panel and actually scroll it. The framework's detail container does not scroll its own content — its child must own the scroll (a `CrudDetail` / `CrudForm`, or a `Stack fill` + `overflow="auto"` body). Verdict snippet: `browser-driving.md` § Verdict snippets → Scroll ownership. Clipped content with no scrollbar means the footer actions are unreachable.

6. **Field order reads like the persona thinks.** Identity → what they act on → supporting detail → audit/system (or hidden). Long values (ids, notes, diffs) take a full-width row; only short paired scalars sit two-up.

---

## C. Form surface

1. **No hand-typed ids** — every reference to another record is a picker showing names; files use the framework's file field.

   ```bash
   # JSX props span lines — a line-based grep misses this; use ripgrep multiline
   rg -U --multiline-dotall -n '<FormFields\.(TextField|TextareaField).{0,200}?value=\{[^}]*Id[a-z]*\}' \
     --type-add 'tsx:*.tsx' -t tsx modules apps
   ```
   Expected: 0. (`providerKey`-style opaque config keys typed by an administrator are a judgment call — an entity id never is.)

2. **The form writes what the create/update DTO accepts.** Diff `FormValues` against the generated `*CreateDTO` / `*UpdateDTO`: every DTO field is either edited here, deliberately server-owned, or deliberately out of scope. A field the form never writes but the entity's behaviour depends on produces records that are born broken.

3. **Every input is the right kind of input** for its backend type — dates, timestamps, times of day, enums, booleans each have their framework field (see the `simplix:frontend` skill's framework-components reference). A native `type="time"`/`type="date"` input or a free-text `HH:mm` is a defect.

4. **Optional means the user can express "none".** A control with no empty state (a time picker, a spinner) must be gated by a toggle or a mode select that writes `undefined`. A form that displays a value while submitting nothing is a defect.

5. **Validation and failure.** Submit an invalid form deliberately: errors attach to their fields, and the failure dialog leads with the server's concrete reason, not a generic per-code sentence.

6. **Edit is a state, not a button.** Content that has left the draft state must not be editable — and the server must be the one enforcing it, not just a hidden button.

---

## D. Page chrome — buttons, header, footer

1. **Page title/description registered through the page-header hook**; no locally rendered heading acting as the page title; no ad-hoc padding on the page root.
2. **Primary create action in the header's action slot** — not a button row above the list.
3. **Detail/form actions in the footer** (`CrudDetail.DefaultActions` / `CrudForm.Actions`). A mid-page action is allowed only when it belongs to the section it sits in (add-a-row inside a repeatable list, a per-row action inside a table). Everything else moves to the footer.

   The primary instrument here is the **browser**, not grep: on each opened panel run the buttons-outside-footer snippet (`browser-driving.md` § Verdict snippets) and judge each hit as the persona. Code-side, the authoritative detection recipes are the `simplix:frontend` skill's `references/audit/audit-checklist.md` § Page Chrome Violations — run those for the codebase-wide sweep; a raw `grep '<Button'` is too noisy to be evidence on its own.

---

## E. Lifecycle and state integrity

1. **Every backend action has a way in.** Enumerate the module's entity-scoped action endpoints and confirm each is reachable from the UI:

   ```bash
   grep -rhoE '@(Post|Put|Patch|Delete)Mapping\("/\{[a-zA-Z]+\}/[^"]*"\)' <backend>/modules/<m>/**/controller/*.java
   ```
   For each, find the hook and the screen that calls it. An endpoint nothing calls is either a missing affordance or dead code — decide which, in the open.

2. **Every state has an exit.** Walk the states the entity can sit in and find the one nothing can move (a request submitted to an approver who does not exist, a settled period nothing can re-open, an assigned resource with no release path). A stuck row is a defect even when every screen renders.

3. **What the UI offers, the server accepts.** Try the boundary combinations on purpose: acting on a closed period, re-submitting after approval, requesting more than the remaining balance, checking in something not ready. When the server refuses what the UI offered, the UI's gate is wrong (align it with the server's real check) — when the server accepts what it should refuse, the server is wrong.

4. **Auto-approval and empty chains.** A request that sails through because no approver is configured is a hole, not a pass. Check the approval path exists before trusting an "approved".

---

## F. Language and terminology

1. Sidebar label, page title, and breadcrumb agree.
2. No English or raw enum text leaks into a localized screen; every locale is filled for every new key.
3. In an area meant for ordinary employees, administrator vocabulary is itself the defect — rename to what the employee calls the thing.

---

## G. Errors and empty paths

1. Force a failure per screen (submit a conflicting value, act on a stale record) and read the dialog as the persona: does it say what went wrong and what to do?
2. Check the console for errors while walking the flow (`read_console_messages`, filtered) — a silent 500 behind a spinner is a defect the screenshot will not show.
3. Loading and empty states come from the shared components, and a slow query shows something other than a blank panel.

---

## H. Cross-screen agreement (runs over the cluster, not this screen alone)

After the per-screen axes, run the agreement censuses of `cross-screen-consistency.md` across every surface that shows this entity: value, state (live invalidation), count, terminology, presentation, affordance agreement, and shape parity between sibling screens. Two screens that each pass axes A–G and still disagree with each other are a defect.
