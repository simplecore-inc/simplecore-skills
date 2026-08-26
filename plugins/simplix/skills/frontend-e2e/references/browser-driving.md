# Browser Driving — how the audit is actually executed

The browser is the instrument. Everything below is about keeping it honest and keeping it fast.

---

## Environment

**On the local machine the servers are yours to run.** An audit that stops to ask before every restart cannot cover a feature area, and the restart is not optional — it is the difference between a defect and a stale build. Start, restart, and stop the app and its API as the work needs, within these bounds:

1. **Take the commands from the project, never from memory** — whatever it documents under its own `.claude/`, else its README, package scripts, Gradle tasks, or compose file: how the app and the API start and stop, how a workspace package is rebuilt, and the HTTPS/self-signed-certificate requirement.
2. **Read the port from the server's own output or a readiness probe.** A dev server that finds its usual port taken silently moves to another one, so a hardcoded port verifies the wrong thing — or nothing.
3. **Reclaim only a port you own.** A port held by a development server from an earlier session of *this* project is stopped and replaced. A process you cannot identify as this project's dev server is left alone, and reported instead.
4. **Local only.** Remote hosts of any kind — production, staging, shared development — and orchestrators outside this machine are out of scope. Ask first.
5. **Leave the environment as you found it.** Stop what you started once the work no longer needs it, and say in the report what you left running and why.

Then, before trusting anything on screen:

6. **Confirm the build is current.** The app is served from workspace packages; a failed or stale build serves old output, and old output looks exactly like a missing translation, a vanished column, or an unstyled control. When the screen disagrees with the source, rebuild or restart and look again *before* writing it down as a defect.
7. **Confirm the API is up** (a readiness probe against the backend) — an area that renders empty because the API is down is not an empty-state defect.
8. After a change to a workspace package's public surface, the consuming app needs that package rebuilt before the browser shows the change (see the `simplix:frontend` skill's verification rules). A hot reload does not cover it.

---

## Tool of record

Use the session's browser-automation MCP — typically **Claude in Chrome** (`mcp__claude-in-chrome__*`). Start every session with the tab-context call, create a fresh tab for the audit, and only reuse an existing tab if the user asks. Fall back to another automation tool only when it is not connected, and tell the user you did.

Practical rules that save an entire session:

1. **Batch.** Predictable sequences (navigate → wait → click → wait → screenshot) go in one batched call. Coordinates in a batch refer to the screenshot taken *before* the call.
2. **Locate elements by what they are, not where they were.** Use the find/read-page calls to get a reference, then act on the reference. Coordinates and refs go stale after any navigation, HMR reload, or panel switch — re-locate rather than reusing.

   **A stale reference does not announce itself as one — it arrives wearing the costume of whatever
   you were about to test.** Fill two fields through refs read before the last navigation and the
   second fill can land in the first field: the form now holds one 38-character string where a
   username should be, the server answers "invalid credentials", and everything downstream reads as
   an authentication problem. Sessions have been spent resetting passwords, restarting servers, and
   dumping password hashes over exactly this. **Before believing any failure that a form fed, read
   back what the form actually holds** — one call returning each input's name and value length
   settles it, and it is cheaper than the first wrong hypothesis:

   ```js
   [...document.querySelectorAll('input')].map(e => (e.name || e.type) + ':' + (e.value || '').length)
   ```

   Two field lengths that make sense means the form is fine and the failure is real. One field
   carrying both means you are testing your own tooling.

   The same check catches a second, quieter version of it. A fill that writes straight to `value`
   moves the DOM without moving the framework's state, so the screen shows what you typed while the
   component still holds the old value — and a save then writes the old value back and reports
   success. That is indistinguishable from a form that silently discards edits, and it has been
   reported as exactly that. The tell is a **field that reads correctly and a request that does
   not**; when the two disagree, drive the field the way a keyboard does, or set it through the
   framework's own setter and dispatch the event it listens for:

   ```js
   const el = document.querySelector('input[name="licenseServerUrl"]');
   Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, 'text');
   el.dispatchEvent(new Event('input', { bubbles: true }));
   ```

   Prove the write landed before calling anything a defect: read the value back from the server, not
   from the screen that may only be showing your own keystrokes.

   **Clearing a field is the sharpest version of this.** Writing an empty string leaves the input
   looking empty while the component still holds the old value, so the request carries the value the
   operator thought they had deleted — and the screen agrees with them, right up until the saved
   record does not. A field a person emptied and a field a script emptied are different states, and
   only one of them reaches the code that treats "empty" as "unset". Clear the way a person does:
   focus the field, select all, press Backspace. Then check the request, not the input.
