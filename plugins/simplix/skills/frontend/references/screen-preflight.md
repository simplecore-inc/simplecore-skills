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
| A kit part takes a per-screen presentation flag (draw these row actions as labelled buttons), so one screen opts out of the look every other screen has, often with a borrowed action type for a verb no type names | a part presents one way; a verb no type names gets its own icon or a new type in the kit, and a boolean prop that changes look rather than content is removed or carries a written reason |
| A value renderer adds its own controls (copy, show whole) inside a list cell, so a row carries two kinds of buttons and one list looks unlike the others | a row's actions live only in its action strip; a cell shows a value, and copy or the whole text belongs to the detail |
| A screen design records a decision (a description shown, a figure row) and nothing checks the built screen against it, so the design file says one thing and every screen renders another | each recorded decision has a rendered check: what the design says is shown renders in every locale, what it says is absent renders nothing |
| The page API hands a region a free node (an override map, an insert seam, a render-prop slot), so every new need is met by drawing a part by hand and every finding is fixed one region at a time | each region slot takes data and the template draws its part; no override or insert escape; one finding about one region is checked against every slot of the API in the same change |
| A rule lives in prose only | each rule gets a machine check with a hit and a miss case before the widening starts |

Misreading: "the agent was told, so the next screens will follow". Telling is not a mechanism; the
generator, the template and the checks are.

## The kit's region contract is the authority

What a page type draws in each region (the part, the `page.blocks` slot, the controls a region may
hold) is not restated here: the kit ships it as metadata (`regions.json` in the design kit, for
console-clarity `packages/console-clarity/regions.json`) and enforces it with a source check and a
rendered check beside it. Read it before naming a part or a slot in a plan; a region it lacks is
added there, with both checks proving it on a hit and a miss.

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

## Simulate one screen at a time, then widen

Before the change is applied to the screens, the skill, the templates and the kit are re-checked
against the preflight, and screens are rebuilt one at a time as a simulation of the workflow:

1. **Re-check first.** Read the skill sections, the templates and the kit parts the screen will
   use, and fix any that still teach a second path or disown a generated file. The census of
   step 1 above is current before the first screen.
2. **Rebuild one screen from nothing** through the documented steps only: design, scaffold or
   add-page from the type template, customise inside slots, board frame from the story template,
   checks, browser in every locale. Rebuild means regenerate from the template and port the
   screen's customisation into the slots, never edit the old file toward the new shape.
3. **Log every trial and error**: a step the documentation did not cover, a command that failed,
   a slot that was missing, a check that did not catch something, a choice the agent had to make
   alone. Each one is fixed at its cause (the skill, the template, the kit, the generator or the
   check) before the next screen, and the fixed screens are regenerated.
4. **Repeat on another screen of the same type** while the last rebuild produced any trial and
   error. The type is settled when one rebuild produces none.
5. **Move to the next type** and repeat steps 2 to 4. The reference screen of each type
   regenerates to itself (the rendered screen does not change).
6. **Then widen** across the remaining screens of the settled types, one cluster at a time,
   closed by the checks and a browser pass; a defect found there goes into the template and is
   regenerated into the screens already done.
7. The census table (every screen: type, generated from, slots used, checks, trial-and-error log
   entries) is updated after each screen.

Misreading: one screen rebuilt cleanly, so every screen is done. A clean rebuild settles its type,
not the others, and only when the rebuild before it found nothing new.

## The kit holds the region contract

What a page type holds, region by region, is data in the UI kit, not prose in this skill: the
kit ships a machine-readable region contract (for each page type, its ordered regions, the one
part filling each, the control kinds a region may hold, and the blocks slot that feeds it), and
every kit part declares the region it belongs to. Read the kit's contract before designing or
customising a screen; where the kit has none, writing it is the first step of the preflight.
The rendered check compares each screen's region signature (which controls appear in which
region) with its type's contract, so a second way of drawing a region fails the moment it is
rendered, on any screen, without anyone comparing screens by eye.

## The re-audit is a script, run until it prints clean

Every defect class found during the work becomes one counting line in a re-audit script (a grep,
a contract check, a rendered check) over the skill, the kit, the templates, the generators and the
generated screens; the script exits non-zero while any count is above 0. It runs after every step
and every landed change, and its table is what a report quotes. A class found later is added as a
line before it is fixed. Prove each line on a known hit before trusting a 0: a command whose
failure is swallowed reports 0 for the wrong reason (a grep exiting 1 and its output discarded).
The work is finished when the script prints clean, never when a reading of the code finds nothing.
