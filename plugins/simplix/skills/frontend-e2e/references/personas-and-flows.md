# Personas and Flows — deciding who tests, and what they take end to end

An audit without a persona degrades into "the page loaded". An audit without a flow degrades into "the page loaded, twice".

---

## 1. Derive the personas from the navigation, not from the code

The application's own menu tree is the persona map: each top-level area exists because a different person has a different job. Before opening a single screen, write down — for every area in scope — one line each:

| | |
| --- | --- |
| **Who** | the role that lives in this area all day (a desk operator, an administrator of a domain, an ordinary employee, an approver) |
| **What success looks like** | the one or two things they must be able to do without asking anyone |
| **What they do NOT know** | the vocabulary, ids, and configuration concepts that must never appear in front of them |

Then hold the line: while auditing an area, judge every screen only as that person. Do not let the administrator's knowledge rescue the employee's screen.

Two rules that fall out of this:

1. **Self-service areas are judged hardest.** An area an ordinary employee uses (their own records, their own requests, their inbox) must not show administrator terms, internal identifiers, scope selectors, or policy fields. Their presence is a defect on its own — no further argument needed.
2. **Operator areas are judged by speed and by error-proofing.** A desk operator repeats the same transaction dozens of times; a screen that makes them hunt, retype, or guess a state is a defect even if every value is technically visible.

---

## 2. Build the flow before opening the browser

For the area under test, list the entity's states from birth to rest, and mark which persona moves it between each. That list IS the test script. It must end with the record either at rest in a terminal state or back at its start — and every arrow must be walkable in the UI.

Write it out, e.g.:

```
draft --(employee: submit)--> pending --(approver: approve)--> approved
      \                                \--(approver: reject)--> rejected --(employee: revise/resubmit)--> pending
       \--(employee: cancel)--> cancelled
approved --(operator: act on it)--> in-progress --(operator: complete)--> done
done --(admin: close the period)--> closed --(admin: re-open?)--> ???   ← if this arrow has no UI, it is a finding
```

Rules for the flow:

1. **Include the reverse arrows.** Cancel, reject, revise, release, re-open, restore. Forward-only flows hide most lifecycle defects.
2. **Include the arrows the backend claims to have.** Cross-check against the module's entity-scoped action endpoints (`screen-checklist.md` § E.1) — every one of them is an arrow that must exist on the diagram or a defect.
3. **Cross the areas.** A record created in one persona's area and acted on in another's is the interesting case; that is where names turn back into ids and where states stop matching. Follow it across the boundary rather than restarting in the second area — and audit the handoff itself (identity carries over, the state label matches the promise, the way back exists) plus the full set of surfaces showing the record, per `cross-screen-consistency.md`.
4. **Finish the flow.** A run that stops at "approved" because the next step was tedious has tested nothing about the next step.

---

## 3. Playing several actors

When the flow needs a second person:

1. **Sequential login (default).** Complete the first persona's step, log out, log in as the next, and continue. Slower, but it is exactly what the product does, and it catches the "the approver cannot even find it" class of defect.
2. **Two tabs (when comparing).** Keep one tab per actor when you need to see cause and effect at once (a request submitted in tab A appearing in tab B's inbox). Create the second tab with the browser tool's own tab-create call and keep the tab ids straight; re-read the tab context after any tab closes.
3. **Never simulate the counterpart with an API call.** "I'll just approve it via the endpoint" removes precisely the screen you were supposed to audit.
4. **Note what each actor could not see.** If the second actor's screen does not show the record, that is the finding — not a reason to switch back to the first account and force the state.

Account selection: use the environment's test accounts (the login screen's test-account buttons, when present) rather than hand-typing credentials. If the flow needs a role that no test account has, say so and propose the seed/role change instead of forcing the state through the API.

---

## 4. Coverage bookkeeping

Keep a running list while you walk, and report it:

1. Every screen in the area, marked opened / not opened (and why not).
2. Every arrow in the flow, marked walked / blocked (a blocked arrow is a finding, with the state it got stuck in).
3. Every defect, tagged with a **type** — the type is what you will sweep the rest of the codebase for at the end (SKILL.md § Closing Out).

A report with no coverage list cannot be trusted to have been a census.
