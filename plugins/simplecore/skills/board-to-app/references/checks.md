# The checks a build runs on, and where a new one belongs

A rule a person has to remember is a rule that decays. Everything mechanically visible in
this skill is therefore a gate, and this file is how they are run, where a new one goes, and
what makes one trustworthy.

## Running them

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/scripts/bta.mjs" check    # every gate against this project
node "${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/scripts/bta.mjs" gates    # every gate against the defect it exists to catch
node "${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/scripts/bta.mjs" doctor   # what this project declares, and what it owes
```

The config is found by walking up from the current directory for `.claude/board-to-app.json`;
`--config <path>` names one directly. `check` exits non-zero on any **error-grade** finding, so it
belongs in the project's own `gates` list and runs at every chapter close. Warnings are printed
under `⚠`, counted on their own line, and ignored by the exit status.

**`gates` also proves three things no case can reach**, because their subject is the harness rather
than a project: that a fired warning leaves the exit status alone while a fired error does not,
that a project gate answering to a core gate's id is refused unless the core one is turned off, and
that **every key `SCHEMA` reads has a row in the config table and a line in the copyable template,
with the same cost sentence on both sides**. The last of those holds a shape both gate tables are
blind to: a key added to the schema works immediately — `configGate` validates it, `doctor` prints
it — and nothing anywhere says it exists, so the only people who ever meet it are the ones who read
the source. **Its cost sentence is held the same way and for a sharper reason**: `SKILL.md` is what
a person edits and `doctor` prints `SCHEMA[key].absent`, so the two are one sentence in two files
and drift in exactly one direction — the correction goes into the table and the report goes on
saying the old thing. Each of the three is proved in both directions the same way a gate is,
against a doctored copy and then against the real one.

**`check` and `gates` are read by their exit status; `doctor` is read.** A report exits zero on
anything it prints — only a config it cannot find at all stops it, at 2 — so nothing about a
project's completeness can be taken off `doctor`'s status, and a step that names it as a proof is
claiming something the command does not offer. What proves a config is `check`.

`check` **skips** a gate whose keys the project does not declare and says how many it skipped.
That is the difference between a rule that does not apply here and a rule that silently stopped
running.

## Where a new check belongs

Two levels, and choosing between them is the whole design decision:

| Level | True of | Where it lives |
| --- | --- | --- |
| **core** | any project that builds from a board — the config's shape, the two documents' discipline, the capture name, the commit trailers | `scripts/core/gates.mjs` in this skill, with its cases in `scripts/core/cases.mjs` |
| **project** | this product only — a document format this project chose, its own data shapes, a convention its stack has | the module the project declares as `projectGates`, exporting `gates` and `cases` |

**A gate put one level too high fires on projects it does not describe; one level too low is
rewritten by the next project that needs it.** The test is whether it would still be right in
somebody else's repository. A path that is valid only under this repository's layout, an
exception list somebody would need to vary, a framework name compared directly — each of those
is a project gate however general it feels while writing it.

## Writing one

A gate is a plain object. It finds and describes; it never prints and never exits, so the same
gate runs from the command line and from a case.

```js
export const exampleGate = {
  id: 'exampleGate',
  title: 'what is wrong when this fires',
  needs: ['chapterDir'],          // config keys it reads; the gate is skipped when one is absent
  grade: 'error',                 // 'error' (the default, and omitted) or 'warning'
  run: (ctx) => [],               // → one string per finding, each naming the file and what to do
};
```

`ctx` is the project, and a gate uses nothing else — it never joins a path itself:

| `ctx` | Gives |
| --- | --- |
| `declared(key)` | the raw declared value, or null |
| `at(key)` | the absolute path a declared key resolves to, or null |
| `read(path)` · `list(dir)` | the file's text or null · every file under a directory, or null |
| `exists(p)` · `isDir(p)` · `rel(p)` | presence, kind, and the path as the repository sees it |
| `git(args)` | git in the project root — `{ ok, out }` |
| `lines` | the project's chapter lines, compiled from its phrases — `ctx.lines.persona` is a RegExp, and a role the project declared absent is simply not there |
| `evidence` | the readers over the evidence folder — the chapter files, the closed chapters, the frames a chapter places and demands, a result document's sections |
| `options` | what the command line passed, such as `range` |

The last two are on `ctx` for the same reason everything else is: **a project's own gate cannot
import this skill by path**, because the skill is installed somewhere different on every machine.
A second copy of a reader is a copy that drifts, so what a gate needs arrives through the context.

A project's module exports the same shape:

```js
// the file `projectGates` names
export const gates = [/* … */];
export function cases(t) {
  t.add('myGate', 'the defect it exists to catch', t.project({ config: {…}, files: {…} }), true);
  t.add('myGate', 'a project with nothing wrong with it', t.project({ config: {…}, files: {…} }), false);
}
```

`t.project()` builds a real directory with a real config in it — never a hand-made context
object — so a gate that quietly stopped resolving paths cannot pass its own case. Pass
`commits: ['…']` to make the fixture a git repository, and end a `files` key with `/` to make
an empty directory.

## Error or warning, and why the grade sits on the gate

A finding is one of two things, and the exit status is the difference:

| `grade` | What a finding of it is | `check` | The write-time hook |
| --- | --- | --- | --- |
| `error` — the default, and what a gate declaring nothing is judged at | a defect: something is wrong, and the finding says what to change | `✖`, counted, exits non-zero | blocks the write when the finding names the file just written |
| `warning` | a prompt: go and re-read what this names, because it may already be settled | `⚠`, counted on its own line, exit status unchanged | shown in full, blocks nothing |

**The grade belongs to the rule, not to the string it returned.** A gate answers one question, so
the kind of its findings is fixed when it is written: a gate whose findings differ in kind is two
rules sharing an id, and it is split into two gates that each carry their own pair of cases.
Grading each returned string would leave the harness nothing to hold — a case is judged per gate,
so a gate that quietly downgraded one finding among nine would pass both its cases, and no case
could be written that pins it.

**A warning is for a rule that is right to fire and wrong to fail on.** The case it exists for is a
finding whose resolution is often 「the line stands」: a parked decision naming the statute article
nobody could settle names a source that may already answer it, and no gate can tell whether it does
— only a person re-reading the article can. Failing there trains everybody to ignore the gate, and
a gate that cries wolf takes the real ones beside it down with it.

**It is not a way to keep a rule that fires wrongly.** A gate whose findings are mostly noise is too
wide and gets narrowed. The grade says what a *correct* finding is, never how sure the gate is —
downgrading to quieten a false positive leaves the defect in the rule and buries the evidence of it.

A grade the harness does not read is refused rather than defaulted: `check` and `gates` both fail on
a gate declaring one, because `grade: 'advisory'` otherwise reads as advisory in the source and is
counted as an error in the run.

### What `check` prints is a contract, not a layout

A write-time hook does not call the harness — it runs `check` and reads the grades out of the text,
because that is the only interface a hook process has. Two shapes carry all of it: a gate heading is
`<marker> <id> — <title>` where the marker is `✖` or `⚠` and the separator is a spaced em dash after
one unbroken token, and each finding under it is indented by exactly three spaces. **Changing either
is a breaking change**, and it breaks in the worst available direction: the hook goes blind, decides
the tree is clean, and stops blocking writes it exists to block — with no error anywhere, because a
parse that matches nothing looks exactly like a repository with nothing wrong with it.

Nothing in this skill can hold that, because the consumer lives in the project. So a project that
installs such a hook owes it a proof of its own, run as one of its `gates`: drive the hook over
fixtures whose gates fire on demand, assert the exit status **and** what the hook actually printed,
and then run the same cases again against a `check` whose output has been deliberately mangled in
each of those two ways, requiring the suite to go red. Asserting only the exit status proves far
less than it appears to — `check` exiting non-zero with nothing parseable behind it is reported as a
gate that failed, so a blind hook still exits 2 on an error and the status agrees while the report
has become worthless.

## What makes a gate trustworthy

- **Both directions, in the same change.** `gates` feeds each one the defect it exists to catch
  and then a clean project, and names every gate that is missing either half. A gate that fires
  on everything and a gate that fires on nothing both pass a single case.
- **A warning is proved like anything else, and so is the channel.** The two cases are demanded
  whatever the grade, and `gates` additionally runs `check` over a fixture where a warning fires
  alone and over one where an error fires beside it, reading the exit status off each. A severity
  channel nobody has watched part the exit status is one that has probably stopped.
- **Sweep the whole tree, then report the count.** Zero costs nothing and proves coverage;
  non-zero is the rule earning itself immediately. A checker written against the two files that
  had the bug is a checker for a bug that is already fixed.
- **A pattern with a placeholder in it is tested for what it matches**, not only for what it
  finds. A slot that compiles to 「any non-empty string」 makes every comparison pass while the
  count of comparisons stays perfectly honest, so the two cases go past it untouched: feed it the
  string it must reject and watch it reject that one. Counting what was compared is a necessary
  condition for a checker that can be trusted, never a sufficient one.
- **A gate over a project's own words carries the boundary in its cases, both edges.** Zero
  matches means 「declared wrongly」 in one project and 「nothing written yet」 in the next, and a
  gate that reads the second as the first reddens every project on the day it is wired while one
  that reads the first as the second is the silence it was written to break. So the pair is four:
  the misdeclaration, a word nobody writes, a freshly-wired project, and a project mid-build whose
  documents of one kind exist and whose documents of the other do not — the last is the one that
  is easy to leave out and is where the boundary actually sits. `declaredWordsMatchTheDocuments`
  is the worked example, and it says in each finding which of the two states it established.
- **Where a zero has two meanings, the second one is a warning rather than a widened error.**
  「I compared and nothing matched」 is a defect; 「there was nothing to compare against」 is a
  project that has not written the documents yet, and a gate covering both fails every repository
  on the day it is wired. They are two gates because a gate answers one question — and the pair is
  what makes silence mean something: with only the error, a run says nothing both when the check
  passed and when it never ran. `declaredWordsMatchTheDocuments` and
  `declaredWordsHaveBeenCompared` are that pair, and neither can speak about an entry the other
  is speaking about, so one defect is never reported twice under two ids.
- **An escape a reader can see and question.** A project turns a core gate off with
  `disabledGates: [{ "id": "…", "reason": "…" }]` — the reason is required, because an exception
  nobody can question is an omission wearing a config key.
- **Some rules are correctly rejected**, and the rejection is worth as much as the rule. Write
  down the ones you closed and why, or the next agent rediscovers the same tempting rule and
  ships it → `references/harness.md`.

## Proving the check that is prose

Most of what this skill states cannot be a gate — whether a screen holds up for the person
whose work it carries is settled by looking. A rule that needs eyes is **marked** as such in
the skill rather than left ambiguous, and the marking is what stops it being read as an
unwritten check.

When such a rule is added or corrected, the equivalent of proving a gate is naming the case it
now catches: the sentence that would have been written before, beside the sentence it produces
now. A rule stated abstractly blocks less than the same rule with the misreading printed beside
it.
