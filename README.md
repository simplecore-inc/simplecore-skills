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
| `simplecore:wireframe-boards` | Author low-fidelity wireframes as a single self-contained HTML board — fixed-viewport phone and tablet frames, fluid-height desktop frames with a fold marker, a CSS-only narrow ⇄ wide viewport toggle, greybox primitives, flow connectors, and annotation callouts. Frames wrap into a vertical grid rather than scrolling sideways, and each carries a permanent id plus its current board position. Ships a board template, a build kit for larger boards, and an implementation contract that travels with every board so readers build from the structure instead of copying the greyboxes as a design. |
| `simplecore:board-parity-walk` | Walk a board's frames against the running app, section by section, across many sessions. Applies only where a board already exists. Carries what a walk that long needs to survive itself: one cluster per subagent with a fresh agent after each, facts shared in one handover file while narrative stays per-agent, judgment lenses so parity is the floor rather than the verdict, a decision nobody can settle parked instead of stopping the walk, and a list that holds only what is left. Ships the walker agent, the two document templates, and the config that turns the write-time checks on. |

It also registers four commands, one agent, and a set of hooks, all documented below:

| Component | Belongs to | What it does |
| --- | --- | --- |
| `/simplecore:init` | all | Detects which skills bind here, writes the routing, proposes the global instructions they need |
| `/simplecore:glossary-audit` | `korean-docs` | Runs the Korean glossary audit and drives it to zero errors |
| `/simplecore:board-init` | `wireframe-boards` | Wires a project for its board — build kit, folder reading contract, instruction-file pointer |
| `/simplecore:parity-walk-init` | `board-parity-walk` | Wires a project for a parity walk — config, the two documents, instruction-file pointer |
| `simplecore:board-walker` agent | `board-parity-walk` | Walks one cluster against the running app and returns conclusions only |
| SessionStart hook | all | Detects a board, a parity walk, or Korean documents, and reports which wiring is missing |
| Markdown/SVG audit hook | `korean-docs` | Audits Korean prose and diagram labels as they are written |
| Parity-walk hook | `board-parity-walk` | Holds the parity list and handover file to their shape at write time |
| Walk gate | `board-parity-walk` | Refuses to end a session that walked frames off the list without delegating to a subagent |
| SVG lint hook | `svg-diagrams` | Lints every SVG at write time for unresolved markers, overflow, and clipped content |
| Board contract hook | `wireframe-boards` | Checks a board's output contract — reading contract, offline rendering, labels, pairing, one accent |

The `*-init` commands exist because these skills depend on wiring the user has no reason to know about. Each skill checks for it on load and offers the command; none writes anything without agreement.

### `simplix` — the SimpliX development stack

Handbooks for repositories built on SimpliX. Each skill states its own applicability marker and stays silent elsewhere: `backend` applies to Spring Boot repositories extending the SimpliX base classes, `frontend` and `frontend-e2e` to repositories with a `simplix.config.ts` and `@simplix-react/*` dependencies.

| Skill | Description |
| ----- | ----------- |
| `simplix:backend` | Spring Boot backend handbook — 19 non-negotiable invariants (response envelope, `@PreAuthorize`, exception and message-key policy, DTO roles, date/time semantic typing), entity design, the YAML-driven `yo simplix` generator workflow, and DTO / security review. |
| `simplix:frontend` | simplix-react frontend handbook — 59 non-negotiable invariants, OpenAPI-driven scaffolding, `CrudList` / `CrudForm` / `CrudDetail` customization, filter and column design, a commonization registry, and documentation standards. Ships the convention audit and screen-inventory scripts. |
| `simplix:frontend-e2e` | Browser-driven usability, lifecycle, and cross-screen consistency audit. Drives the running app as each persona, judges through four lenses anchored to the `simplix:frontend` invariants, and runs five mandatory censuses over every screen in scope. |

It also registers the `/simplix:init` command, one agent, and three hooks, all documented below:

| Component | What it does |
| --- | --- |
| `/simplix:init` | Writes the routing block into the instruction file and arms the gates |
| `simplix:screen-auditor` agent | Audits one screen cluster in a browser and returns conclusions only |
| SessionStart hook | Detects the stack, names the binding skills, and reports which wiring is missing |
| Skill gate | Refuses a source edit until the subproject's handbook has been invoked |
| Completion gate | Refuses to end a session that changed screens without driving them in a browser and running the convention audit |

Both gates are inactive until the project declares them, and each skill checks for that on load and offers `/simplix:init` when a piece is missing.

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

