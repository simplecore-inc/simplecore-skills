# Browser Driving - how the audit is actually executed

The browser is the instrument. Everything below is about keeping it honest and keeping it fast.

---

## Environment

**On the local machine the servers are yours to run.** An audit that stops to ask before every restart cannot cover a feature area, and the restart is not optional - it is the difference between a defect and a stale build. Start, restart, and stop the app and its API as the work needs, within these bounds:

1. **Take the commands from the project, never from memory** - whatever it documents under its own `.claude/`, else its README, package scripts, Gradle tasks, or compose file: how the app and the API start and stop, how a workspace package is rebuilt, and whether the dev server is HTTPS with a self-signed certificate. **Where it is, a CLI driver takes its ignore-certificate flag on the session's FIRST command**: certificate and viewport flags apply when the session's context is created, so a session that ran anything first fails every navigation and no later flag changes it. A daemon already in that state is closed by name and started again with the flag.
2. **Read the port from the server's own output or a readiness probe.** A dev server that finds its usual port taken silently moves to another one, so a hardcoded port verifies the wrong thing - or nothing.
3. **Reclaim only a port you own.** A port held by a development server from an earlier session of *this* project is stopped and replaced. A process you cannot identify as this project's dev server is left alone, and reported instead.
4. **Local only.** Remote hosts of any kind - production, staging, shared development - and orchestrators outside this machine are out of scope. Ask first.
5. **Leave the environment as you found it.** Stop what you started once the work no longer needs it, and say in the report what you left running and why. **A named browser session counts here and is the one that gets forgotten** - a CLI driver such as `agent-browser` keeps one background daemon and one full Chrome instance per session name, reused between commands and ended only by an explicit `close` on that name. It survives your last command and it survives you, so a sweep that opens one per screen and closes none leaves one browser resident per screen. Close by name on every path out including the failing one, and **never the driver's `close --all`** - the daemon is shared, so that flag ends every other agent's session too. The script in *The checks that need the browser* closes the session it opened and leaves one that was already running alone; a session you opened by hand is yours to close.

Then, before trusting anything on screen:

6. **Confirm the build is current.** The app is served from workspace packages; a failed or stale build serves old output, and old output looks exactly like a missing translation, a vanished column, or an unstyled control. When the screen disagrees with the source, restart the dev server and look again *before* writing it down as a defect.
7. **Confirm the API is up** (a readiness probe against the backend) - an area that renders empty because the API is down is not an empty-state defect.
8. A change to a workspace package reaches the browser through a hot reload. When it does not, check that entry's `"source"`.

---

## The driver

The audit runs through the session's own browser driver. The plugin does not choose one: the driver
the session prefers wins, and a different one is used only when the preferred one cannot express the
task or is not connected, with the change stated in the report. The driver has to provide:

| Capability | What the audit uses it for |
| --- | --- |
| open a URL, with control over certificate errors and viewport at the start of a session | reaching a development server, loading a page fresh at one width |
| evaluate a script in the page and return its value | the verdict snippets, the rendered audit's snippets, form read-backs, every "run this snippet in the page" below |
| click, type and press keys the way a keyboard does, select text | driving forms and controls without bypassing the framework's state |
| locate an element by role, label or text, or read an accessibility snapshot with element references | acting on what an element is, not where it was |
| capture a screenshot | judging layout, and the evidence for a finding |
| read console messages and network requests | a failing request behind a spinner, a query per row, a mutation that refetches nothing |
| open a second tab or context and keep sessions apart | playing several actors side by side |

The common drivers are examples of drivers that provide this: `ego-browser`, `agent-browser`,
Playwright and the Claude in Chrome MCP (`mcp__claude-in-chrome__*`). A browser's own developer-tools
console covers the "evaluate a script" row alone. Their calls differ; this handbook names the capability and
leaves the call to the driver. Every recipe below that needs a signed-in page is "run this snippet in
the page through your driver", and works the same through any of them.

Start every session by listing the driver's existing tabs or contexts, create a fresh one for the
audit, and reuse an existing one only if the user asks.

Practical rules that save an entire session:

