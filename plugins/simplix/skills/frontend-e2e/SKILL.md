---
name: frontend-e2e
description: Use when a task asks to drive a simplix-react frontend through a real browser and judge it — walking a feature area as a user, exercising a lifecycle across screens, checking that functionally connected screens agree (values, states, counts, terminology), finding what is confusing / missing / unusable, reviewing a menu tree end to end, or verifying a delivered feature the way an operator would use it. Cues: 사용자 관점 · 처음 접하는 사용자 · 직접 사용해 보며 · 전수 점검 · 전체 흐름 · 라이프사이클 · E2E · 사용성 점검 · 화면 검토 · 화면 간 연동 · 화면 대조 · 일관성 점검 · UI/UX 관점 · 브라우저로 확인 · 개선점 찾아줘 · 빠진 기능 · 쓸 수 없는 화면. Also use before declaring a feature complete when its screens have never been driven by hand. NOT for unit tests, typecheck / lint runs, or a single-component visual tweak.
version: 1.0.0
---

# Frontend E2E Audit Handbook

A screen that renders is not a screen that works, and a screen that works alone is not a product. This handbook drives the running application through a real browser, audits functionally connected screens as one cluster, judges what it sees through four lenses (persona, UI/UX reviewer, backend developer, framework auditor), and turns "I don't understand this", "I can't do this", and "these two screens disagree" into fixed defects.

It is the **testing** counterpart of the `simplix:frontend` skill — and that skill is not only where fixes are written: its invariants and precedent screens are the rubric this audit judges WITH.

---

## This is a completion gate, not an optional pass

**A change that touched a screen is not done until that screen has been driven here.** Not when the build is green, not when the diff reads correctly, not when the component renders in isolation. Those are the conditions under which the browser pass gets skipped, and they are exactly the conditions under which the defects this audit exists to find survive: a filter that returns nothing, an empty state that never renders, a dialog that cannot be dismissed, two screens that disagree about the same record.

So the gate is mechanical. When the project arms it (`e2eGate` in `<subproject>/.claude/simplix.json`), the plugin's `Stop` hook refuses to let a session end after UI files changed if this skill was never invoked. It fires once, and it can be answered two ways:

1. **Walk the screens.** The default. Take the changed screens and the ones either side of them through the census below.
2. **Say why there is nothing to walk** — a refactor with no reachable screen, a change the user asked to keep to code. State it plainly; do not silence the gate with `SIMPLIX_E2E_GATE=off` on a change that has screens.

What the gate cannot check is scope, and scope is where this pass is usually lost. Driving the one screen you edited is not the audit: the unit is the **cluster** — every surface that shows or moves the record — because a screen that passes alone and disagrees with its neighbour is the defect that reaches the operator.

**When the project has not armed the gate**, say so once and offer `/simplix:init` — it writes the config. Until then the discipline holds only while somebody remembers it, which on a green build is not long.

---

## The audit runs in a subagent — one per cluster

Screenshots, accessibility trees, console dumps, and network logs are what this audit is made of, and they are also what fills a context fastest. Run in the session that is coordinating the work, an audit of any real size dries that context out partway through — and the half it does not reach is indistinguishable from a half that passed. A cluster abandoned at 80% leaves fixes half-applied and a report that reads as complete.

So the browser work is delegated, and `simplix:screen-auditor` ships with this plugin to be delegated to. It carries the whole of this handbook's execution half: how to drive, the personas, the five censuses, the four lenses, the fix rules, and the exact shape of what it returns.

1. **One cluster, one auditor.** Hand it the cluster (the entity and every surface that shows or moves it), the personas, and the base URLs. It reads this skill, the `simplix:frontend` handbook, and the code itself.
2. **Finish, then replace.** A new auditor for the next cluster. Never stack a second cluster on a running one.
3. **One at a time.** An auditor fixes code and drives the dev server, so two of them in one working tree collide over the same files and the same ports. Sequence them, or give each its own worktree and its own ports.
4. **It returns conclusions, never contents** — defects with their anchors, the cross-sweep per type, agreement results, the data ledger, verification. No screenshots, no page text. Captures that justify a finding go to files, and the report carries their paths; the coordinator surfaces a path **without opening it**, so the image renders for the reader and never enters the context.
5. **The coordinator only coordinates.** Picks the next cluster, aggregates the returns, decides what needs a human. It does not open the browser.

