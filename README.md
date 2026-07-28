# SimpleCORE Skills

[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsimplecore-inc%2Fsimplecore-skills%2Fmain%2F.claude-plugin%2Fmarketplace.json&query=%24.metadata.version&label=version&color=blue)](https://github.com/simplecore-inc/simplecore-skills/blob/main/.claude-plugin/marketplace.json)
[![last updated](https://img.shields.io/github/last-commit/simplecore-inc/simplecore-skills/main?label=last%20updated&color=green)](https://github.com/simplecore-inc/simplecore-skills/commits/main)

A collection of [Claude Code](https://claude.com/claude-code) skills maintained by SimpleCORE Inc., distributed as a plugin marketplace. The skills ship together as one `simplecore` plugin, so they register under a shared namespace — `simplecore:korean-docs`, `simplecore:svg-diagrams`, and so on — and stay identifiable among the skills you have from other sources.

## Included Skills

| Skill | Description |
| ----- | ----------- |
| `simplecore:korean-docs` | Korean output standards for all deliverables — writing, translation, proofreading, and glossary (GLOSSARY.md) management. Ships a base glossary, a style reference catalog, and an automated glossary audit script. |
| `simplecore:svg-diagrams` | Create diagrams as SVG or ASCII — flowcharts, sequence/state/class/ER diagrams, system architecture, pipelines, and network layouts. Includes JSON-spec auto-layout, Mermaid conversion, and a render audit script that catches missing arrowheads, text overflow, and clipped content. |
| `simplecore:wireframe-boards` | Author low-fidelity wireframes as a single self-contained HTML board — fixed-viewport phone and tablet frames, fluid-height desktop frames with a fold marker, a CSS-only narrow ⇄ wide viewport toggle, greybox primitives, flow connectors, and annotation callouts. Ships a board template plus an implementation contract that travels with every board so readers build from the structure instead of copying the greyboxes as a design. |

The plugin also registers the `/simplecore:glossary-audit` command and a PostToolUse hook that audits Markdown and SVG files as they are written — both belong to `korean-docs` and are documented below.

## Requirements

- Claude Code 2.x
- Node.js 18+ — used by the korean-docs audit tooling and the svg-diagrams layout/conversion scripts
- Python 3 — used by the svg-diagrams render audit script

## Installation

Add the marketplace, then install the plugin.

Inside a Claude Code session:

```text
/plugin marketplace add simplecore-inc/simplecore-skills
/plugin install simplecore@simplecore-skills
```

Or from the terminal:

```bash
claude plugin marketplace add simplecore-inc/simplecore-skills
claude plugin install simplecore@simplecore-skills
```

Restart your Claude Code session to load the installed components. The command and hook register automatically with the plugin — no manual configuration is needed.

### Coming from the separate plugins

Earlier releases shipped `svg-diagrams`, `korean-docs`, `ignite3`, and `wireframe-boards` as four plugins. Uninstall them before installing `simplecore`, or the skills register twice:

```bash
claude plugin uninstall svg-diagrams korean-docs ignite3 wireframe-boards
claude plugin marketplace update simplecore-skills
claude plugin install simplecore@simplecore-skills
```

The `/glossary-audit` command is now `/simplecore:glossary-audit`.

## Updating

Fetch the latest marketplace metadata, then update the plugin:

```bash
claude plugin marketplace update simplecore-skills
claude plugin update simplecore
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

The plugin registers a `PostToolUse` hook that audits every Markdown file Claude writes or edits. The hook activates automatically when the plugin is installed; there is nothing to configure.

Scope guard: the hook runs only in projects that have a project glossary — `.claude/GLOSSARY.md` (default location) or `GLOSSARY.md`, discovered by walking up from the edited file to the git boundary. Projects without a glossary never see any output. To opt a project in, run `/simplecore:glossary-audit` once — it offers to create `.claude/GLOSSARY.md` from the bundled template when none exists.

When the hook finds violations, the report is fed back to Claude, which fixes them and continues.

## Repository Layout

```text
simplecore-skills/
├── .claude-plugin/
│   └── marketplace.json                  # Marketplace manifest
├── plugins/
│   └── simplecore/
│       ├── .claude-plugin/plugin.json
│       ├── commands/glossary-audit.md
│       ├── hooks/                        # hooks.json + check-md-glossary.mjs
│       └── skills/
│           ├── korean-docs/              # SKILL.md + references/ + scripts/ + templates/
│           ├── svg-diagrams/             # SKILL.md + references/ + scripts/
│           └── wireframe-boards/         # SKILL.md + assets/board-template.html
├── examples/
│   └── CLAUDE.md                         # Global instruction file example
├── LICENSE
└── README.md
```

Components in the default locations (`skills/`, `commands/`, `hooks/`) are discovered automatically. Every skill under `skills/` registers as `simplecore:<skill-name>`, and paths inside the plugin resolve through `${CLAUDE_PLUGIN_ROOT}`.

## Global Instructions Example

[`examples/CLAUDE.md`](examples/CLAUDE.md) is a ready-to-use global instruction file that pairs with these skills. Copy it to `~/.claude/CLAUDE.md` to apply to every project, or merge individual sections into a project-level `CLAUDE.md`.

Every section is written to be environment-agnostic — proactive skill usage, code comment language, import discipline, no-stub/no-test-bypass rules, error handling, git conventions, and emoji-free output. The final "Korean Output Environment" section is optional: keep it together with the `korean-docs` plugin for a Korean-first setup, or delete it otherwise.

## Local Development

To work on a skill and have Claude Code pick up changes immediately, clone this repository and symlink the skill directories into your personal skills folder instead of installing the plugin:

```bash
git clone https://github.com/simplecore-inc/simplecore-skills.git
cd simplecore-skills
for s in korean-docs svg-diagrams wireframe-boards; do
  ln -s "$(pwd)/plugins/simplecore/skills/$s" ~/.claude/skills/"$s"
done
```

Personal skills in `~/.claude/skills/` load on every session, so edits in the working tree apply without reinstalling. Installing the plugin copies the skills into `~/.claude/plugins/cache/`, where edits do not propagate until you bump the version and run `claude plugin update`. Do not do both on the same machine — the skills would be registered twice.

Notes for symlink users:

- Personal skills carry no plugin namespace, so they register as `korean-docs` rather than `simplecore:korean-docs`. Install the plugin instead when the grouped names matter more than live edits.
- Symlinks carry only the skills. The `/simplecore:glossary-audit` command and the Markdown audit hook register through plugin installation. To get the hook without installing the plugin, add it to `~/.claude/settings.json` with an absolute path:

  ```json
  {
    "hooks": {
      "PostToolUse": [
        {
          "matcher": "Write|Edit|MultiEdit",
          "hooks": [
            {
              "type": "command",
              "command": "node \"/path/to/simplecore-skills/plugins/simplecore/hooks/check-md-glossary.mjs\"",
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

1. Edit the skill content under `plugins/simplecore/skills/<skill>/`.
2. Bump the `version` in `plugins/simplecore/.claude-plugin/plugin.json` (semantic versioning). The skills share one version — a change to any of them bumps it.
3. Validate the manifest: `claude plugin validate .`
4. Commit and push. Users receive the new version through `claude plugin marketplace update` followed by `claude plugin update simplecore`.

## License

[Apache License 2.0](LICENSE)