1. **Batch where the driver can.** Predictable sequences (navigate → wait → click → wait → screenshot) go in one batched call or one script. Coordinates in a batch refer to the screenshot taken *before* the call. A scenario of several steps (sign in, create, act, read back) is one invocation that signs in and then works, so the session it works in is the one it signed in; separate invocations each assume a session that another sign-in on the same profile may have replaced.
2. **Locate elements by what they are, not where they were.** Use the driver's locator or snapshot to get a reference, then act on the reference. Coordinates and refs go stale after any navigation, HMR reload, or panel switch - re-locate rather than reusing.

   **A stale reference does not announce itself as one - it arrives wearing the costume of whatever
   you were about to test.** Fill two fields through refs read before the last navigation and the
   second fill can land in the first field: the form now holds one long string where a username
   should be, the server answers "invalid credentials", and everything downstream reads as an
   authentication problem, which sends the work into password resets, server restarts and credential
   dumps. **Before believing any failure that a form fed, read back what the form actually holds** -
   one call returning each input's name and value length settles it, and it is cheaper than the
   first wrong hypothesis:

   ```js
   [...document.querySelectorAll('input')].map(e => (e.name || e.type) + ':' + (e.value || '').length)
   ```

   Two field lengths that make sense means the form is fine and the failure is real. One field
   carrying both means you are testing your own tooling.

   The same check catches a second, quieter version of it. A fill that writes straight to `value`
   moves the DOM without moving the framework's state, so the screen shows what you typed while the
   component still holds the old value - and a save then writes the old value back and reports
   success. That is indistinguishable from a form that silently discards edits, and reads as exactly
   that defect. The tell is a **field that reads correctly and a request that does
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
   operator thought they had deleted - and the screen agrees with them, right up until the saved
   record does not. A field a person emptied and a field a script emptied are different states, and
   only one of them reaches the code that treats "empty" as "unset". Clear the way a person does:
   focus the field, select all, press Backspace. Then check the request, not the input.
