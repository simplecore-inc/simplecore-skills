---
name: frontend-e2e
description: End-to-end usability, lifecycle, and cross-screen consistency audit of a simplix-react frontend, driven through a real browser and judged through four lenses — the persona, a UI/UX reviewer, a backend developer, and a framework auditor anchored to the `simplix:frontend` handbook. Invoke whenever a task asks to walk a feature area as a user, exercise a whole lifecycle across screens, check that functionally connected screens agree (values, states, counts, terminology), find what is confusing / missing / unusable, review a menu tree end-to-end, or verify a delivered feature the way an operator would use it — cues include "사용자 관점", "처음 접하는 사용자", "직접 사용해 보며", "전수 점검", "전체 흐름", "라이프사이클", "E2E", "사용성 점검", "화면 검토", "화면 간 연동", "화면 대조", "일관성 점검", "UI/UX 관점", "브라우저로 확인", "개선점 찾아줘", "빠진 기능", "쓸 수 없는 화면". Also invoke before declaring a feature complete when its screens have never been driven by hand. This skill decides WHAT to test and WHAT counts as a defect — judged against the `simplix:frontend` skill's invariants and precedent screens, not taste; fixes are then made under that skill's CUSTOMIZE / SCAFFOLD rules. Not for unit tests, typecheck/lint runs, or a single-component visual tweak.
version: 1.0.0
---

# Frontend E2E Audit Handbook

A screen that renders is not a screen that works, and a screen that works alone is not a product. This handbook drives the running application through a real browser, audits functionally connected screens as one cluster, judges what it sees through four lenses (persona, UI/UX reviewer, backend developer, framework auditor), and turns "I don't understand this", "I can't do this", and "these two screens disagree" into fixed defects.

It is the **testing** counterpart of the `simplix:frontend` skill — and that skill is not only where fixes are written: its invariants and precedent screens are the rubric this audit judges WITH.

---

## How to Use

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
8. **A stale build lies.** Before calling anything a defect, be sure the dev server is serving the current source (see `references/browser-driving.md` § Environment). A missing translation or a vanished column is often a failed build, not a bug.
9. **Do not commit.** Report; the user commits.

---

## The Five Mandatory Censuses

These run over EVERY screen in scope, exhaustively — not sampled. The first four have detection recipes in `references/screen-checklist.md`; the fifth runs over the cluster in `references/cross-screen-consistency.md`.

1. **Button placement.** Actions live in the footer of the detail/form surface (`CrudDetail.DefaultActions` / `CrudForm.Actions`), and the page's primary create action lives in the page header's action slot. A button floating mid-page, a row of buttons above a list, or an action buried between form sections is a defect unless the action is genuinely scoped to the section it sits in (an "add row" inside a repeatable list, a per-row action in a table). When in doubt, move it to the footer.
2. **Header / footer standard composition.** Every routed page registers its title through the page-header hook and takes its padding from the app layout; every detail/form panel uses the framework's header/body/footer chrome. A locally rendered heading, an ad-hoc close button, a hand-rolled title row, or a panel whose content is clipped because nothing owns the scroll are all defects.
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
3. **Report honestly.** Group by defect type, each finding tagged with its judgment lens and its anchor (invariant #, precedent file, endpoint, persona failure — `references/judgment-lenses.md`): what was wrong, why it mattered to the persona, what changed, what was verified in the browser. Include the cluster agreement results (`references/cross-screen-consistency.md` § Reporting) and the coverage lists. Anything that turned out to be a misreading (a stale build, an accessibility-tree artifact) is withdrawn explicitly rather than quietly dropped.
