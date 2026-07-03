# SimpleCore Skills

A collection of [Claude Code](https://claude.com/claude-code) skills maintained by SimpleCore Inc., distributed as a plugin marketplace. Each skill is packaged as an independent plugin so you can install only what you need.

## Available Skills

| Plugin | Skill | Description |
|--------|-------|-------------|
| `svg-diagrams` | svg-diagrams | Create diagrams as SVG or ASCII — flowcharts, sequence/state/class/ER diagrams, system architecture, pipelines, and network layouts. Includes JSON-spec auto-layout, Mermaid conversion, and a render audit script that catches missing arrowheads, text overflow, and clipped content. |
| `korean-docs` | korean-docs | Korean output standards for all deliverables — writing, translation, proofreading, and glossary (GLOSSARY.md) management. Ships a base glossary, a style reference catalog, and an automated glossary audit script. |
| `ignite3` | ignite3 | Apache Ignite 3 reference — SQL (DDL/DML/grammar/data types/functions), client APIs (Java/JDBC/.NET/C++), table/transaction/compute/streaming APIs, cluster configuration, operations, and architecture. |

## Installation

Add the marketplace, then install the plugins you want.

Inside a Claude Code session:

```
/plugin marketplace add simplecore-inc/simplecore-skills
/plugin install svg-diagrams@simplecore-skills
/plugin install korean-docs@simplecore-skills
/plugin install ignite3@simplecore-skills
```

Or from the terminal:

```bash
claude plugin marketplace add simplecore-inc/simplecore-skills
claude plugin install svg-diagrams@simplecore-skills
claude plugin install korean-docs@simplecore-skills
claude plugin install ignite3@simplecore-skills
```

Restart your Claude Code session to load the installed skills.

## Updating

Fetch the latest marketplace metadata, then update installed plugins:

```bash
claude plugin marketplace update simplecore-skills
claude plugin update svg-diagrams
claude plugin update korean-docs
claude plugin update ignite3
```

A restart is required for updates to take effect.

## Global Instructions Example

[`examples/CLAUDE.md`](examples/CLAUDE.md) is a ready-to-use global instruction file that pairs with these skills. Copy it to `~/.claude/CLAUDE.md` to apply to every project, or merge individual sections into a project-level `CLAUDE.md`.

Every section is written to be environment-agnostic — code comment language, import discipline, no-stub/no-test-bypass rules, error handling, git conventions, and emoji-free output. The final "Korean Output Environment" section is optional: keep it together with the `korean-docs` plugin for a Korean-first setup, or delete it otherwise.

## Repository Layout

```
simplecore-skills/
├── .claude-plugin/
│   └── marketplace.json   # Marketplace manifest defining the three plugins
├── skills/
│   ├── svg-diagrams/      # SKILL.md + references/ + scripts/
│   ├── korean-docs/       # SKILL.md + references/ + scripts/ + templates/
│   └── ignite3/           # SKILL.md + references/
├── examples/
│   └── CLAUDE.md          # Global instruction file example
├── LICENSE
└── README.md
```

Each plugin entry in `marketplace.json` points at this repository root as its source and registers exactly one skill directory via the `skills` field.

## Local Development

To work on a skill and have Claude Code pick up changes immediately, clone this repository and symlink the skill directories into your personal skills folder instead of installing the plugins:

```bash
git clone https://github.com/simplecore-inc/simplecore-skills.git
cd simplecore-skills
ln -s "$(pwd)/skills/svg-diagrams" ~/.claude/skills/svg-diagrams
ln -s "$(pwd)/skills/korean-docs"  ~/.claude/skills/korean-docs
ln -s "$(pwd)/skills/ignite3"      ~/.claude/skills/ignite3
```

Personal skills in `~/.claude/skills/` load on every session, so edits in the working tree apply without reinstalling. Do not install the marketplace plugins on the same machine — the skills would be registered twice.

## Releasing Changes

1. Edit the skill content under `skills/`.
2. Bump the affected plugin's `version` in `.claude-plugin/marketplace.json` (semantic versioning).
3. Validate the manifest: `claude plugin validate .`
4. Commit and push. Users receive the new version through `claude plugin marketplace update` followed by `claude plugin update <plugin>`.

## Attribution

The `ignite3` skill's reference documentation is derived from the [Apache Ignite 3 documentation](https://ignite.apache.org/docs/ignite3/latest/), licensed under the Apache License 2.0.

## License

[Apache License 2.0](LICENSE)