3. **Screenshot after every state change** you intend to judge. Judge layout from the screenshot; judge structure from the accessibility tree; when the two disagree, believe the screenshot and re-check.
4. **Watch the console AND the network while you walk** (the driver's console and network reads, filtered), so a failing request behind a spinner does not pass as "works" - and so wire-level defects surface: a query per row (N+1), duplicate fetches on mount, a mutation that triggers no refetch on the dependent surfaces (see `judgment-lenses.md` lens 3).
5. **Never trigger a native dialog** (`alert`/`confirm`) - it freezes the automation channel. Prefer in-app dialogs; if a control is known to raise a native one, tell the user rather than clicking it.
6. **Stay out of rabbit holes.** Two or three failed attempts at the same interaction means you stop and report what is blocking, not a fourth attempt.

---

## Login and personas

1. Open the login screen and use the test-account buttons when they exist (hand-typed credentials with special characters are a known source of wasted turns). Never enter real credentials.
2. To change persona: log out through the UI and log in as the next account. Keep a note of which account is in which tab.
3. If a needed role has no test account, stop and propose the seed change - do not mint state through the API to work around it.
4. **A rejected login is a claim about the request, not proof about the password.** Before touching
   credentials, find out which of the two failed. Server logs distinguish them: a line saying the
   username could not be extracted means the request carried no username - a form that never filled,
   a body shaped wrong, a field the client renamed - and the stored password is irrelevant to it.
   Only once the request is known to have carried both values does a rejection say anything about
   the credentials themselves.
5. **When several actors share one account, exactly one of them sets its password.** Everyone else
   reads it. Two parties who each read a rejection as "the password changed" will each reset it, and
   each reset invalidates the other's copy - a loop that looks from inside like a system corrupting
   credentials on its own. Whoever holds that authority says so once, and the others report failures
   instead of fixing them.
6. **A run closes its pages before it deletes its account.** A page left open keeps the token of an
   account that no longer exists and keeps saving to it (the language is written on every switch),
   and the identity provider answers 404. The product must say "identity missing" there, not
   "outage"; an outage message at that moment points at the run's own cleanup order. A run that
   signs in first clears tokens that name another account (a deleted account's or another agent's),
   because the shell draws for any stored session.

---

## Watching for a message the app raises

A toast is how most apps say a request failed, and it is easy to watch for the half that never
carries bad news. Frameworks commonly render success and info as `role="status"` and error and
warning as `role="alert"` - a live region that is polite versus one that interrupts. **Query only
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
| an open pane painting nothing - the reader pressed a tab and got a blank rectangle | a `return null` that is correct in a dozen other places, and a build with nothing wrong in it |
| a list scrolling inside itself while the page around it cannot move | the rows are all there, the layout classes read correctly, and a screenshot of it is a screenshot of a scrolling list |
| text or an icon painted in a colour too close to the ground behind it | the colour is a token, the ground is a token, and the two are never written in the same place; the theme the author looked at reads fine |

**That table is what the defects feel like, and `--list` is what the script actually runs.**
Enumerating the checks in prose is how a reader ends up running a subset and reporting the rest
as clean. Read `--list` before a walk and run every id it prints.

**The pane check only sees the defect in the state that produces it**, which is almost never
the state a walk lands on: the record the pane renders exists in the seeded database, so the
screen has to be opened with the reads emptied (a `?data=empty`-style harness, a fresh
installation, a record nobody created) before the check has anything to report. Run it in
those states as well as the populated one - `compared 0` on a screen with tabs means the run
never reached a pane and proves nothing.

**The contrast check needs one run per theme.** A column given a dark ground while its labels keep
the page's own foreground reads fine in the theme where that foreground is light and draws ink on
near-black in the other, so a run in one theme has read half the pairs. Switch the mode (the class
or attribute the product's theme reads), run `textContrastBelowMinimum` again, and read the
findings of both; a ground that is an image is reported as `skippedOverImage` and is not judged.

They live in `${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs`, **not** in
`audit-frontend.mjs` - that one reads source files and runs with nothing started, and these
are questions about boxes on a painted page. Keeping them apart is what stops a run reporting
「audit clean」 with no browser anywhere near it.

```bash
A="${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs"
node "$A" --list                          # every check: id, grade, and what it catches
node "$A" --print <id> > <scratch>/check.js     # one snippet, for the session's own driver
node "$A" --print-all > <scratch>/checks.json   # every selected check as JSON [{ id, grade, snippet }]
node "$A" --url <address>                 # its own agent-browser session - only where nothing asks to sign in
node "$A" --selftest                      # both directions, generated fixtures, through agent-browser
```

Flags: `--check <id>` narrows `--url`, `--print-all` or `--selftest` to one check; `--session <name>`
names the agent-browser session `--url` and `--selftest` use; `--keep-session` leaves a session the run
opened running, for a caller that runs the script several times against one screen; `--options <json>`
or `--options @<file>` overrides the vocabulary (below). An unrecognised flag or check id stops the
run with exit 2.

**On a product that needs signing in, do not use `--url`.** It opens a browser session of its
own, which lands on the sign-in screen, and a self-signed development certificate needs the flag
from § Environment on that session's first command. Print the snippets instead and evaluate them in
the session that is already signed in, through whatever driver holds it: `--print-all` once, then one
evaluate call per check, or `--print <id>` for a single check. Each snippet is one self-contained
expression that returns `{ compared, findings }` and touches nothing on the page.

**Run all of them over every screen the walk opens, while it is open.** The cost is one evaluate
call per screen and it settles a question no screenshot settles reliably - a reader scanning
a capture for a missing row is looking for an absence, which is the hardest thing to see.

**Reading a result.** A check reports how many things it compared as well as how many it found:
`compared 0` means the check reached nothing on this screen (a form has no list, or the screen had
not finished arriving) and proves nothing, so `--url` prints it with `○` rather than `✔`. Exit 1 means
an error-grade check has findings; exit 2 means a browser could not be driven or the arguments were
wrong. `--url` measures again until two readings compare the same number of things, so it does not
judge a list shell before its rows arrive; a snippet evaluated through another driver is run after the
screen has settled, by the caller.

**It needs a browser and refuses to answer without one.** `--url` with nothing reachable
exits 2 rather than 0; there is no source-only mode and no degraded mode, because a check
that passes without seeing anything is worse than no check - it converts *nobody looked* into
*something is checking*. `--url` and `--selftest` need `agent-browser` on the path; the printed
snippets need only a driver that can evaluate a script.

Vocabulary - what a total reads like, what counts as a row, what an empty state says - is
`--options <json>` with documented defaults, so a product that writes its totals differently
overrides them instead of editing the script.

### A state is read once it stands, and the reading says which state it was

A fixed wait after pressing a row is a guess about the slowest part of the page. A drawer that
slides in only after the record's read answers was still outside the window 1.2 s after the press,
so every "detail: no findings" a runner printed was a reading of the list with no record on it, and
nothing in the output said so. Wait for the thing the state is about (the panel inside the window
and not moving between two reads), and only then run the checks. A tab on no display also advances
its frames only while something asks for them, so an animation a width change started (a list
column sliding back) can still be under way after a long wait: wait for running finite animations
(`document.getAnimations()`, an infinite spinner excluded) and finish what is left before reading.
A reading that turns from clean to failing once it is taken at the right moment was never clean.

## A page's `innerText` is not what the page says

**Reading a screen by dumping `innerText` picks up text no reader can see, and the loudest of
those is a closed select's own mirror.** A Radix `Select` renders an `aria-hidden`, clipped native
`<select>` beside its trigger so a form can submit the value, and that mirror is built from the
option labels **as they stood when the items first mounted**. On a screen whose catalogue arrives
after the first paint - every lazily loaded locale namespace - the mirror keeps the untranslated
keys for the life of the page. The real dropdown, opened, reads correctly.

That failure wears the exact costume of the bug you are hunting: after a fix to a select's labels,
`innerText` still reads `<Enum>.<VALUE>` from the mirror, the fix looks as if it had not taken, and
the work detours into the i18n registry although the opened list shows the translated label.

- **A closed select is settled by opening it**, never by reading the page's text:
  `document.querySelectorAll('[role=option]')` after a press on the trigger.
- **Anything `aria-hidden` is out of scope for what the screen says.** When a text dump is the
  quickest read, strip them first, or scope the read to a region that holds none.
- The same holds for any offscreen mirror a component keeps for measurement - the `compact`
  select's width-measuring `<select>` is one.

## Verdict snippets

Small, safe checks that settle a question the eye cannot. Run them through the tool's JavaScript call, read the result, and move on. (Adapt selectors to the current markup - these are shapes, not incantations.)

**Scroll ownership** - does the detail panel clip its content with nobody owning the scroll?

```js
const panel = document.querySelector('[data-detail-panel], article');  // the detail container
({
  clipped: panel.scrollHeight > panel.clientHeight,
  innerScroller: [...panel.querySelectorAll('*')].some(el =>
    ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight),
})
// clipped: true + innerScroller: false  →  defect: the child must own the scroll
```

**Ids on screen** - is a UUID visible anywhere a human reads?

```js
[...document.querySelectorAll('h1,h2,h3,h4,td,dd,span')]
  .map(el => el.textContent.trim())
  .filter(t => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t))
```
Non-empty → a title/field is showing an identifier instead of a name.

**Untranslated text** - raw enum names or i18n keys leaking through:

```js
[...document.querySelectorAll('body *')]
  .filter(el => el.children.length === 0)
  .map(el => el.textContent.trim())
  .filter(t => /^[A-Z][A-Z0-9_]{2,}$/.test(t) || /^[a-z]+\.[a-z]+\./i.test(t))
```
Review the hits - legitimate acronyms and product names (CSV, API, a brand) match the first pattern; a dotted i18n key or a SNAKE_CASE enum name is the real leak.

**Button placement** - actions rendered outside a footer:

```js
[...document.querySelectorAll('button')]
  .filter(b => b.offsetParent && !b.closest('footer, [data-footer], [data-page-header]'))
  .map(b => b.textContent.trim())
  .filter(Boolean)
```
Read the list as the persona: anything that is a record-level action (save, submit, approve, delete, check in) belongs in the footer.

---

## Judging responsive behaviour - load at each width, never resize what is already mounted

A tab opened by automation is backgrounded: `document.visibilityState` is `"hidden"`, so the browser runs no rendering steps for it. `requestAnimationFrame` never fires, and - the part that costs a session - **`ResizeObserver` never delivers a callback**, not even the initial one that `observe()` normally schedules. `IntersectionObserver` is out for the same reason.

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

1. **A control row that should collapse below a breakpoint does not.** A toolbar that swaps a row of buttons for a single select, a table that hides columns, a nav that folds into a rail - the threshold is crossed and nothing happens, because the observer that watches the container is silent. Load the same page fresh at that width and it collapses correctly.
2. **A canvas or charting library keeps a stale width.** Libraries that size to their container measure once and re-measure on a resize signal. Frozen, the drawing holds whatever width it had at mount and appears to spill far past its container - a horizontal overflow that exists only in this tab.

Neither is a defect. Reproduce at mount before reporting either, and say in the report which widths were loaded rather than resized.

---

## Selecting records and tabs in every locale

A driver that opens a record by its visible name or a tab by its label times out the moment the
locale changes. Select a row by `[data-testid^="list-row-"]` with the id taken from the list
response (the card layout a narrow list falls into has no `tr`), a tab by
`[aria-controls$="-content-<value>"]`, and match a response item on its own id field, never on
"the id appears in the item" (`createdBy` carries the signed-in account's id). Take routes from
`apps/<app>/src/routes/`, never from a menu label, and pick "the first record" per route: the
first row may be the development account, and a grouped list opens nothing on its first row. A
locale pass answers the account read (`/user/me`) as the locale under test, matching
`"locale"\s*:` since the body may be pretty-printed, and aborts every non-GET.

The account's saved locale decides the language, not the browser's storage: a pass that sets only
`localStorage["i18n:locale"]` measures one language twice. Set it through the account
(the project's own locale endpoint) or answer the account read as above, and let
`compare-rendered.mjs`'s language warning confirm it. A locale write answered 200 right after a
browser sign-in can be undone by the app's next load (the account read answered the old locale and
the app rewrote its stored choice), so read `<html lang>` after a reload and set it again until it
holds, failing the run when it never does; a run that trusts the 200 reads one language twice and
reports no finding. Read every screen in each language: a section title that repeats its own field's
label, or a header clipped by its longer label, can exist in one language only.

A scripted press names exactly one element, and the runner that presses refuses a selector matching
several. `querySelector` takes the first match, so a press written by tone or position
(`[data-slot="<table>"] [data-tone="secondary"]:not(:disabled)`) presses whatever the page draws first:
the day a new row draws a secondary action above the intended one, the run presses that action,
navigates elsewhere, and reports the other page's differences as the state's. Select by the
control's own identity (`[data-action="<id>"]`, its accessible name in the locale under test, an id
from the response), have the press count the matches and click only when there is one, and fail the
row naming the selector and the count otherwise.

Several responses of one endpoint can arrive on one screen (a tab count asks with `size=1`), so a
driver that keeps the last response reads the wrong page; keep every response's content and pick
by its query. A filter result is asserted against the operator's case semantics: `contains` is
case-insensitive, so `name.contains=Shop` also returns `e2e-shop-a`.

A presentation the reader picked is remembered only while "remember in this browser" is on. With it
off, a reload returns to the installation's default presentation, so a proof that a width is not
remembered picks the presentation again before reading the width.

A scratch driver or helper derives every repository path from one root (`git rev-parse
--show-toplevel`, or one constant), so a folder rename breaks one line and fails loudly; an absolute
path to a moved folder fails with `ENOENT` before the first page opens. Its log names the framework
commit and the helper version on its first line, so a run that spans a fix cannot pass for a fresh
one.

A development server on a self-signed certificate (`https://localhost:<port>`) that the session's
driver refuses with `ERR_CERT_AUTHORITY_INVALID`, and offers no override for, is driven with a driver
that can ignore certificate errors (Playwright with `ignoreHTTPSErrors: true`), and the report says
the instrument changed.

## A charting library's defaults read as a broken component

A chart legend that draws and does nothing, a slice that will not hide, a series that will not
toggle - the adapter is almost never what is wrong. **Measure the library's own state before
writing a framework defect**, and say in the report which of these it was.

**First: is the thing you clicked on screen at all?** A legend under a tall chart, or inside a
scrolling dialog, sits far below the fold. `document.elementFromPoint(cx, cy)` returning `null`
for the element's own centre means it is outside the viewport - synthetic pointer events at those
coordinates land nowhere, and a text-locator click lands on whatever ELSE on the page carries the
same words, which for a chart is nearly always a table row naming the same category. Scroll it
into view and re-read `elementFromPoint`; only then is a negative result about the chart.

```js
// Before concluding anything about a chart control:
[...document.querySelectorAll(".apexcharts-legend-series")].map((i) => {
  const r = i.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { text: i.textContent, onScreen: i.contains(top) };
});
```

**Then: the ApexCharts defaults that read as a dead control.**

1. **A single-series axis chart draws no legend at all.** `legend.showForSingleSeries` defaults to
   `false`, so a line/bar/area chart given one series renders an EMPTY `.apexcharts-legend` div:
   the box is in the DOM, no `.apexcharts-legend-series` item is. Nothing renders, so nothing can
   be clicked, and no amount of synthesised clicking will change that. The series name is not
   lost - it is in the tooltip. Count the items before judging: zero means there is no control,
   not a broken one.
2. **A pie/donut legend click SELECTS the slice; it does not collapse the series.** Non-axis
   charts route the click to slice selection: the slice path gets `selected="true"` and an active
   `filter`, while the legend item keeps its classes. It never sets `data:collapsed`, never adds
   `apexcharts-inactive-legend`, and the other slices keep their geometry - so "the percentages
   did not change and no inactive class appeared" is the library working, checked against the
   wrong signal. Collapse-on-click is the AXIS-chart behaviour, and it needs two or more series.

So the check that separates a defect from a default reads BOTH signals before and after one real
click - the legend item's `class` and `data:collapsed`, and the slice path's `selected` and
`filter`. A run that watched only `apexcharts-inactive-legend` answers "broken" on every pie and
every one-series chart in the product.

**The trap is that it fails identically on every screen drawing the same kind of chart**, which
reads as proof that the shared adapter is at fault. Screens drawing the same KIND of chart share the
library's default, not a bug. Confirm on a chart of a different kind - a multi-series axis chart - before naming the
adapter.

---

## Test-data hygiene

The audit runs against a live development database, and every flow you complete leaves records behind. Valid records are an asset; broken ones are noise.

1. **Restore what you mutate.** When a check edits a pre-existing record to prove a round-trip (change a value, save, re-read), put the original value back through the UI once the verdict is in.
2. **Valid test data stays.** A record you created correctly and drove through its flow is left in place - it documents the walked scenario and serves as reference data for later sessions. Give created records recognizable, realistic names so they read as scenario data, not garbage.
3. **Only erroneous data is removed.** Delete (through the UI) records that carry wrong input, were half-created by a failed submit, or were stranded mid-flow by a defect. If such a record cannot be removed through the UI, the missing delete/cancel affordance is itself a finding.
4. **Report the ledger.** List what was created and kept (per flow), and what was removed and why.
5. **A scripted write asserts its target first.** Before a script saves, it checks that the record it is about to change is one the audit created or one of its own test accounts, and aborts otherwise. A picker is chosen by the option's exact name, and the pick is read back before the write. Never "the first option": a search that does not narrow puts a real account first. A holder probe that takes the first option files a protected operator account into a test position through a picker that ignored the typed text; the probe and the picker are both defects.
6. **A seeded row in a table every server polls is out of your hands.** Every API server on the
   machine works the same queue table, so an older build claims and fails a queued job seeded for
   the pass within minutes. When the pass only needs a queued row, seed it with a future `run_at` or
   a type no worker handles.
7. **Reference rows are never inserted by hand SQL into the shared development database.** A row a
   scenario needs (a record another record points at) is created through the entity's own write path
   or a backend seed. When neither exists, the report says the create path was not driven and names
   the entity, instead of standing in for it with an insert that no screen, validation or audit
   trail has seen.

---

## Evidence and honesty

1. Keep the screenshot (or the failing console line) that establishes each finding; a finding you cannot show is a finding you will retract later.
2. When a check contradicts an earlier one, say so in the report and give the resolved answer - "this looked broken in the tree but renders correctly" is a legitimate, useful line.
3. Reading the API to *observe* what the server stored (after a UI save, to confirm the wire value) is allowed and encouraged. Writing through the API to *create or move* state is exempted only for external-system state (device events, scheduler output, time passage) and must be declared - see SKILL.md § Ground Rules.