**When to skip the delegation:** a single screen, already scoped, whose whole cluster is one surface — the setup cost is not worth it. The moment the cluster is more than one screen, delegate. Judging that by "this will be quick" is how the context gets spent, because the audit's whole purpose is finding the parts you did not expect.

Watching it happen costs nothing: the auditor's own browser turns stream to the client and can be expanded in the conversation, while the coordinator never receives them.

---

## How to Use

Steps 3 to 8 are the auditor's work, per cluster; steps 1, 2, and 9 are the coordinator's.

1. Read **Ground Rules** below — they are what separates an audit from a demo.
2. **Load the judgment rubric**: invoke the `simplix:frontend` skill now if it is not already loaded this session. Its Non-Negotiable Invariants, Task Router references, and `customize/precedent-check.md` comparison sheet are the standard of "correct" for every judgment below → `references/judgment-lenses.md`.
3. Define the **personas** and the **lifecycle flows** for the area under test → `references/personas-and-flows.md`.
4. Build the **screen cluster** — every surface that shows or moves the entity is audited together, never screen by screen → `references/cross-screen-consistency.md`.
5. Drive the browser → `references/browser-driving.md` (setup, login, multi-actor tabs, verdict snippets).
6. Sweep every screen against the **full-sweep checklist** → `references/screen-checklist.md`, and run the **four judgment lenses** per cluster → `references/judgment-lenses.md`. This is a census, not a spot check.
7. Run the **agreement censuses** across the cluster → `references/cross-screen-consistency.md`.
8. Fix under the `simplix:frontend` skill (CUSTOMIZE for widget work, SCAFFOLD when the contract moves, AUDIT after). Backend gaps are implemented in the backend — see Fixing, below.
9. Close out → **Cross-sweep, Skill Feedback, Report**.

---

## Ground Rules

1. **Drive the browser, not the API.** Every action a user would take is taken in the browser with the session's browser-automation tool (typically the Claude in Chrome MCP, `mcp__claude-in-chrome__*`; fall back to another automation tool only when it is not connected, and say so). A direct API call is allowed to observe (reading a response the UI already fetched, checking what the server stored) — never to create, transition, or repair state that any persona could produce through the UI. If a persona could reach the state and you cannot, that is a finding — the missing path IS the defect; record it and fix it, do not `curl` around it. The only exemption is state that NO user produces through this UI by design — hardware/device events, batch-scheduler output, the passage of time. Seeding those outside the UI is legitimate scaffolding, but each instance is declared in the report with why the UI could not produce it.
2. **Wear the persona, and do not break character.** Every area has an owner (a desk operator, an administrator, an ordinary employee). Judge the screen with that person's vocabulary and goals. An area meant for ordinary employees that exposes administrator terms, internal ids, or configuration fields is defective by that fact alone — no further justification needed.
3. **A flow, not a screen — and a cluster, not a module.** Never audit a screen alone. Take the entity through its whole life across every screen that touches it (create → submit → approve → act on → close → reverse/cancel), and end where the record can no longer move. A state with no exit is a defect even if every screen renders. The screens that show the record — other personas' surfaces, dashboards, nav badges, peek dialogs on other modules' pages — are audited together as one cluster, with the agreement censuses of `references/cross-screen-consistency.md`; two screens that each pass alone and still disagree with each other are a defect.
4. **Judge against the handbook, not taste.** The `simplix:frontend` skill is loaded during the audit and consulted while judging — not only when fixing. Every finding is anchored: an invariant number, a precedent screen (via its `customize/precedent-check.md`), a server contract, or a concrete persona failure (`references/judgment-lenses.md`). A finding with no anchor is an opinion — it may enter the report as a proposal, never as a defect.
5. **Multiple actors are played in sequence, for real.** When a flow needs a second person (a requester and an approver, an operator and a security manager), log in as each — sequentially in one tab, or in a second tab kept side by side. Do not assume the counterpart's screen "probably works".
6. **Look at every element on the screen.** Each field, column, button, badge, filter, and empty area is asked three questions: does it mean something to this persona, is something missing that they need here, and is something here that should not be. Silence on an element means you did not look at it.
7. **Never claim from a screenshot alone what an interaction would settle.** Scroll it, click it, submit it, break it on purpose. An accessibility-tree reading that looks wrong is re-checked against a screenshot before it becomes a finding — and vice versa; phantom findings cost more than missed ones.
8. **A stale build lies, so restart rather than reason about it.** The local dev server and its API are yours to start, restart, and stop as the work needs — an audit that has to ask before every restart cannot cover a feature area. Take the commands from the project, read the port from the server's own output, and when the screen disagrees with the source, rebuild or restart and look again *before* writing anything down. A missing translation or a vanished column is more often a failed build than a bug. Details, including which port you may reclaim → `references/browser-driving.md` § Environment.
9. **Do not commit.** Report; the user commits.