3. **Screenshot after every state change** you intend to judge. Judge layout from the screenshot; judge structure from the accessibility tree; when the two disagree, believe the screenshot and re-check.
4. **Watch the console AND the network while you walk** (`read_console_messages` / `read_network_requests`, filtered), so a failing request behind a spinner does not pass as "works" — and so wire-level defects surface: a query per row (N+1), duplicate fetches on mount, a mutation that triggers no refetch on the dependent surfaces (see `judgment-lenses.md` lens 3).
5. **Never trigger a native dialog** (`alert`/`confirm`) — it freezes the automation channel. Prefer in-app dialogs; if a control is known to raise a native one, tell the user rather than clicking it.
6. **Stay out of rabbit holes.** Two or three failed attempts at the same interaction means you stop and report what is blocking, not a fourth attempt.

---

## Login and personas

1. Open the login screen and use the test-account buttons when they exist (hand-typed credentials with special characters are a known source of wasted turns). Never enter real credentials.
2. To change persona: log out through the UI and log in as the next account. Keep a note of which account is in which tab.
3. If a needed role has no test account, stop and propose the seed change — do not mint state through the API to work around it.
4. **A rejected login is a claim about the request, not proof about the password.** Before touching
   credentials, find out which of the two failed. Server logs distinguish them: a line saying the
   username could not be extracted means the request carried no username — a form that never filled,
   a body shaped wrong, a field the client renamed — and the stored password is irrelevant to it.
   Only once the request is known to have carried both values does a rejection say anything about
   the credentials themselves.
5. **When several actors share one account, exactly one of them sets its password.** Everyone else
   reads it. Two parties who each read a rejection as "the password changed" will each reset it, and
   each reset invalidates the other's copy — a loop that looks from inside like a system corrupting
   credentials on its own. Whoever holds that authority says so once, and the others report failures
   instead of fixing them.

---

## Watching for a message the app raises

A toast is how most apps say a request failed, and it is easy to watch for the half that never
carries bad news. Frameworks commonly render success and info as `role="status"` and error and
warning as `role="alert"` — a live region that is polite versus one that interrupts. **Query only
one and the picture that forms is "successes appear, failures are silent",** which reads exactly
like a framework that drops error toasts, and is worth an hour before anyone re-reads their own
selector. Watch both roles, and confirm what the component actually emits before concluding that a
message was never raised:

```js
[...document.querySelectorAll('[role=alert],[role=status]')].map(e => e.getAttribute('role') + ': ' + e.innerText)
```

The same caution applies to any "nothing happened" finding: an absence you observed through one
selector is a claim about the selector until a second, differently-shaped check agrees.

---

## The checks that need the browser, and the script that carries them

Some defects are invisible to every source audit and to every request probe, and visible to
one `getBoundingClientRect` call. These recur, and all of them read as a working screen from
everywhere except the pixels:

| The defect | What every other check sees |
| --- | --- |
| a list total says N rows and the column under it draws none | the request answered 200 with N records, the component is imported, the props type-check |
| two pieces of text painted into one rectangle | every string on the screen is the right string |
| an open pane painting nothing — the reader pressed a tab and got a blank rectangle | a `return null` that is correct in a dozen other places, and a build with nothing wrong in it |
| a list scrolling inside itself while the page around it cannot move | the rows are all there, the layout classes read correctly, and a screenshot of it is a screenshot of a scrolling list |

**That table is what the defects feel like, and `--list` is what the script actually runs.** Three
of these were written down when three existed; enumerating them in prose is how a reader ends up
running a subset and reporting the rest as clean. Read `--list` before a walk and run every id it
prints.

**The pane check only sees the defect in the state that produces it**, which is almost never
the state a walk lands on: the record the pane renders exists in the seeded database, so the
screen has to be opened with the reads emptied (a `?data=empty`-style harness, a fresh
installation, a record nobody created) before the check has anything to report. Run it in
those states as well as the populated one — `compared 0` on a screen with tabs means the run
never reached a pane and proves nothing.

