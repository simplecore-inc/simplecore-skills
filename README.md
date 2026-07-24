# SimpleCORE Skills

[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsimplecore-inc%2Fsimplecore-skills%2Fmain%2F.claude-plugin%2Fmarketplace.json&query=%24.metadata.version&label=version&color=blue)](https://github.com/simplecore-inc/simplecore-skills/blob/main/.claude-plugin/marketplace.json)
[![last updated](https://img.shields.io/github/last-commit/simplecore-inc/simplecore-skills/main?label=last%20updated&color=green)](https://github.com/simplecore-inc/simplecore-skills/commits/main)

A collection of [Claude Code](https://claude.com/claude-code) skills maintained by SimpleCORE Inc., distributed as a plugin marketplace. Each skill is packaged as an independent plugin so you can install only what you need.

## Available Plugins

| Plugin | Components | Description |
| ------ | ---------- | ----------- |
| `svg-diagrams` | skill | Create diagrams as SVG or ASCII — flowcharts, sequence/state/class/ER diagrams, system architecture, pipelines, and network layouts. Includes JSON-spec auto-layout, Mermaid conversion, and a render audit script that catches missing arrowheads, text overflow, and clipped content. |
| `korean-docs` | skill, `/glossary-audit` command, PostToolUse hook | Korean output standards for all deliverables — writing, translation, proofreading, and glossary (GLOSSARY.md) management. Ships a base glossary, a style reference catalog, an automated glossary audit script, a slash command that drives audits to zero errors, and a hook that audits Markdown and SVG files as they are written. |
| `ignite3` | skill | Apache Ignite 3 reference — SQL (DDL/DML/grammar/data types/functions), client APIs (Java/JDBC/.NET/C++), table/transaction/compute/streaming APIs, cluster configuration, operations, and architecture. |
| `wireframe-boards` | skill | Author low-fidelity wireframes as a single self-contained HTML board — fixed-viewport phone and tablet frames, fluid-height desktop frames with a fold marker, a CSS-only narrow ⇄ wide viewport toggle, greybox primitives, flow connectors, and annotation callouts. Ships a board template plus an implementation contract that travels with every board so readers build from the structure instead of copying the greyboxes as a design. |

## Requirements

- Claude Code 2.x
- Node.js 18+ — used by the korean-docs audit tooling and the svg-diagrams layout/conversion scripts
- Python 3 — used by the svg-diagrams render audit script

## Installation

Add the marketplace, then install the plugins you want.

Inside a Claude Code session:

```text
/plugin marketplace add simplecore-inc/simplecore-skills
/plugin install svg-diagrams@simplecore-skills
/plugin install korean-docs@simplecore-skills
/plugin install ignite3@simplecore-skills
/plugin install wireframe-boards@simplecore-skills
```

Or from the terminal:

```bash
claude plugin marketplace add simplecore-inc/simplecore-skills
claude plugin install svg-diagrams@simplecore-skills
claude plugin install korean-docs@simplecore-skills
claude plugin install ignite3@simplecore-skills
claude plugin install wireframe-boards@simplecore-skills
```

Restart your Claude Code session to load the installed components. Commands and hooks register automatically with the plugin — no manual configuration is needed.

## Updating

Fetch the latest marketplace metadata, then update installed plugins:

```bash
claude plugin marketplace update simplecore-skills
claude plugin update svg-diagrams
claude plugin update korean-docs
claude plugin update ignite3
claude plugin update wireframe-boards
```

A restart is required for updates to take effect.

## korean-docs: Command and Hook

### `/glossary-audit` command

Runs the Korean glossary audit for the current project and drives it to zero errors.

```text
/glossary-audit                # audit.paths from the glossary front matter, else project-wide
/glossary-audit docs/ README.md
/glossary-audit --all --strict
/glossary-audit --untranslated # also flag remaining English prose (translation projects)
```

### Markdown audit hook

The plugin registers a `PostToolUse` hook that audits every Markdown file Claude writes or edits. The hook activates automatically when the plugin is installed; there is nothing to configure.

Scope guard: the hook runs only in projects that have a project glossary — `.claude/GLOSSARY.md` (default location) or `GLOSSARY.md`, discovered by walking up from the edited file to the git boundary. Projects without a glossary never see any output. To opt a project in, run `/glossary-audit` once — it offers to create `.claude/GLOSSARY.md` from the bundled template when none exists.

When the hook finds violations, the report is fed back to Claude, which fixes them and continues.

## Repository Layout

```text
simplecore-skills/
├── .claude-plugin/
│   └── marketplace.json           # Marketplace manifest listing the plugins
├── plugins/
│   ├── svg-diagrams/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/svg-diagrams/   # SKILL.md + references/ + scripts/
│   ├── korean-docs/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/glossary-audit.md
│   │   ├── hooks/                 # hooks.json + check-md-glossary.mjs
│   │   └── skills/korean-docs/    # SKILL.md + references/ + scripts/ + templates/
│   ├── ignite3/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/ignite3/        # SKILL.md + references/
│   └── wireframe-boards/
│       ├── .claude-plugin/plugin.json
│       └── skills/wireframe-boards/  # SKILL.md + assets/board-template.html
├── examples/
│   └── CLAUDE.md                  # Global instruction file example
├── LICENSE
└── README.md
```

Each plugin is self-contained under `plugins/<name>/`: components in the default locations (`skills/`, `commands/`, `hooks/`) are discovered automatically, and installs copy only that plugin's subtree.

## Global Instructions Example

[`examples/CLAUDE.md`](examples/CLAUDE.md) is a ready-to-use global instruction file that pairs with these skills. Copy it to `~/.claude/CLAUDE.md` to apply to every project, or merge individual sections into a project-level `CLAUDE.md`.

Every section is written to be environment-agnostic — proactive skill usage, code comment language, import discipline, no-stub/no-test-bypass rules, error handling, git conventions, and emoji-free output. The final "Korean Output Environment" section is optional: keep it together with the `korean-docs` plugin for a Korean-first setup, or delete it otherwise.

## Local Development

To work on a skill and have Claude Code pick up changes immediately, clone this repository and symlink the skill directories into your personal skills folder instead of installing the plugins:

```bash
git clone https://github.com/simplecore-inc/simplecore-skills.git
cd simplecore-skills
ln -s "$(pwd)/plugins/svg-diagrams/skills/svg-diagrams"         ~/.claude/skills/svg-diagrams
ln -s "$(pwd)/plugins/korean-docs/skills/korean-docs"           ~/.claude/skills/korean-docs
ln -s "$(pwd)/plugins/ignite3/skills/ignite3"                   ~/.claude/skills/ignite3
ln -s "$(pwd)/plugins/wireframe-boards/skills/wireframe-boards" ~/.claude/skills/wireframe-boards
```

Personal skills in `~/.claude/skills/` load on every session, so edits in the working tree apply without reinstalling. Do not install the marketplace plugins on the same machine — the skills would be registered twice.

Notes for symlink users:

- Symlinks carry only the skills. The `/glossary-audit` command and the Markdown audit hook register through plugin installation. To get the hook without installing the plugin, add it to `~/.claude/settings.json` with an absolute path:

  ```json
  {
    "hooks": {
      "PostToolUse": [
        {
          "matcher": "Write|Edit|MultiEdit",
          "hooks": [
            {
              "type": "command",
              "command": "node \"/path/to/simplecore-skills/plugins/korean-docs/hooks/check-md-glossary.mjs\"",
              "timeout": 30
            }
          ]
        }
      ]
    }
  }
  ```

- On Windows, creating symlinks requires Developer Mode (or an elevated shell with `mklink /D`). WSL and Linux need no special setup. On Windows, prefer the plugin installation over symlinks unless you are actively editing the skills.

## Releasing Changes

1. Edit the plugin content under `plugins/<name>/`.
2. Bump the `version` in `plugins/<name>/.claude-plugin/plugin.json` (semantic versioning).
3. Validate the manifest: `claude plugin validate .`
4. Commit and push. Users receive the new version through `claude plugin marketplace update` followed by `claude plugin update <plugin>`.

## Attribution

The `ignite3` skill's reference documentation is derived from the [Apache Ignite 3 documentation](https://ignite.apache.org/docs/ignite3/latest/), licensed under the Apache License 2.0.

## License

[Apache License 2.0](LICENSE)