10. **Where the project has a wireframe board, it is the third opinion.** The board says what each screen holds, in which state, and how the user moves between them — so a screen that renders and works can still disagree with the contract it was built against. When one exists, read the frame for each screen in scope (`simplecore:wireframe-boards`) and treat a code ⇄ board disagreement as a finding on whichever side is stale. Reconciling *every* frame of a board is a different, longer job with its own discipline → `simplecore:board-parity-walk`.

---

## The Five Mandatory Censuses

These run over EVERY screen in scope, exhaustively — not sampled. The first four have detection recipes in `references/screen-checklist.md`; the fifth runs over the cluster in `references/cross-screen-consistency.md`.

1. **Button placement.** Actions live in the footer of the detail/form surface (`CrudDetail.DefaultActions` / `CrudForm.Actions`), and the page's primary create action lives in the page header's action slot. A button floating mid-page, a row of buttons above a list, or an action buried between form sections is a defect unless the action is genuinely scoped to the section it sits in (an "add row" inside a repeatable list, a per-row action in a table). When in doubt, move it to the footer.
2. **Header / footer standard composition.** Every routed page registers its title through the page-header hook and takes its padding from the app layout; every detail/form panel uses the framework's header/body/footer chrome. A locally rendered heading, an ad-hoc close button, a hand-rolled title row, or a panel whose content is clipped because nothing owns the scroll are all defects.
   - **A header that is ABSENT rather than wrong is not a screen defect — it is the shell never receiving what the page published. Separate the two causes by WHICH pages lost it, before touching anything.** Every page past one package boundary (all `modules/*` pages, app pages fine) → duplicate copies of a context-owning package; run `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-duplicate-contexts.mjs"` — one command. Only SOME pages, no boundary in common → a lifecycle bug in the header hook itself; read the installed hook's source before theorising. Do not report either cause from reasoning alone — the DOM settles it: header element ABSENT means no title ever reached the store, PRESENT but blank means it arrived empty. Both mechanisms in full → `simplix:frontend` invariant #60 (its `references/invariants.md`).
3. **Titles that are ids.** A panel, dialog, or header titled with a UUID, a code, or "편집: <id>" is a defect. The title must be the value that identifies the record to a human (a name). This most often comes from the backend's detail projection filling a relation with its id only — the list shows a name, the detail shows a UUID. Fix at the source, not with a frontend lookup, when the projection is the cause.
4. **Ids typed by hand.** A form field that asks the user to type or paste an identifier of another record (an entity reference, an attachment id, an "owner id") is a defect. Related data is chosen from a picker (combobox / search popover / tree select) that shows names; files come from the framework's file field. A user cannot know a UUID, so a form that demands one cannot be completed.
5. **Cross-screen agreement.** The same record, state, count, term, badge tone, and affordance agree on every surface that shows them — across personas, dashboards, nav badges, and embedded appearances. A transition performed on one surface is reflected on the others without a manual reload. Recipes → `references/cross-screen-consistency.md`.

---

## Search Is Part of the Product

The list's search and filters are tested on every list screen, never skipped as "obviously fine":

1. Run a real search with a value a user would type, and confirm the result set actually changes.
2. Open the filter dropdown and read it as the persona. Every filter present must be one this person filters by; filters they need and cannot find are missing.
3. Prune and order it: keep only what is useful, order it deterministically (category order, then table column order). When the pruned set is still tall enough to scroll, lay the popover out in 2–3 columns (`popoverColumns={2|3}` with `columnBreak` on the filter that starts each column), grouped by control kind so a calendar never stretches the text inputs. A single scrolling stack of every DTO field is not a filter bar.
4. Filter design rules (types, `maxBadges`, boolean → toggle, entity references as dropdown faceted filters, backend field verification) belong to the `simplix:frontend` skill's CUSTOMIZE · Filters references — follow them for the fix.

