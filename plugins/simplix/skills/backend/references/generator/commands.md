# Generator Commands Outside generate and promote

What `yo simplix`, `yo simplix:init`, `yo simplix:version` and `yo simplix:generated` do and when a developer runs each. `config`, `generate` (alias `entity`) and `promote` have their own references: `../entity/yml-configuration.md` and `promote-workflow.md`.

> **Scope (canonical):** the setup, version and state commands of the generator. The tracked-render rules these commands report on (fingerprint, stored base, three-way merge) are owned by `promote-workflow.md`.

| Command | Writes | When a developer runs it |
|---|---|---|
| `yo simplix` | nothing | to see the workflow and the command list, or to learn that `.simplix/` is missing |
| `yo simplix:init` | `.simplix/entity/.gitkeep`, `.simplix/templates/.gitkeep` | once, in a project that has no `.simplix/` folder |
| `yo simplix:version` | nothing, except with `--write` or `--update` | before generating on a new machine, after the generator is updated, and when a command stops on the version gate |
| `yo simplix:generated` | renders into the git-ignored `generated/` tree | after every promote, and before a template change is trusted |

## `yo simplix` (the `app` generator)

The default generator, run as `yo simplix` or `yo simplix:app`. It prints the generator version, then:

- With no `.simplix/` folder in the working directory: a note pointing to `yo simplix:init`, and nothing else.
- With one: the order of work (`config` → edit the yml → `generate`/`entity`) and the command list.

It reads and writes no project file. Nothing depends on it; run it to refresh memory of the commands.

## `yo simplix:init`

Creates the `.simplix/` folder with the empty `entity/` and `templates/` subfolders, each holding a `.gitkeep`. It does nothing when `.simplix/` already exists (it prints that the folder exists and stops), so it never overwrites a project's configuration or templates.

It does **not** create `.simplix/generator-simplix.json`. After `init` the developer writes that file by hand (paths, base package, template names: `template-customization.md`), then pins the generator with `yo simplix:version --write`. `generate`, `promote` and `generated` refuse to run without that file; `config` reads it when it exists.

## `yo simplix:version`

The generator reads three versions: the generator that is running, the version the project records under `generator.version` in `.simplix/generator-simplix.json` (the file is found by searching upward from the working directory), and the latest version published to npm.

| Form | Effect |
|---|---|
| `yo simplix:version` | Prints the three versions and one verdict: `match`, `outdated` (running is older than the project requires), `ahead` (running is newer than recorded), `unrecorded` (the project records none) or `unknown` (the two cannot be compared) |
| `--json` | The same report as one JSON line on stdout and nothing else, for scripts |
| `--write` | Records the running generator's `X.Y.Z` in `generator.version`, keeping the rest of the file byte for byte. Fails when `generator-simplix.json` does not exist |
| `--update` | Runs `npm install -g` for the latest published version, or for `--to X.Y.Z`. The next `yo simplix` run uses it |
| `--update --to X.Y.Z` | Installs that exact published version; anything that is not `X.Y.Z` is refused |

**The version gate.** `config`, `generate`/`entity` and `promote` compare the running generator with `generator.version` before writing anything. An older generator stops the command with the update instructions, because templates and configuration keys move together and an older generator silently produces code the project no longer expects. A newer generator only warns, and a project that records no version gets a one-line notice. `--skip-version-check` overrides the gate for one run. Versions compare by their `X.Y.Z` core, so a `-SNAPSHOT` build satisfies the release it precedes.

Run `--write` after deliberately moving to a newer generator, so the whole team and CI stop on an older one. Run `--update` when a command stops with "older than the version this project requires".

## `yo simplix:generated`

Reports the state of every promoted file. It is the check that closes a promote (`promote-workflow.md` § Usage).

1. It reads every `.simplix/entity/*.yml`. An entity none of whose files has been promoted is skipped; an entity whose files sit in more than one module under the promote module root is an error.
2. Unless `--no-render` is given, it renders each promoted entity again with `generate <Entity> --force --skip-version-check` into `generated/`. A failed render stops the report (exit 1), because no state can be judged from a render that did not happen.
3. It compares each promoted file with its stored base under `.simplix/bases/` and with the fresh render, and prints one line per file and a count per state.

| State | Meaning | Fails the run |
|---|---|---|
| `untouched` | still exactly the render promote laid down, and what it would lay down now | no |
| `edited` | changed since it was laid down, and the fresh render merges into it cleanly | no |
| `stale` | untouched, but the fresh render differs: a promote would rewrite it | **yes** |
| `conflict` | edited, and the fresh render collides with the edits | **yes** |
| `no-base` | present with no stored base, so no template change can be merged into it | **yes** |
| `removed` | a base is stored and the file is gone; promote leaves it deleted | no |

| Flag | Effect |
|---|---|
| `--no-render` | Skips step 2 and judges against the stored bases alone: `stale` and `conflict` cannot be found, because no fresh render exists to compare. Use it when the templates cannot be rendered right now |
| `--json` | One JSON line `{ "files": [{ "path", "entity", "state" }], "counts": { "<state>": n } }` instead of the text lines |

Exit code 1 when any file is `stale`, `conflict` or `no-base`, and also when `generator-simplix.json` is missing or a render fails. Because step 2 leaves the renders in `generated/`, run the "no files remain in `generated/`" check of `promote-workflow.md` § Post-Promote Verification **before** this command.