## simplecore: Detection, Commands and Hooks

### Skill detection

The plugin recognizes what a project needs from its markers rather than from configuration you maintain:

| Skill | Markers |
| --- | --- |
| `wireframe-boards` | a directory holding the build kit's `build.mjs` beside `src/manifest.mjs`, or an HTML file whose head carries the board class vocabulary |
| `board-parity-walk` | a `.claude/board-parity-walk.json` **and** a board — the walk reconciles code against frames, so it never binds without one |
| `korean-docs` | a project glossary, or Hangul in the README / instruction file |

The board scan reads directory entries three levels deep, skips dependency and build output directories, and opens only the head of a bounded number of HTML files, so finding a board never costs a full-tree read.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs"           # human-readable
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json    # machine-readable
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --root=../other-repo
```

Exit code 0 means at least one skill binds, 1 means none.

### SessionStart hook

At session start the plugin runs the detector. When it matches, Claude receives a note naming each skill that binds, where the project's own contents live, and — from the detector's `missing` list — every piece of wiring that is absent, in the terms to say them in. A directory matching no marker produces no output at all, and a detector failure is silent.

### `/simplecore:init` command

Writes the routing into an instruction file, so the skills bind in sessions where the plugin is not installed and for anyone else working in the repository. It also proposes the two global instructions a project cannot supply for itself — the Korean style baseline that ordinary answers need, and the authority to start and stop a local development server without asking each time.

```text
/simplecore:init              # project block into the repository's instruction file
/simplecore:init --global     # only the global blocks, into ~/.claude/CLAUDE.md
```

Both blocks live in [`plugins/simplecore/templates/claude-md-section.md`](plugins/simplecore/templates/claude-md-section.md) — copy them by hand if you would rather not run the command. Deeper setup stays with `/simplecore:board-init` and `/simplecore:parity-walk-init`.

### Write-time hooks on the artifacts

Three hooks check an artifact the moment it is written, because each defect they catch is invisible in the source and survives a careful read of the diff:

| Hook | Fires on | Catches |
| --- | --- | --- |
| SVG lint | any `.svg` written or edited | unresolved markers, oblique arrows, text overflow, clipped content — the same scan `audit.py lint` runs |
| Board contract | an HTML file carrying the board class vocabulary | a missing reading contract, an external resource, a second script, unlabelled frames, an unpaired `.narrow`, a second accent colour |
| Walk gate | a session that removed frames from the parity list | that the walking never went to a subagent |

The first two are on by default; a project turns one off in `.claude/simplecore.json`:

```json
{ "svgLint": false, "boardCheck": false, "walkGate": false }
```

Only an explicit `false` disables a check, so a typo never silently turns one off. The SVG lint skips silently without python3, and reports `[review]` findings that need judgment separately from `[error]` findings that fail the write.

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

### Board-parity walk hook

A board-parity walk runs over many sessions, and two of its rules are the kind an agent talks itself out of at hour six: a walked frame is *deleted* from the parity list rather than marked, and the handover file holds facts rather than one walker's impressions. The `simplecore` plugin registers a `PostToolUse` hook that checks both at write time, plus a third — that the parked-decisions section still exists, since it is what the next session reads first.

Scope guard: nothing runs until a project opts in with `.claude/board-parity-walk.json`, discovered by walking up from the edited file to the git boundary.

```json
{
  "parityList": "_plans/SCREEN-PARITY.md",
  "handoverFile": "_plans/WALK-NOTES.md",
  "parkedSection": "Parked decisions"
}
```

Completion is matched as list *structure* — a checked box, a struck-through item, a tick where the bullet goes — never as vocabulary, because "done" and its translations are ordinary state names on a wireframe frame. Narrative phrases quoted inside quotation marks are skipped, so the handover file can state its own rule.

The skill proposes this wiring, and the two document templates beside it, when a project has none.

## simplix: Detection, Command and Hooks

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

### Skill-gate hook

The handbooks encode conventions that diverge from the stock framework, so an edit written from memory produces defects a reviewer then has to catch. The instruction file already says "invoke the skill first"; this hook makes it hold when that instruction is skimmed. It denies a write to a source file until one of the gated skills has been invoked in the session.

Scope guard: nothing is gated until a project declares it in `.claude/simplix.json`, discovered by walking up from the edited file. Directory layout is the project's to state, never the hook's to assume.

```json
{
  "audit": { "publicRouteDirs": ["checkout"] },
  "skillGate": {
    "skills": ["simplix:frontend", "simplix:frontend-e2e"],
    "sourceDirs": ["modules/", "apps/", "packages/"]
  }
}
```

In a monorepo each subproject carries its own file, so a frontend edit asks for the frontend handbook and a backend edit for the backend one. `SIMPLIX_SKILL_GATE=off` lifts the gate for a mechanical migration driven by a script rather than by hand-editing.

### Completion gate

The skill gate guards the moment of editing. This one guards the moment of claiming done, because that is where verification is actually skipped: the build is green, the diff reads correctly, and nobody opened the page or ran the audit. A `Stop` hook refuses to end a session that changed UI files without `simplix:frontend-e2e` having been invoked, or without the convention audit script having run — naming both omissions in one message so a session is interrupted once rather than twice.

It fires **at most once per session**. The gate exists to make an omission visible, not to trap a session that has a good reason — a refactor with no reachable screen, a user who asked for code only. Claude answers the objection and stops again. `SIMPLIX_E2E_GATE=off` lifts it entirely.

Declared beside the skill gate, and inactive without it:

```json
{
  "e2eGate": {
    "skill": "simplix:frontend-e2e",
    "uiDirs": ["modules/", "apps/"]
  }
}
```

`uiExtensions` defaults to `[".tsx"]`; a backend subproject declares no `e2eGate` at all, since it serves no screens.

`/simplix:init` writes both gates, and the detector reports which are armed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs"          # per subproject: gate armed / OFF
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json   # `wired` is true when nothing is missing
```

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