They live in `${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs`, **not** in
`audit-frontend.mjs` — that one reads source files and runs with nothing started, and these
are questions about boxes on a painted page. Keeping them apart is what stops a run reporting
「audit clean」 with no browser anywhere near it.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs" --url <address>   # drives agent-browser
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs" --print <id>      # the snippet, for this session's driver
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs" --selftest        # both directions, generated fixtures
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs" --list
```

**Run all of them over every screen the walk opens, while it is open.** The cost is one evaluate
call per screen and it settles a question no screenshot settles reliably — a reader scanning
a capture for a missing row is looking for an absence, which is the hardest thing to see.

**It needs a browser and refuses to answer without one.** `--url` with nothing reachable
exits 2 rather than 0; there is no source-only mode and no degraded mode, because a check
that passes without seeing anything is worse than no check — it converts *nobody looked* into
*something is checking*. Where the session is already driving a page through another tool,
`--print <id>` hands over one self-contained expression to evaluate through it.

Vocabulary — what a total reads like, what counts as a row, what an empty state says — is
`--options <json>` with documented defaults, so a product that writes its totals differently
overrides them instead of editing the script.

## A page's `innerText` is not what the page says

**Reading a screen by dumping `innerText` picks up text no reader can see, and the loudest of
those is a closed select's own mirror.** A Radix `Select` renders an `aria-hidden`, clipped native
`<select>` beside its trigger so a form can submit the value, and that mirror is built from the
option labels **as they stood when the items first mounted**. On a screen whose catalogue arrives
after the first paint — every lazily loaded locale namespace — the mirror keeps the untranslated
keys for the life of the page. The real dropdown, opened, reads correctly.

That failure wears the exact costume of the bug you are hunting: a session fixing a select's
labels read `MailTransportSecurity.NONE` out of `innerText` after the fix, concluded the fix had
not taken, and spent a detour on the i18n registry before opening the list and finding 「없음」.

- **A closed select is settled by opening it**, never by reading the page's text:
  `document.querySelectorAll('[role=option]')` after a press on the trigger.
- **Anything `aria-hidden` is out of scope for what the screen says.** When a text dump is the
  quickest read, strip them first, or scope the read to a region that holds none.
- The same holds for any offscreen mirror a component keeps for measurement — the `compact`
  select's width-measuring `<select>` is one.

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

## Judging responsive behaviour — load at each width, never resize what is already mounted

A tab opened by automation is backgrounded: `document.visibilityState` is `"hidden"`, so the browser runs no rendering steps for it. `requestAnimationFrame` never fires, and — the part that costs a session — **`ResizeObserver` never delivers a callback**, not even the initial one that `observe()` normally schedules. `IntersectionObserver` is out for the same reason.

Layout itself still happens: set a width and `getBoundingClientRect` reports the new box. What does NOT happen is everything downstream of an observer. So a tree that is already mounted keeps every width-derived decision it made at mount, and shrinking its container with JavaScript measures a half-updated screen.

**Method**: judge width-dependent behaviour at MOUNT, one load per width. Load the page fresh in a same-origin iframe sized to the target width (or a new tab/window at that size), and read it there. Never form a verdict by mutating the width of a tree that is already on screen.

```js
// Is this tab frozen? Run once before judging anything width-dependent.
({
  visibility: document.visibilityState,
  raf: await Promise.race([
    new Promise((r) => requestAnimationFrame(() => r("runs"))),
    new Promise((r) => setTimeout(() => r("frozen"), 1000)),
  ]),
})
// visibility "hidden" + raf "frozen"  →  observer-driven behaviour will not react to a resize here
```

**Suspect this BEFORE writing a framework defect.** Two shapes it takes, both of which read as broken components:

1. **A control row that should collapse below a breakpoint does not.** A toolbar that swaps a row of buttons for a single select, a table that hides columns, a nav that folds into a rail — the threshold is crossed and nothing happens, because the observer that watches the container is silent. Load the same page fresh at that width and it collapses correctly.
2. **A canvas or charting library keeps a stale width.** Libraries that size to their container measure once and re-measure on a resize signal. Frozen, the drawing holds whatever width it had at mount and appears to spill far past its container — a horizontal overflow that exists only in this tab.

Neither is a defect. Reproduce at mount before reporting either, and say in the report which widths were loaded rather than resized.

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
