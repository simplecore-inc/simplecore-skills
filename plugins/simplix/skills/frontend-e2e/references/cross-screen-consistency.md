# Cross-Screen Consistency — auditing connected screens together

A record lives on many screens: its module's own list and detail, another persona's inbox or desk, a dashboard card, a nav badge, a peek dialog on a different module's page. Auditing each screen alone passes every screen and misses the product — the defects that matter most live BETWEEN screens: a value that renders as a name here and a UUID there, a state that changed on one surface while another still shows yesterday, a badge counting rows its target view does not show.

---

## Step 1 — Build the screen cluster for the entity

Before judging, enumerate EVERY surface that shows or moves the entity under audit:

1. The module's own surfaces — list, detail, form, board, report tabs
2. Other personas' surfaces — the approver's inbox, the operator's desk, the subject's self-service view, the portal/kiosk counterpart
3. Aggregates — dashboard cards, report rows, nav / sidebar / tab count badges
4. Embedded appearances — peek labels and dialogs on OTHER modules' screens, FK columns and pickers elsewhere

Start from the screen inventory (`node "${CLAUDE_PLUGIN_ROOT}/scripts/screen-inventory.mjs"`, run from the frontend project root) — it lists every screen-bearing file by shape, which seeds both the cluster list and the coverage bookkeeping. Then narrow to the entity with the recipes below (convention-based; run from the frontend subproject root):

```bash
# Every widget that reads this entity's hooks
grep -rln --include="*.tsx" "use<Entity>List\|use<Entity>Detail\|useGet<Entity>" modules/ apps/

# Every surface that renders its DTO type
grep -rln --include="*.tsx" "<Entity>ListDTO\|<Entity>DetailDTO" modules/ apps/

# Nav / tab badges counting it (size-1 count queries — see the `simplix:frontend` skill, invariant #48)
grep -rn --include="*.ts*" "size: 1" apps/*/src/widgets/nav/ modules/*/src/
```

The cluster list goes into the coverage bookkeeping (`personas-and-flows.md` § 4). A surface you did not list is a surface you will not audit.

---

## Step 2 — Agreement censuses across the cluster

Run each census over the WHOLE cluster, with the browser as the instrument. Anchors in parentheses are the `simplix:frontend` skill's invariants — cite them in findings.

1. **Value agreement** — the same record opened on two surfaces shows the same values, with names resolved the same way. A list that shows a person's name while the detail shows a UUID is a projection defect fixed in the backend, not with a frontend lookup.
2. **State agreement (live)** — perform a transition on surface A, then check surface B: when both are on screen (two tabs, a board next to a badge), B reflects the change WITHOUT a manual reload — a stale list, tab count, or badge after a mutation is an invalidation defect; after navigation, B must reflect it unconditionally.
3. **Count agreement** — the nav badge, the tab count, and the list's total agree for the same set, share the same query figure, and the screen a badge leads to opens by default on exactly the set it counts (#48). A badge of N over a default view of 0 rows is a wiring defect.
4. **Terminology agreement** — the same state or action carries the same word on every surface, in every locale; sidebar label, page title, and breadcrumb agree. One screen saying "승인" while another says "결재" for the same act is a defect even though each screen passes alone.
5. **Presentation agreement** — the same status uses the same badge component and tone map on every surface, at parity size (#43); red is reserved cluster-wide for act-now sets (#48); the same temporal kind formats through the same components and zone everywhere (#42).
6. **Affordance agreement** — an action available for state X on one surface is available, or deliberately absent, on every other surface showing state X. Deliberate asymmetry (a trust boundary #47, a scope restriction) is verified as SERVER-enforced — visually absent but callable is a hole, not an asymmetry.
7. **Shape parity between sibling screens** — two same-shape screens inside the cluster (two lists, two boards) walk the comparison sheet from the `simplix:frontend` skill's `customize/precedent-check.md` against each other in the live browser (lens 4, `judgment-lenses.md`).

---

## Step 3 — Cross-boundary handoffs

For every flow arrow that crosses personas or areas (`personas-and-flows.md` § 2), audit the handoff itself:

1. **Identity carries over** — the second persona can FIND the record by what they know (a name, today's queue), not by an id the first persona would have to read out loud.
2. **The state label matches the promise** — what surface A said would happen ("submitted for approval") is the state surface B displays, in B's persona's vocabulary.
3. **The way back exists** — a rejection, return, or cancellation on B's side is visible on A's side with its reason, and A has an affordance to act on it (revise, resubmit, withdraw).

---

## Reporting

Report the agreement censuses per cluster: which surfaces were compared, which censuses passed, and each discrepancy naming BOTH screens and which one is wrong — the one deviating from the invariant, the precedent, or the server's truth. "Screen A and B disagree" without a verdict is observation, not a finding.