---

## Fixing What You Find

1. **Load the rules before touching code.** `simplix:frontend` skill first; then its CUSTOMIZE references for widget/filter/column work, SCAFFOLD references when the API contract or a generated artifact moves, AUDIT checklist afterwards. Its `references/audit/*` is also the place to look BEFORE you invent a component — a shared one usually exists.
2. **Rearrange for comprehension, not for symmetry.** Detail and form surfaces are ordered the way the persona reads them: identity first, then the fields they act on, then supporting detail, then audit/system values (or hidden). Group with the framework's section primitives; do not leave a flat wall of fields.
3. **Fix the root cause, in whichever subproject it lives.** A missing filter param, an unresolved relation name, an absent lifecycle endpoint, an id-only projection — these are backend defects surfacing in the UI. Implement them in the backend (load its handbook first), regenerate the frontend from the updated spec, then wire the UI. A note that says "백엔드 요청 필요" is not a fix when the feature is in scope.
4. **Re-drive the flow after the fix.** The same browser path that exposed the defect must be walked again, plus its neighbours — a fix that repairs one screen and breaks the one after it is not a fix.
5. **Verification is the project's standard gate** (typecheck, lint, tests — frontend and backend). A red build ends the task, not the report.

---

## Closing Out

1. **Cross-sweep by defect type.** Every defect you found is a *type*. Grep the whole codebase for other instances of that type and fix them too — a defect found once and left standing three screens away is a defect you chose to keep. Report the sweep's result per type, including "0 other instances".
2. **Skill feedback loop — and the automation ratchet.** For each defect type, ask why the `simplix:frontend` skill did not prevent it, and write the answer down where it will be read again: a rule that holds for any simplix-react project belongs in that skill (a new invariant, or a detection recipe in its `references/audit/audit-checklist.md`) — contribute it upstream to the plugin, since an installed plugin is read-only; a rule that holds only for this project belongs in the project's own reference. And the ratchet: **the SECOND time a defect type is found — in any session — prose is no longer an acceptable fix.** If the type is regex-detectable, it becomes a rule in the audit script (`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs`), so every later run catches it; if it is a process violation, it becomes a project hook gate. Documentation grows only for judgment calls; everything mechanically checkable moves into tooling. A defect type that can recur silently is not closed.
3. **Report honestly, in this shape.** In the conversation, never into a file. Each auditor returns it for its cluster and the coordinator aggregates; a fixed shape is what makes two sessions comparable and what makes an omission visible instead of merely absent.

   ```
   CLUSTER: <the entity and the surfaces audited>
   PERSONAS PLAYED: <who, and which surfaces each covered>
   COVERAGE: <every screen walked, and every state reached per screen>
   DEFECTS FIXED: <grouped by type; each finding tagged with its lens and its anchor
                   (invariant # / precedent file / endpoint / persona failure), then what
                   was wrong, why it mattered to the persona, what changed, what was
                   verified in the browser>
   CENSUSES: <the five, each with its result over every screen in scope>
   AGREEMENT: <the cross-screen census result per surface pair>
   CROSS-SWEEP: <per defect type, other instances found and fixed, including "0 others">
   RULES ADDED: <defect type → the audit-script rule or project hook that now catches it>
   BACKEND CHANGES: <endpoints, DTOs, or messages changed, or "none">
   BOARD: <frames that disagreed and which side was stale, or "no board" / "agrees">
   OPEN / PROPOSALS: <unanchored observations and product decisions for a human>
   WITHDRAWN: <anything that turned out to be a stale build or a tree artifact>
   VERIFICATION: <each gate and its result>
   DATA LEDGER: <created and kept, removed and why>
   CAPTURES: <file paths only — never an image in the report>
   SERVERS: <what was left running, or "stopped">
   ```

   A section you cannot fill is an omission, and says so: `CENSUSES` with a screen missing means that screen was not swept, and `WITHDRAWN: none` is a claim that nothing was misread. Anything that turned out to be a misreading is withdrawn explicitly rather than quietly dropped.
