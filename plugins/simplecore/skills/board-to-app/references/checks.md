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
`--config <path>` names one directly. `check` exits non-zero on any finding, so it belongs in
the project's own `gates` list and runs at every chapter close.

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
| `options` | what the command line passed, such as `range` |

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

## What makes a gate trustworthy

- **Both directions, in the same change.** `gates` feeds each one the defect it exists to catch
  and then a clean project, and names every gate that is missing either half. A gate that fires
  on everything and a gate that fires on nothing both pass a single case.
- **Sweep the whole tree, then report the count.** Zero costs nothing and proves coverage;
  non-zero is the rule earning itself immediately. A checker written against the two files that
  had the bug is a checker for a bug that is already fixed.
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
