---
name: jev-passes
description: Use when screens, captures, copy catalogs, story or state inventories, review findings, check output or agent progress have to be judged in bulk - before dispatching reviewing agents, before a persona review round, after a visual run, after fixes land, and while long agents run. Runs Jev (text, images, long context) as the first pass and hands a person or an agent only the confirmed candidates. Triggers - 판독, 캡처 검사, 화면 검사, 데모 대조, 문구 검사, 상태 누락, 수정 확인, 접근성 지적 묶기, 에이전트 점검, Jev 활용.
---

# Jev passes

Jev answers a typed question about one item (text, an object, or images) in about a second for a
fraction of a cent, so any judgment repeated over many items runs through it first. Its answer is a
probability: a pass produces **candidates**, and every candidate is confirmed (the capture enlarged
and looked at, the string read, the source opened) before anything is changed or reported. Rules for
asking well (two phrasings, enough context, precision on the first run, the statistics line) are in
the global instructions; measured cases and the call shape are in
`~/.claude/references/jev-classification.md`.

## The runner

`scripts/jevrun.py <in.jsonl> <out.jsonl> [--workers 8]` sends one request per line
(`{"id", "state", "questions", "images": {"name": "path.png"}}`) to `jev-1.14.0` on the
TypeSafe-compatible path (the only route that reads images), in parallel, and prints the statistics
line. Run it with a fresh key: `zsh -c 'source ~/.zshenv; python3 .../jevrun.py ...'`. The
project writes the builder that turns its own files into the JSONL and the reader that filters the
answers; the runner holds nothing project-specific.

Before the first image run in a session, send a known pair (a red and a blue square, 448 px) and
check both come back right: a route that drops images answers at random without an error.

## The passes

Run each pass whenever its trigger happens, not only when asked. Each one names what goes in the
state; a question without its evidence in the state comes back near 0.5 for everything.

| Pass | Trigger | State per item | Question (two phrasings each) |
| --- | --- | --- | --- |
| State coverage | before a review round; after stories or a spec change | one spec item's listed states + the whole story index (long context) | for each state, which story draws it, or none |
| Capture defects | after any capture run (visual, board, deck) | one capture + the story's intent (what overlaps by design) | text overlapping, covered or clipped; empty or broken screen; chrome over content |
| Reference comparison | after any capture run that has a reference (demo, board frame) | the capture + the reference at the same width | same / partly different / different in structure, wording, state |
| Variant pairs | after a capture run | the two captures of one screen in two languages, or two themes | one side alone wraps, clips, or loses contrast |
| Copy catalog | after copy changes; before a review round | one message key: every language's value + where it is used | same meaning across languages; grammar and particles; one thing named two ways (with the catalog's other names in the state) |
| Context fit | before a review round | a screen's visible text + its host, device and plan | does each sentence fit this device or plan (no "your computer" on a tablet) |
| Fix confirmation | when a fix lands, before the next review round | the finding text + the before and after captures or text | resolved / partly / not |
| Check-output grouping | when a check prints many lines | the lines + the code they point at | which lines share one root cause |
| Agent checkpoint | while a long agent runs | the brief + the agent's recent actions | still inside the brief; stuck; doing something the brief forbids |
| Motion frames | after a motion story changes | frames captured along its timeline | a frame where something jumps, vanishes or overlaps |

## What a pass leaves behind

- The candidates file (id, probabilities of both phrasings, a one-line reason) in the scratch
  directory, never in the repository: a Jev answer is not a finding.
- The confirmed findings go wherever the project keeps findings (a review round's findings file, a
  fix brief) with the evidence a person checked.
- The precision of the run (confirmed out of flagged) and the statistics line in the report, and a
  new row in `~/.claude/references/jev-classification.md` the first time a pass runs on a new kind
  of item.
- The project's builders and readers live in the project (for example `testing/jev/`) with its
  configuration; a pass that turns out useful in a second project moves its builder pattern here.