`audit-frontend.mjs` exits 1 when an error-level rule has hits; review-level rules print candidates that need human judgment and never fail the run. It reads the `audit` section of `.claude/simplix.json` for the handful of policies that are a property of the product rather than of the framework — which route directories are open to anybody, for one — so nothing about a particular repository's layout is baked into the script.

### Backend script

The `backend` skill ships one, run the same way — from the backend project root, or with `--root=<dir>`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs"            # machine-checkable invariants
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --selftest # prove every rule both ways
```

It carries the mechanically visible subset of the handbook's invariants — `@PreAuthorize` and `@Operation` on every endpoint, permission group and action shape, the SearchDTO primary-key contract, scope forcing on both `search` overloads, the date/time and timezone rules, DTO and repository shape. Exit 1 on any error-level hit.

**No rule counts as added until `--selftest` proves it fires on the broken form and stays silent on the fixed one**, so every rule carries both samples and the selftest fails on a rule that omits either. A genuine exception is marked at the line with `// simplix-audit-ignore[<rule-id>]: <reason>`; the reason is required, and each run reports how many lines were suppressed. Nothing about a particular repository — no path, class name or exception list — is baked into the script.

## Repository Layout

```text
simplecore-skills/
├── .claude-plugin/
│   └── marketplace.json                  # Marketplace manifest
├── plugins/
│   ├── simplecore/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── agents/                       # board-walker.md
│   │   ├── commands/                     # init.md + glossary-audit.md + board-init.md + parity-walk-init.md
│   │   ├── hooks/                        # hooks.json + session-start.mjs + check-md-glossary.mjs
│   │   │                                 #   + check-parity-walk.mjs + check-svg-render.mjs
│   │   │                                 #   + check-board.mjs + walk-gate.mjs + shared config/marker modules
│   │   ├── scripts/                      # detect-simplecore.mjs
│   │   ├── templates/                    # claude-md-section.md
│   │   └── skills/
│   │       ├── board-parity-walk/        # SKILL.md + assets/ (two document templates + config)
│   │       ├── korean-docs/              # SKILL.md + references/ + scripts/ + templates/
│   │       ├── svg-diagrams/             # SKILL.md + references/ + scripts/
│   │       └── wireframe-boards/         # SKILL.md + references/ + assets/ (board-template.html + build-kit/)
│   └── simplix/
│       ├── .claude-plugin/plugin.json
│       ├── agents/                       # screen-auditor.md
│       ├── commands/init.md
│       ├── hooks/                        # hooks.json + session-start.mjs + skill-gate.mjs + e2e-gate.mjs
│       │                                 #   + shared config/marker modules
│       ├── scripts/                      # detect-simplix.mjs + audit-frontend.mjs + audit-backend.mjs
│       │                                 #   + audit-rendered.mjs + screen-inventory.mjs
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

Components in the default locations (`skills/`, `commands/`, `hooks/`, `agents/`) are discovered automatically. Every skill registers as `<plugin>:<skill-name>` and every agent as `<plugin>:<agent-name>`, and paths inside a plugin resolve through `${CLAUDE_PLUGIN_ROOT}`.

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
