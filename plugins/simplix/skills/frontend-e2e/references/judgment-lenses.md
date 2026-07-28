# Judgment Lenses — the four reviewers every screen faces

A screen is judged four times, by four reviewers you play in turn. The persona finds what is unusable; the UI/UX reviewer finds what is confusing or inconsistent; the backend reviewer finds where the UI and the server disagree; the framework auditor finds where the screen deviates from the handbook and from its sibling screens. One lens' pass is not another's — a screen can be perfectly usable and still violate the handbook, or perfectly compliant and still confusing.

The standard of "correct" is NOT taste. Lenses 2–4 anchor every finding to the `simplix:frontend` skill — invoke it during the audit if it is not already loaded this session. Its Non-Negotiable Invariants, its Task Router references, and the precedent screens located via its `customize/precedent-check.md` are the rubric you judge WITH, not just the rules you fix UNDER. **A finding that cites neither an invariant, nor a precedent screen, nor a server contract, nor a concrete persona failure is an opinion — it may enter the report as a proposal, never as a defect.**

---

## Lens 1 — The persona (the job owner)

The continuous lens: never break character while driving (SKILL.md Ground Rules, `personas-and-flows.md`). Asks: can I do my job here without asking anyone, is anything in my way, is anything here that I should never see?

Anchor: a concrete persona failure — a task they cannot complete, a term they do not know, a value they cannot interpret.

## Lens 2 — The UI/UX reviewer

An explicit pass per screen cluster. Asks:

1. **Hierarchy** — the value the persona came for is the most prominent thing on the screen; the primary action is where the eye lands last (footer / header action slot), not buried mid-page.
2. **Consistency** — same concept, same control, same position, same wording on every screen that shows it (the agreement censuses in `cross-screen-consistency.md` are the instrument). Sidebar label, page title, and breadcrumb agree.
3. **Feedback** — every action acknowledges visibly (state change, dialog, toast); destructive actions confirm with a human-named record (invariant #46); long operations show progress, not a frozen button.
4. **Affordance** — clickable looks clickable; a disabled control explains why (hint / tooltip / empty-state line — invariant #50); empty states say what to do next, via the shared components (#22).
5. **Cognitive load** — field, filter, and column counts are tuned to the persona's task (#39: the filter bar is the operator's index, not the DTO dump); defaults make the common case zero-configuration; the screen a badge leads to opens on the set the badge counts (#48).
6. **Error prevention over error messages** — pickers over typed identifiers, server-published constrained choices (#38), gates mirroring server rules (#35) — the form that cannot be filled wrong beats the dialog that explains what went wrong.

Anchor: the invariant that applies (#31 chrome, #39 filters, #43 badge parity, #48 badge semantics, …); where none applies directly, the precedent screen — two screens solving the same problem differently is a defect on whichever is less conventional.

## Lens 3 — The backend developer

An explicit pass per screen cluster. Loads the module's controller surface and generated DTOs; loads the `simplix:backend` skill before judging server behaviour. Asks:

1. **Contract agreement** — every UI state and action maps to a real endpoint and state; UI gates mirror the server's guards. Submit both sides of the boundary on purpose (`screen-checklist.md` § E.3): the UI offering what the server refuses means the gate is wrong; the server accepting what it should refuse means the server is wrong.
2. **Validation parity** — client validation is a convenience copy of the server's rules, never a different rule set; server failures surface their message keys in every locale (#40).
3. **Wire sanity** — watch the network while walking (`read_network_requests`): duplicate fetches on mount, a query per row (N+1), refetch storms after one mutation, list reads missing `page`/`size` together (#3), payloads carrying fields the form never edited (#34).
4. **Invalidation** — after a mutation, the dependent queries actually refetch: the other list, the tab count, the nav badge showing this record update without a manual reload (`cross-screen-consistency.md` § state agreement).
5. **State truth** — after a UI save, read the API (observe-only, per Ground Rules) and confirm the stored value matches what the screen shows: enum shape (#10), temporal encoding and zone (#42).
6. **Missing contract** — a filter, field, or action the persona needs with no backend support is a backend defect to implement end-to-end (backend first, regen, wire — SKILL.md § Fixing), not a frontend workaround.

Anchor: the endpoint / DTO / invariant involved.

## Lens 4 — The framework auditor

An explicit pass per screen cluster. Loads, from the `simplix:frontend` skill: the Non-Negotiable Invariants (SKILL.md), the shape taxonomy and comparison sheet in `customize/precedent-check.md`, and the detection recipes in `references/audit/audit-checklist.md`. Asks:

1. **Invariant compliance** — does any element of this screen violate an invariant? Run the audit-checklist recipes for the code-side sweep; run the browser verdict snippets for the live side.
2. **Precedent parity, live** — classify the audited screen's shape, locate its two precedent screens (precedent-check.md Step 2), open a precedent NEXT TO the audited screen in the browser, and walk the comparison sheet (chrome, filters, columns, detail, form, mutations, delete, empty states, badges, i18n) against the live screens. A divergence justified by a domain difference passes; any other divergence is a finding on whichever screen is less conventional — which may be the precedent.

Anchor: the invariant number or the precedent file.

---

## Running the lenses

1. Lens 1 runs continuously; lenses 2–4 run as explicit passes per **screen cluster** (all connected surfaces of one entity — `cross-screen-consistency.md`), not per click.
2. Every finding is tagged with its lens and its anchor (invariant #, precedent file, endpoint, persona failure). The report groups by defect type but keeps the tags.
3. Lens disagreements are reported, not averaged — when the persona needs something an invariant forbids, report the tension and route it to the skill-feedback loop (SKILL.md § Closing Out) as a proposed invariant change; do not silently side with either.
