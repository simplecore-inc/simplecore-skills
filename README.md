# SimpleCORE Skills

[![simplecore](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsimplecore-inc%2Fsimplecore-skills%2Fmain%2Fplugins%2Fsimplecore%2F.claude-plugin%2Fplugin.json&query=%24.version&label=simplecore&color=blue)](https://github.com/simplecore-inc/simplecore-skills/blob/main/plugins/simplecore/.claude-plugin/plugin.json)
[![last updated](https://img.shields.io/github/last-commit/simplecore-inc/simplecore-skills/main?label=last%20updated&color=green)](https://github.com/simplecore-inc/simplecore-skills/commits/main)

A collection of [Claude Code](https://claude.com/claude-code) skills maintained by SimpleCORE Inc., distributed as a plugin marketplace. The marketplace carries the `simplecore` plugin, which registers its skills under its own namespace - `simplecore:korean-docs` and so on - so they stay identifiable among the skills you have from other sources. The handbooks for the SimpliX stack are the `simplix` plugin of the simplix-skills repository.

## Plugins

### `simplecore` - authoring and design output

General-purpose skills that apply to any repository.

| Skill | Description |
| ----- | ----------- |
| `simplecore:korean-docs` | Korean output standards for all deliverables - writing, translation, proofreading, and glossary (GLOSSARY.md) management. Ships a base glossary, a style reference catalog, and an automated glossary audit script. |
| `simplecore:svg-diagrams` | Create diagrams as SVG or ASCII - flowcharts, sequence/state/class/ER diagrams, system architecture, pipelines, and network layouts. Includes JSON-spec auto-layout, Mermaid conversion, a render audit script that catches missing arrowheads, text overflow, and clipped content, and the shared document-figure library (`scripts/docfigures/`) a project's figure modules import to build and verify every figure of a document. |
| `simplecore:iso-scenes` | Isometric scenes of physical equipment for explanatory documents - ground areas, realistic devices built from solids, cables whose routing is checked by machine, labels placed without overlap. Draws on the svg-diagrams document-figure canvas |
| `simplecore:proposal-writing` | The content standard for a Korean bid proposal, its presentation summary and the technical documents around them - what a page must claim, how a requirement is answered in the panel's own words, controlled language for every reader-facing string, enumerations as lists, self-contained references and annex naming, honest reporting of tests and evidence, and the evaluator-persona review that judges the result. Ships the content checks in `scripts/` (requirement ids, tender citations, annex references, scoring coverage, shared facts, page volume, claims triage), each run directly. |
| `simplecore:bid-proposal` | Runs one bid from the issued tender to the submitted package - tender transcription, score simulation, kickoff decisions asked once, manuscript, figures and annexes, persona and Korean review, the presentation deck, the quantitative volume, expected Q&A and the packaged deliverables - with a ledger in the bid repository so any session resumes where the last stopped. Orders the work and makes the calls; the standards come from the skills above. |

It also registers the commands, agents and hooks below, each documented further down:

| Component | Belongs to | What it does |
| --- | --- | --- |
| `/simplecore:init` | all | Detects which skills bind here, writes the routing, proposes the global instructions they need |
| `/simplecore:glossary-audit` | `korean-docs` | Runs the Korean glossary audit and drives it to zero errors |
| SessionStart hook | all | Detects Korean documents and reports which wiring is missing |
| Markdown/SVG audit hook | `korean-docs` | Audits Korean prose and diagram labels as they are written |
| SVG lint hook | `svg-diagrams` | Lints an SVG written with the Write or Edit tools that carries a label or an arrowhead, for unresolved markers, overflow, and clipped content |

`/simplecore:init` exists because these skills depend on wiring the user has no reason to know about. It writes nothing without agreement.

## Requirements

- Claude Code 2.x
- Node.js 18+ - used by the korean-docs audit tooling and the svg-diagrams layout/conversion scripts
- Python 3 - used by the svg-diagrams render audit script and figure library, the `bidkit` library, and the proposal-writing checks
- Optional Python package, needed only by the steps that name it: Pillow (the svg-diagrams raster lint rule)
- Chrome or Chromium, found on the usual install paths or named by `CHROME` - used by the svg-diagrams render, crop, hotspot and contrast steps
- Optional: `npm install -g beautiful-mermaid` - used by svg-diagrams for Mermaid sequence, state, class and ER rendering and for ASCII output; a plugin install runs no package manager, so nothing installs it for you

## Installation

Add the marketplace, then install the plugins you want.

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

Restart your Claude Code session to load the installed components. Commands and hooks register automatically with their plugin - no manual configuration is needed.

## Updating

Fetch the latest marketplace metadata, then update each installed plugin:

```bash
claude plugin marketplace update simplecore-skills
claude plugin update simplecore
```

A restart is required for updates to take effect.

## simplecore: Detection, Commands and Hooks

The commands below run from a shell, where `<plugin-root>` stands for the installed plugin's directory: the working tree under a local-folder install, `~/.claude/skills/<plugin>` under a link, and the versioned directory under `~/.claude/plugins/cache/` under a marketplace install.

### Skill detection

The plugin recognizes what a project needs from its markers rather than from configuration you maintain:

| Skill | Markers |
| --- | --- |
| `korean-docs` | a project glossary, or Hangul in the README / instruction file |

```bash
node "<plugin-root>/scripts/detect-simplecore.mjs"           # human-readable
node "<plugin-root>/scripts/detect-simplecore.mjs" --json    # machine-readable
node "<plugin-root>/scripts/detect-simplecore.mjs" --root=../other-repo
```

Exit code 0 means at least one skill binds, 1 means none.

### SessionStart hook

At session start the plugin runs the detector. When it matches, Claude receives a note naming each skill that binds, where the project's own contents live, and - from the detector's `missing` list - every piece of wiring that is absent, in the terms to say them in. A directory matching no marker produces no output at all, and a detector failure is silent.

### `/simplecore:init` command

Writes the routing into an instruction file, so the skills bind in sessions where the plugin is not installed and for anyone else working in the repository. It also proposes the two global instructions a project cannot supply for itself - the Korean style baseline that ordinary answers need, and the authority to start and stop a local development server without asking each time.

```text
/simplecore:init              # project block into the repository's instruction file
/simplecore:init --global     # only the global blocks, into ~/.claude/CLAUDE.md
```

Both blocks live in [`plugins/simplecore/templates/claude-md-section.md`](plugins/simplecore/templates/claude-md-section.md) - copy them by hand if you would rather not run the command.

### Gates on the artifacts

The SVG lint checks a file the moment it is written, because the defects it catches are invisible in the source and survive a careful read of the diff:

| Hook | Fires on | Catches |
| --- | --- | --- |
| SVG lint | an `.svg` written with the Write or Edit tools that carries text or an arrowhead | unresolved markers, oblique arrows, text overflow, clipped content - the same scan `audit.py lint` runs |

It is on by default; a project turns it off in `.claude/simplecore.json`:

```json
{ "svgLint": false }
```

Only an explicit `false` disables it, so a typo never silently turns one off. The SVG lint skips silently without python3, and reports `[review]` findings that need judgment separately from `[error]` findings that fail the write.

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

Scope guard: the hook runs only in projects that have a project glossary - `.claude/GLOSSARY.md` (default location) or `GLOSSARY.md`, discovered by walking up from the edited file to the git boundary. Projects without a glossary never see any output. To opt a project in, run `/simplecore:glossary-audit` once - it offers to create `.claude/GLOSSARY.md` from the bundled template when none exists.

When the hook finds violations, the report is fed back to Claude, which fixes them and continues.

## Repository Layout

```text
simplecore-skills/
├── .claude-plugin/
│   └── marketplace.json                  # Marketplace manifest
├── plugins/
│   └── simplecore/
│       ├── .claude-plugin/plugin.json
│       ├── commands/                     # /simplecore:* commands
│       ├── hooks/                        # hooks.json, the SessionStart note, the write-time checks and gates
│       ├── scripts/                      # detect-simplecore.mjs, test.sh, bidkit/ (the deck checks' library)
│       ├── templates/                    # claude-md-section.md, the routing blocks /simplecore:init writes
│       └── skills/                       # one directory per skill: SKILL.md beside its references/,
│                                         #   assets/ and scripts/
├── examples/
│   └── CLAUDE.md                         # Global instruction file example
├── LICENSE
└── README.md
```

Components in the default locations (`skills/`, `commands/`, `hooks/`, `agents/`) are discovered automatically. Every skill registers as `<plugin>:<skill-name>` and every agent as `<plugin>:<agent-name>`, and paths inside a plugin resolve through `${CLAUDE_PLUGIN_ROOT}`.

## Global Instructions Example

[`examples/CLAUDE.md`](examples/CLAUDE.md) is a ready-to-use global instruction file that pairs with these skills. Copy it to `~/.claude/CLAUDE.md` to apply to every project, or merge individual sections into a project-level `CLAUDE.md`.

Every section is written to be environment-agnostic - proactive skill usage, code comment language, import discipline, no-stub/no-test-bypass rules, error handling, git conventions, and emoji-free output. The final "Korean Output Environment" section is optional: keep it together with the `korean-docs` plugin for a Korean-first setup, or delete it otherwise.

## Local Development

To work on the skills and have Claude Code pick up changes immediately, clone this repository and symlink the plugin directories you are editing into your personal skills folder instead of installing them:

```bash
git clone https://github.com/simplecore-inc/simplecore-skills.git
cd simplecore-skills
ln -s "$(pwd)/plugins/simplecore" ~/.claude/skills/simplecore
```

Claude Code loads any directory under `~/.claude/skills/` that carries a `.claude-plugin/plugin.json` as a plugin, so each link registers as `<name>@skills-dir` - its skills under their own namespace, plus any command and hook it ships, all read live from the working tree. Confirm what loaded with:

```bash
claude plugin details simplecore@skills-dir
```

Installing from the marketplace copies a plugin into `~/.claude/plugins/cache/`, where edits do not propagate until you bump the version in its `plugin.json` and run `claude plugin update <name>@simplecore-skills`. Pick one method per plugin per machine: an installed plugin takes precedence over the linked copy and the linked copy is skipped with a name-conflict error.

Notes for symlink users:

- Keep the marketplace registered (`claude plugin marketplace add ./path/to/simplecore-skills`) so `claude plugin validate .` and release testing stay available while you develop against the link.
- Scripts are addressed through `${CLAUDE_PLUGIN_ROOT}`. Claude Code replaces it with the plugin's directory (`~/.claude/skills/<name>` under a link, the versioned cache directory under a marketplace install, the working tree under a local-folder install) in a SKILL.md, a command and a hook. A reference file is read as written and the shell carries no such variable, so each SKILL.md whose references run commands states the plugin root once. Do not hardcode any of these paths.
- Installed from a local folder (`claude plugin marketplace add ./simplecore-skills`), a plugin is already read live from the working tree, so it needs no link to pick up edits. Global instruction files that name the skills' references by path (`~/.claude/skills/simplecore/skills/korean-docs/...`) still need that folder, and linking the whole plugin there fails with the name-conflict error at every `/reload-plugins`. Make it a plain folder holding links to the data alone, with no `.claude-plugin/` in it, so it is not loaded as a second plugin:

  ```bash
  mkdir -p ~/.claude/skills/simplecore
  ln -s "$(pwd)/plugins/simplecore/skills" ~/.claude/skills/simplecore/skills
  ln -s "$(pwd)/plugins/simplecore/scripts" ~/.claude/skills/simplecore/scripts
  ```

- On Windows, creating symlinks requires Developer Mode (or an elevated shell with `mklink /D`). WSL and Linux need no special setup. On Windows, prefer the plugin installation over symlinks unless you are actively editing the skills.

## Development

The Python suites of the `simplecore` plugin (the `bidkit` library, the proposal-writing checks and the svg-diagrams figure library) run with one command, which starts each suite from the directory its imports expect, prints one count line per suite and exits non-zero when any fails:

```bash
plugins/simplecore/scripts/test.sh        # add -v for each suite's full output
```

The Node tools prove their own rules both ways:

```bash
node plugins/simplecore/skills/korean-docs/scripts/l10n.mjs rules --test   # the rule pack against its hit and miss examples
```


A check is added with tests that build its broken form and its fixed form, so a suite that passes has seen each check fire and stay quiet.

## Releasing Changes

1. Edit the skill content under `plugins/<plugin>/skills/<skill>/`.
2. Bump the `version` in `plugins/<plugin>/.claude-plugin/plugin.json` (semantic versioning) in a `chore(release)` commit of its own, covering every plugin that changed. A plugin's skills share one version - a change to any of them bumps it. The badges at the top read each `plugin.json`. Bump `metadata.version` in `.claude-plugin/marketplace.json` when the set of plugins changes.
3. Validate the manifest: `claude plugin validate .`
4. Commit and push. Users receive the new version through `claude plugin marketplace update` followed by `claude plugin update <plugin>`.

## License

[Apache License 2.0](LICENSE)
