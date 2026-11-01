# Screen preflight: settle the problems before the first screen, then widen one screen at a time

Read before any change that reaches more than one screen: a new template, a new slot, a new kit
part, a rule the user set for "every screen", a regeneration of a domain. The ways such a change
went wrong are known, and each has a check that runs before anything is written.

## Why a rule set for every screen does not hold

Each cause below produced screens that differ although every agent was told the same rule. None of
them is fixed by repeating the rule; each is fixed by the mechanism named beside it.

| Cause | Mechanism that removes it |
| --- | --- |
| The generator writes a file once (an empty `return {}` blocks stub) and disowns it, so every author fills it from nothing and a template change never reaches it | every generated file, blocks included, keeps a render fingerprint and a base and is merged three ways on regeneration; a file without a fingerprint fails the generated-state check |
| The template offers two ways to fill one region (two figure parts, two notice parts) | one slot per region; the second way is removed from the template, not documented beside it |
| A kit part is planned or briefed without searching the kit, so a part that already does the job is rebuilt beside it | the part search below runs before any part is named in a plan or a brief; the brief names the existing part, never a behaviour to build |
| A brief describes the result ("give the strip a collapse control") instead of the mechanism to reuse | a brief names the file and the export to use, and states that a second mechanism needs a written reason |
| A correction reaches a running agent only when its turn ends, after it has committed | a change of direction stops the agent first, then sends the new brief; nothing is relayed to an agent mid-commit |
| Several agents change the same template or shell in parallel | one owner per template and per shell file for the duration of the change; others wait for its hash |
| Every screen is regenerated at once, so a defect in the template lands on all of them before one is seen | the pilot sequence below |
| A rule lives in prose only | each rule gets a machine check with a hit and a miss case before the widening starts |

Misreading: "the agent was told, so the next screens will follow". Telling is not a mechanism; the
generator, the template and the checks are.

## The preflight, in order

1. **Census what exists.** For the region the change touches (figures, notices, a fold, tabs, a
   page type), grep the kit and the framework for every part, hook and slot that already draws it,
   and every screen that uses one. Write the list. The screen that uses the existing part well is
   the reference.
2. **Name the one mechanism.** For each region, the single slot and the single part. Where two
   exist, the plan removes one; where the existing one lacks a behaviour, the plan adds the
   behaviour to it.
3. **List the expected problems for this change** before writing it: files with no base to merge
   against, slots a page type does not have yet, Meta values read at the wrong level (an entity
   shared by two operations), uncommitted work of another agent in the same files, the CLI build
   the regeneration runs from, board frames drawn by hand, preferences stored under a second key.
   Each gets its resolution in the plan.
4. **Write the checks first**: the generated-state check (fingerprint present, 0 stale, 0
   conflict), the fence that refuses a screen composing the region outside its slot, the rendered
   order check. Prove each on a broken and a fixed form.
5. **Pilot on one screen, then widen** (below).

## Pilot, then widen

1. **The reference screen regenerates to itself.** Regenerating the reference screen under the new
   template changes nothing it shows; a diff there is a template defect.
2. **One screen of the simplest shape** (a list with no figures, or the plainest page of a type):
   rendered from the template, customised only inside slots, checked in the browser in every
   locale, its board frame generated from the matching story template and measured.
3. **One screen that exercises the new slot** (figures that narrow the list, a tabbed page).
4. **Widen by cluster**, one cluster at a time, each closed by the checks and a browser pass before
   the next starts. A defect found in a cluster goes into the template and is regenerated into the
   screens already done, never patched on the screen where it was seen.
5. The census table (every screen: type, generated from, slots used, checks) is updated after each
   step, so the remaining set is always visible.
