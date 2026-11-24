# Generator Commands Outside generate and promote

What `simplix-boot help`, `simplix-boot init`, `simplix-boot version`, `simplix-boot generated` and `simplix-boot templates` do and when a developer runs each. `config`, `generate` and `promote` have their own references: `../entity/yml-configuration.md` and `promote-workflow.md`.

`simplix-boot` is the executable of the npm package `@simplix-boot/cli`, which is released with the SimpliX framework under the framework's version (§ Installing the CLI).

**Rules every command follows.** A command other than `init`, `version` and `help` runs inside a project: the project root is the nearest directory at or above the working directory that holds `.simplix/`, so a command may be run from any folder below it. An option the command does not declare, and an argument beyond the declared ones, stop the command before it does anything (exit 1). Progress and reports go to standard output; the reason a command stopped goes to standard error. `simplix-boot <command> --help` prints the usage and options of one command.

> **Scope (canonical):** the setup, version, state and template-origin commands of the generator. The tracked-render rules these commands report on (fingerprint, stored base, three-way merge) are owned by `promote-workflow.md`.

| Command | Writes | When a developer runs it |
|---|---|---|
| `simplix-boot help` | nothing | to see the workflow and the command list |
| `simplix-boot init` | `.simplix/entity/.gitkeep`, `.simplix/templates/.gitkeep` | once, in a project that has no `.simplix/` folder |
| `simplix-boot version` | nothing, except with `--write` or `--update` | before generating on a new machine, after the generator is updated, and when a command stops on the version gate |
| `simplix-boot generated` | renders into the git-ignored `generated/` tree | after every promote, and before a template change is trusted |
| `simplix-boot templates` | nothing, except with `--eject` | to see which templates are the project's own, and to copy a built-in template into the project before editing it |

## Installing the CLI

| Way | Command | What runs |
|---|---|---|
| Without installing | `npx @simplix-boot/cli <command>` | the latest version published to npm |
| Global install | `npm install -g @simplix-boot/cli` | the published version installed at that moment |
| Link a framework checkout | `npm ci` and `npm link` inside `<simplix checkout>/simplix-cli` | the checkout's current source |

**Linking a framework checkout.** `npm link` registers `simplix-boot` as a global command through a symbolic link from the global package folder to the `simplix-cli` folder, so nothing is copied and the command runs the checkout's source as it is on disk.

```bash
cd <simplix checkout>/simplix-cli
npm ci        # the CLI's runtime dependencies
npm link      # simplix-boot now points at this folder
simplix-boot --version
npm ls -g --depth=0   # the @simplix-boot/cli line ends with "-> <the simplix-cli folder>"
```

- A source change in the checkout (a `git pull`, an edited template) takes effect at once; link again only after the conditions below.
- A change to `simplix-cli/package.json` dependencies needs `npm ci` in that folder again.
- A Node.js version manager keeps one global package folder per Node.js version, so the link exists only for the version it was made under. After switching versions, run `npm link` again.
- The link follows the checkout's working tree: on a branch that has no `simplix-cli` folder, or after the checkout is moved or deleted, the command no longer runs.
- A linked CLI runs the checkout's development version (`-SNAPSHOT`). `version --write` records its `X.Y.Z`, so pin a project from a linked CLI only when the team and CI can run that version too.
- `npm unlink -g @simplix-boot/cli` removes the link.

Before running a generator command in a session, check that it resolves: `simplix-boot --version`. When it does not, link the framework checkout as above or install the published package; never fall back to writing the generated files by hand.

## `simplix-boot help`

Run as `simplix-boot help`, `simplix-boot --help` or `simplix-boot` with no argument. It prints the CLI version, the command list with one line per command, the order of work (`init` → `config` → edit the yml → `generate` → `promote`) and the template rule. `simplix-boot --version` prints the version alone.

It reads and writes no project file and runs outside a project too. Nothing depends on it; run it to refresh memory of the commands.

## `simplix-boot init`

Creates the `.simplix/` folder with the empty `entity/` and `templates/` subfolders, each holding a `.gitkeep`. It does nothing when `.simplix/` already exists (it prints that the folder exists and stops), so it never overwrites a project's configuration or templates.

It does **not** create `.simplix/generator-simplix.json`. After `init` the developer writes that file by hand (paths, base package, template names: `template-customization.md`), then pins the generator with `simplix-boot version --write`. `generate`, `promote` and `generated` refuse to run without that file; `config` reads it when it exists.

## `simplix-boot version`

The generator reads three versions: the generator that is running, the version the project records under `generator.version` in `.simplix/generator-simplix.json` (the file is found by searching upward from the working directory), and the latest version published to npm.

| Form | Effect |
|---|---|
| `simplix-boot version` | Prints the three versions and one verdict: `match`, `outdated` (running is older than the project requires), `ahead` (running is newer than recorded), `unrecorded` (the project records none) or `unknown` (the two cannot be compared) |
| `--json` | The same report as one JSON line on stdout and nothing else, for scripts |
| `--write` | Records the running generator's `X.Y.Z` in `generator.version`, keeping the rest of the file byte for byte. Fails when `generator-simplix.json` does not exist |
| `--update` | Runs `npm install -g` for the latest published version, or for `--to X.Y.Z`. The next `simplix-boot` run uses it |
| `--update --to X.Y.Z` | Installs that exact published version; anything that is not `X.Y.Z` is refused |

**The version gate.** `config`, `generate` and `promote` compare the running generator with `generator.version` before writing anything. An older generator stops the command with the update instructions, because templates and configuration keys move together and an older generator silently produces code the project no longer expects. A newer generator only warns, and a project that records no version gets a one-line notice. `--skip-version-check` overrides the gate for one run. Versions compare by their `X.Y.Z` core, so a `-SNAPSHOT` build satisfies the release it precedes.

Run `--write` after deliberately moving to a newer generator, so the whole team and CI stop on an older one. Run `--update` when a command stops with "older than the version this project requires".

## `simplix-boot generated`

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

## `simplix-boot templates`

The CLI ships the templates `generate` renders from. A file under the project's `.simplix/templates/` replaces the built-in template of the same relative path, file by file (`template-customization.md` § Template Files).

| Form | Effect |
|---|---|
| `simplix-boot templates` | One line per template: `project` for a file under `.simplix/templates/`, `built-in` for one the CLI ships, and a note on a project file that replaces a built-in one |
| `--eject` | Copies every built-in template into `.simplix/templates/`, keeping a project file that already exists |
| `--eject <template>` | Copies that one built-in template, named by its relative path (`dto/EntityDTOs.java.template`); a name the CLI does not ship is refused |
| `--force` | With `--eject`, overwrites the project's copy |

Run `simplix-boot templates` after the CLI is updated: a template the project holds its own copy of does not receive the built-in template's later changes, so each `project` line is a file to compare by hand.
