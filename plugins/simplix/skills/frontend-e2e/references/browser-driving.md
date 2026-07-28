# Browser Driving — how the audit is actually executed

The browser is the instrument. Everything below is about keeping it honest and keeping it fast.

---

## Environment

1. **Read the project dev-server policy first** (whatever the project documents under its own `.claude/`, else its README / package scripts): which URLs the app and API serve on, the HTTPS/self-signed-certificate requirement, and whether you may start a server yourself or must ask the user. Do not hardcode a port from memory — a dev server that finds its usual port taken silently moves to another one, so take the URL from the dev-server output or a readiness probe.
2. **Confirm the build is current before trusting the screen.** The app is served from workspace packages; a failed or stale build serves old output, and old output looks exactly like a missing translation, a vanished column, or an unstyled control. If something looks structurally wrong, check the build/dev-server log before writing it down as a defect.
3. **Confirm the API is up** (a readiness probe against the backend) — an area that renders empty because the API is down is not an empty-state defect.
4. After a change to a workspace package's public surface, the consuming app needs that package rebuilt before the browser shows the change (see the `simplix:frontend` skill's verification rules). A hot reload does not cover it.

---

## Tool of record

Use the session's browser-automation MCP — typically **Claude in Chrome** (`mcp__claude-in-chrome__*`). Start every session with the tab-context call, create a fresh tab for the audit, and only reuse an existing tab if the user asks. Fall back to another automation tool only when it is not connected, and tell the user you did.

Practical rules that save an entire session:

1. **Batch.** Predictable sequences (navigate → wait → click → wait → screenshot) go in one batched call. Coordinates in a batch refer to the screenshot taken *before* the call.
2. **Locate elements by what they are, not where they were.** Use the find/read-page calls to get a reference, then act on the reference. Coordinates and refs go stale after any navigation, HMR reload, or panel switch — re-locate rather than reusing.
3. **Screenshot after every state change** you intend to judge. Judge layout from the screenshot; judge structure from the accessibility tree; when the two disagree, believe the screenshot and re-check.
4. **Watch the console AND the network while you walk** (`read_console_messages` / `read_network_requests`, filtered), so a failing request behind a spinner does not pass as "works" — and so wire-level defects surface: a query per row (N+1), duplicate fetches on mount, a mutation that triggers no refetch on the dependent surfaces (see `judgment-lenses.md` lens 3).
5. **Never trigger a native dialog** (`alert`/`confirm`) — it freezes the automation channel. Prefer in-app dialogs; if a control is known to raise a native one, tell the user rather than clicking it.
6. **Stay out of rabbit holes.** Two or three failed attempts at the same interaction means you stop and report what is blocking, not a fourth attempt.

---

## Login and personas

1. Open the login screen and use the test-account buttons when they exist (hand-typed credentials with special characters are a known source of wasted turns). Never enter real credentials.
2. To change persona: log out through the UI and log in as the next account. Keep a note of which account is in which tab.
3. If a needed role has no test account, stop and propose the seed change — do not mint state through the API to work around it.

---

## Verdict snippets

Small, safe checks that settle a question the eye cannot. Run them through the tool's JavaScript call, read the result, and move on. (Adapt selectors to the current markup — these are shapes, not incantations.)

**Scroll ownership** — does the detail panel clip its content with nobody owning the scroll?

```js
const panel = document.querySelector('[data-detail-panel], article');  // the detail container
({
  clipped: panel.scrollHeight > panel.clientHeight,
  innerScroller: [...panel.querySelectorAll('*')].some(el =>
    ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight),
})
// clipped: true + innerScroller: false  →  defect: the child must own the scroll
```

**Ids on screen** — is a UUID visible anywhere a human reads?

```js
[...document.querySelectorAll('h1,h2,h3,h4,td,dd,span')]
  .map(el => el.textContent.trim())
  .filter(t => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t))
```
Non-empty → a title/field is showing an identifier instead of a name.

**Untranslated text** — raw enum names or i18n keys leaking through:

```js
[...document.querySelectorAll('body *')]
  .filter(el => el.children.length === 0)
  .map(el => el.textContent.trim())
  .filter(t => /^[A-Z][A-Z0-9_]{2,}$/.test(t) || /^[a-z]+\.[a-z]+\./i.test(t))
```
Review the hits — legitimate acronyms and product names (CSV, API, a brand) match the first pattern; a dotted i18n key or a SNAKE_CASE enum name is the real leak.

**Button placement** — actions rendered outside a footer:

```js
[...document.querySelectorAll('button')]
  .filter(b => b.offsetParent && !b.closest('footer, [data-footer], [data-page-header]'))
  .map(b => b.textContent.trim())
  .filter(Boolean)
```
Read the list as the persona: anything that is a record-level action (save, submit, approve, delete, check in) belongs in the footer.

---

## Test-data hygiene

The audit runs against a live development database, and every flow you complete leaves records behind. Valid records are an asset; broken ones are noise.

1. **Restore what you mutate.** When a check edits a pre-existing record to prove a round-trip (change a value, save, re-read), put the original value back through the UI once the verdict is in.
2. **Valid test data stays.** A record you created correctly and drove through its flow is left in place — it documents the walked scenario and serves as reference data for later sessions. Give created records recognizable, realistic names so they read as scenario data, not garbage.
3. **Only erroneous data is removed.** Delete (through the UI) records that carry wrong input, were half-created by a failed submit, or were stranded mid-flow by a defect. If such a record cannot be removed through the UI, the missing delete/cancel affordance is itself a finding.
4. **Report the ledger.** List what was created and kept (per flow), and what was removed and why.

---

## Evidence and honesty

1. Keep the screenshot (or the failing console line) that establishes each finding; a finding you cannot show is a finding you will retract later.
2. When a check contradicts an earlier one, say so in the report and give the resolved answer — "this looked broken in the tree but renders correctly" is a legitimate, useful line.
3. Reading the API to *observe* what the server stored (after a UI save, to confirm the wire value) is allowed and encouraged. Writing through the API to *create or move* state is exempted only for external-system state (device events, scheduler output, time passage) and must be declared — see SKILL.md § Ground Rules.
