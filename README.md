# SimpleCORE Skills

[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsimplecore-inc%2Fsimplecore-skills%2Fmain%2F.claude-plugin%2Fmarketplace.json&query=%24.metadata.version&label=version&color=blue)](https://github.com/simplecore-inc/simplecore-skills/blob/main/.claude-plugin/marketplace.json)
[![last updated](https://img.shields.io/github/last-commit/simplecore-inc/simplecore-skills/main?label=last%20updated&color=green)](https://github.com/simplecore-inc/simplecore-skills/commits/main)

A collection of [Claude Code](https://claude.com/claude-code) skills maintained by SimpleCORE Inc., distributed as a plugin marketplace. The marketplace carries two plugins, each registering its skills under its own namespace — `simplecore:korean-docs`, `simplix:backend`, and so on — so they stay identifiable among the skills you have from other sources. Install either one on its own.

## Plugins

### `simplecore` — authoring and design output

General-purpose skills that apply to any repository.

| Skill | Description |
| ----- | ----------- |
| `simplecore:korean-docs` | Korean output standards for all deliverables — writing, translation, proofreading, and glossary (GLOSSARY.md) management. Ships a base glossary, a style reference catalog, and an automated glossary audit script. |
| `simplecore:svg-diagrams` | Create diagrams as SVG or ASCII — flowcharts, sequence/state/class/ER diagrams, system architecture, pipelines, and network layouts. Includes JSON-spec auto-layout, Mermaid conversion, and a render audit script that catches missing arrowheads, text overflow, and clipped content. |
| `simplecore:wireframe-boards` | Author low-fidelity wireframes as a single self-contained HTML board — fixed-viewport phone and tablet frames, fluid-height desktop frames with a fold marker, a CSS-only narrow ⇄ wide viewport toggle, greybox primitives, flow connectors, and annotation callouts. Ships a board template plus an implementation contract that travels with every board so readers build from the structure instead of copying the greyboxes as a design. |

It also registers the `/simplecore:glossary-audit` command and a PostToolUse hook that audits Markdown and SVG files as they are written — both belong to `korean-docs` and are documented below.

### `simplix` — the SimpliX development stack

Handbooks for repositories built on SimpliX. Each skill states its own applicability marker and stays silent elsewhere: `backend` applies to Spring Boot repositories extending the SimpliX base classes, `frontend` and `frontend-e2e` to repositories with a `simplix.config.ts` and `@simplix-react/*` dependencies.

| Skill | Description |
| ----- | ----------- |
| `simplix:backend` | Spring Boot backend handbook — 19 non-negotiable invariants (response envelope, `@PreAuthorize`, exception and message-key policy, DTO roles, date/time semantic typing), entity design, the YAML-driven `yo simplix` generator workflow, and DTO / security review. |
| `simplix:frontend` | simplix-react frontend handbook — 52 non-negotiable invariants, OpenAPI-driven scaffolding, `CrudList` / `CrudForm` / `CrudDetail` customization, filter and column design, a commonization registry, and documentation standards. Ships the convention audit and screen-inventory scripts. |
| `simplix:frontend-e2e` | Browser-driven usability, lifecycle, and cross-screen consistency audit. Drives the running app as each persona, judges through four lenses anchored to the `simplix:frontend` invariants, and runs five mandatory censuses over every screen in scope. |

It also registers the `/simplix:init` command and a SessionStart hook that detects the stack — both documented below.

## Requirements

- Claude Code 2.x
- Node.js 18+ — used by the korean-docs audit tooling, the svg-diagrams layout/conversion scripts, and the simplix frontend audit scripts
- Python 3 — used by the svg-diagrams render audit script
- A browser-automation MCP (Claude in Chrome or equivalent) — used by `simplix:frontend-e2e`

## Installation

Add the marketplace, then install the plugins you want.

Inside a Claude Code session:

```text
/plugin marketplace add simplecore-inc/simplecore-skills
/plugin install simplecore@simplecore-skills
/plugin install simplix@simplecore-skills
```

Or from the terminal:

```bash
claude plugin marketplace add simplecore-inc/simplecore-skills
claude plugin install simplecore@simplecore-skills
claude plugin install simplix@simplecore-skills
```

Restart your Claude Code session to load the installed components. Commands and hooks register automatically with their plugin — no manual configuration is needed.

### Coming from the separate plugins

Earlier releases shipped `svg-diagrams`, `korean-docs`, `ignite3`, and `wireframe-boards` as four plugins. Uninstall them before installing `simplecore`, or the skills register twice:

```bash
claude plugin uninstall svg-diagrams korean-docs ignite3 wireframe-boards
claude plugin marketplace update simplecore-skills
claude plugin install simplecore@simplecore-skills
```

The `/glossary-audit` command is now `/simplecore:glossary-audit`.

## Updating

Fetch the latest marketplace metadata, then update each installed plugin:

```bash
claude plugin marketplace update simplecore-skills
claude plugin update simplecore
claude plugin update simplix
```

A restart is required for updates to take effect.

## korean-docs: Command and Hook

### `/simplecore:glossary-audit` command

Runs the Korean glossary audit for the current project and drives it to zero errors.

```text
/simplecore:glossary-audit                # audit.paths from the glossary front matter, else project-wide
/simplecore:glossary-audit docs/ README.md
/simplecore:glossary-audit --all --strict
/simplecore:glossary-audit --untranslated # also flag remaining English prose (translation projects)
```

### Markdown audit hook

The `simplecore` plugin registers a `PostToolUse` hook that audits every Markdown file Claude writes or edits. The hook activates automatically when the plugin is installed; there is nothing to configure.

Scope guard: the hook runs only in projects that have a project glossary — `.claude/GLOSSARY.md` (default location) or `GLOSSARY.md`, discovered by walking up from the edited file to the git boundary. Projects without a glossary never see any output. To opt a project in, run `/simplecore:glossary-audit` once — it offers to create `.claude/GLOSSARY.md` from the bundled template when none exists.

When the hook finds violations, the report is fed back to Claude, which fixes them and continues.

## simplix: Detection, Command and Hook

### Stack detection

The plugin recognizes a SimpliX project from its markers rather than from configuration you maintain:

| Stack | Markers |
| --- | --- |
| Backend | a `.simplix/` generator directory, or a Gradle root whose `settings.gradle` / `build.gradle` / `gradle.properties` declares a simplix dependency |
| Frontend | a `simplix.config.{ts,mts,js,mjs}`, or a `package.json` depending on `@simplix-react/*` |

The scan reads directory entries two levels deep, skips dependency and build output directories, and stops descending as soon as a directory matches — so a monorepo reports its subproject roots, not every Gradle module or workspace package. A repository that publishes under the `@simplix-react/` scope is recognized as the framework itself, where the consumer handbooks do not apply.

Run it directly at any time:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs"           # human-readable
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json    # machine-readable
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --root=../other-repo
```

Exit code 0 means at least one SimpliX subproject was found, 1 means none.

### SessionStart hook

At session start the plugin runs the detector against the working directory. When it matches, Claude receives a note naming each subproject, its markers, and the skill that gates it. A repository with no SimpliX marker produces no output at all, and a detector failure is silent — a hook must never be the reason a session cannot start.

The note also reports whether any `CLAUDE.md` / `AGENTS.md` in the project already routes to the skills. When none does, Claude offers `/simplix:init` once and then continues with your task.

### `/simplix:init` command

Writes the routing into an instruction file, so the gate holds in sessions where the plugin is not installed and for anyone else working in the repository.

```text
/simplix:init              # project block into .claude/CLAUDE.md, with the detected paths
/simplix:init --global     # path-free block into ~/.claude/CLAUDE.md, covering every SimpliX project
```

Both blocks live in [`plugins/simplix/templates/claude-md-section.md`](plugins/simplix/templates/claude-md-section.md) — copy them by hand if you would rather not run the command. The command shows what it will insert and writes only after you agree; an existing SimpliX section is updated in place rather than duplicated.

### Frontend scripts

The `frontend` and `frontend-e2e` skills reference two scripts that ship with the plugin. Run them from the frontend project root, or point them at it with `--root=<dir>`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs"      # machine-checkable convention rules
node "${CLAUDE_PLUGIN_ROOT}/scripts/screen-inventory.mjs"    # every screen classified by shape
```

`audit-frontend.mjs` exits 1 when an error-level rule has hits; review-level rules print candidates that need human judgment and never fail the run.

## Repository Layout

```text
simplecore-skills/
├── .claude-plugin/
│   └── marketplace.json                  # Marketplace manifest
├── plugins/
│   ├── simplecore/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/glossary-audit.md
│   │   ├── hooks/                        # hooks.json + check-md-glossary.mjs
│   │   └── skills/
│   │       ├── korean-docs/              # SKILL.md + references/ + scripts/ + templates/
│   │       ├── svg-diagrams/             # SKILL.md + references/ + scripts/
│   │       └── wireframe-boards/         # SKILL.md + assets/board-template.html
│   └── simplix/
│       ├── .claude-plugin/plugin.json
│       ├── commands/init.md
│       ├── hooks/                        # hooks.json + session-start.mjs
│       ├── scripts/                      # detect-simplix.mjs + audit-frontend.mjs + screen-inventory.mjs
│       ├── templates/                    # claude-md-section.md
│       └── skills/
│           ├── backend/                  # SKILL.md + references/
│           ├── frontend/                 # SKILL.md + references/
│           └── frontend-e2e/             # SKILL.md + references/
├── examples/
│   └── CLAUDE.md                         # Global instruction file example
├── LICENSE
└── README.md
```

Components in the default locations (`skills/`, `commands/`, `hooks/`) are discovered automatically. Every skill registers as `<plugin>:<skill-name>`, and paths inside a plugin resolve through `${CLAUDE_PLUGIN_ROOT}`.

## Global Instructions Example

[`examples/CLAUDE.md`](examples/CLAUDE.md) is a ready-to-use global instruction file that pairs with these skills. Copy it to `~/.claude/CLAUDE.md` to apply to every project, or merge individual sections into a project-level `CLAUDE.md`.

Every section is written to be environment-agnostic — proactive skill usage, code comment language, import discipline, no-stub/no-test-bypass rules, error handling, git conventions, and emoji-free output. The final "Korean Output Environment" section is optional: keep it together with the `korean-docs` plugin for a Korean-first setup, or delete it otherwise.

## Local Development

To work on the skills and have Claude Code pick up changes immediately, clone this repository and symlink the plugin directories you are editing into your personal skills folder instead of installing them:

```bash
git clone https://github.com/simplecore-inc/simplecore-skills.git
cd simplecore-skills
ln -s "$(pwd)/plugins/simplecore" ~/.claude/skills/simplecore
ln -s "$(pwd)/plugins/simplix" ~/.claude/skills/simplix
```

Claude Code loads any directory under `~/.claude/skills/` that carries a `.claude-plugin/plugin.json` as a plugin, so each link registers as `<name>@skills-dir` — its skills under their own namespace, plus any command and hook it ships, all read live from the working tree. Confirm what loaded with:

```bash
claude plugin details simplecore@skills-dir
claude plugin details simplix@skills-dir
```

Installing from the marketplace copies a plugin into `~/.claude/plugins/cache/`, where edits do not propagate until you bump the version in its `plugin.json` and run `claude plugin update <name>@simplecore-skills`. Pick one method per plugin per machine: an installed plugin takes precedence over the linked copy and the linked copy is skipped with a name-conflict error.

Notes for symlink users:

- Keep the marketplace registered (`claude plugin marketplace add ./path/to/simplecore-skills`) so `claude plugin validate .` and release testing stay available while you develop against the link.
- Scripts and reference files are addressed through `${CLAUDE_PLUGIN_ROOT}`, which resolves to `~/.claude/skills/<name>` under a link and to the versioned cache directory under a marketplace install. Do not hardcode either path.
- On Windows, creating symlinks requires Developer Mode (or an elevated shell with `mklink /D`). WSL and Linux need no special setup. On Windows, prefer the plugin installation over symlinks unless you are actively editing the skills.

## Releasing Changes

1. Edit the skill content under `plugins/<plugin>/skills/<skill>/`.
2. Bump the `version` in `plugins/<plugin>/.claude-plugin/plugin.json` (semantic versioning). A plugin's skills share one version — a change to any of them bumps it. Bump `metadata.version` in `.claude-plugin/marketplace.json` when the set of plugins changes.
3. Validate the manifest: `claude plugin validate .`
4. Commit and push. Users receive the new version through `claude plugin marketplace update` followed by `claude plugin update <plugin>`.

## License

[Apache License 2.0](LICENSE)
