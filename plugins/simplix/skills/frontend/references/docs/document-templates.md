# Document Templates

## Table of Contents

- [Root README.md](#root-readmemd)
- [Package README.md](#package-readmemd)
- [Tutorial](#tutorial)
- [How-to Guide](#how-to-guide)
- [Reference (Function)](#reference-function)
- [Reference (Hook)](#reference-hook)
- [Explanation](#explanation)
- [CONTRIBUTING.md](#contributingmd)
- [CHANGELOG.md](#changelogmd)

---

## Root README.md

> Applicability: this template documents a published multi-package library (the npm-version badge and the `## Packages` table below). Use those sections only **when the project publishes packages**. For a single private application that ships no packages, drop the npm-version badge and the `## Packages` section and keep the rest.

### Required Sections (fixed order)

```markdown
# <project>

[One-line description - deliver core value proposition]

[Badges: npm version (only when the project publishes packages), license, TypeScript, build status]

## What is <project>?

[2-3 sentences: what it does, who it's for, core value proposition]

## Key Features

[5 or fewer bullet points — focus on differentiators]

## Packages

[Package table — name, description, version]

## Quick Start

[End-to-end example under 30 lines — must be copy-paste-runnable]

## Documentation

[Doc links — Getting Started, Guides, API Reference]

## Contributing

[Link to CONTRIBUTING.md]

## License

[License info]
```

### Quick Start Rules

- Include ALL imports (no omissions)
- Actually runnable code
- Use consistent domain data (project/task)
- Under 30 lines
- Show full contract → hooks → component pipeline

### Do NOT include in README

- Detailed API Reference (split to package docs)
- Full list of config options
- Advanced usage
- Internal implementation details

---

## Package README.md

> Applies **when the project publishes packages** - author a README per package that is published or public. A project that ships a single application (no published packages) does not need per-package READMEs; this template is the standard to follow once a package becomes public.

### Required Sections (fixed order)

```markdown
# <package-name>

[One-line description]

## Installation

[Install command + explicit peer dependencies]

## Quick Example

[Minimal example working standalone with this package]

## API Overview

[Public API summary — function signatures + one-line descriptions]

## Key Concepts

[2-3 core concepts briefly explained]

## Guides

[Links to detailed guides]

## Related Packages

[Related packages table]
```

### Package-Specific Emphasis - only when documenting simplix-react itself

The framework repository's own packages each lead with a different concept. A consumer project's packages take the template above without this table.

| Package | Emphasize |
| --- | --- |
| `contract` | Zod schema → type inference flow, EntityDefinition/OperationDefinition structure |
| `react` | Hook patterns (useList, useGet, etc.), TanStack Query options passthrough |
| `mock` | Auto-generated MSW handlers, PGlite migration/seed patterns |
| `i18n` | Adapter pattern, createI18nConfig setup, React Provider/Hook usage |
| `cli` | Per-command usage, project structure, validator rules |

---

## Tutorial

```markdown
# [Title — start with verb]

> After completing this tutorial, you will have [concrete result].

## Prerequisites

- [Required prior knowledge/installations]

## Step 1: [Verb-first step name]

[Explanation]

[Code block — copy-paste-runnable]

[Expected result — screenshot or output]

## Step 2: ...

## Summary

[Recap of what was completed + next learning paths]
```

**Rules:**

- Each step has a verifiable intermediate result
- Do NOT explain "why" (that's Explanation's role)
- Label optional steps with "(optional)"
- 5-10 steps maximum

---

## How-to Guide

```markdown
# [Problem-focused title]

> [1 sentence — the problem this guide solves]

## Before You Begin

- [Required prerequisites]

## Solution

[Code + minimal explanation]

## Variations

### [Variation 1 — different conditions]

### [Variation 2 — advanced options]

## Related

- [Related guide links]
```

**Rules:**

- Minimize background - reader already has context
- Code is primary, prose is secondary
- Do NOT include "why it works this way" (Explanation's role)

---

## Reference (Function)

```markdown
## `functionName(param1, param2)`

[One-sentence description]

### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `param1` | `Type1` | Yes | Description |
| `param2` | `Type2` | No | Description (default: `default`) |

### Returns

`ReturnType` — [description]

### Example

[Minimal example]

### See Also

- [Related API links]
```

---

## Reference (Hook)

For `@simplix-react/react` hooks:

```markdown
## `hooks.{entity}.useList(...)`

React Query hook that queries the entity list. Three calling conventions: `useList(options?)` for a top-level entity, `useList(params, options?)` for a filtered/sorted list, and `useList(parentId, params?, options?)` for a child entity.

### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `parentId` | `string` | Only for child entities | Parent entity ID — pass only in the child-entity convention; omit entirely for a top-level entity |
| `params` | `ListParams` | No | Filters/sort/pagination passed to the list query |
| `options` | `Omit<UseQueryOptions, "queryKey" \| "queryFn">` | No | React Query options passthrough |

### Returns

`UseQueryResult<z.infer<TSchema>[]>` — TanStack Query query result object

### Automatic Behaviors

- query key: `[domain, entityName, "list", params]` (the child-entity convention additionally includes `parentId` in the key)
- Auto-invalidates on `useCreate` / `useUpdate` / `useDelete` mutation success

### Example

[Code example]
```

**Rules:**

- List ALL parameters, return values, and types
- Specify defaults
- Separate automatic behaviors (auto-invalidation, etc.) into their own section
- Minimize prose - tables and code are primary

---

## Explanation

```markdown
# [Concept name]

## Overview

[2-3 paragraphs: what this concept is and why it exists]

## How It Works

[Diagrams + flow description]

## Design Decisions

[Why designed this way — compare with alternatives]

## Implications

[Impact on users from this design]
```

**Rules:**

- Diagrams and prose are primary, not code
- Focus on "why it's done this way", not "what it does"
- Executable code not required (nice to have, not essential)

---

## CONTRIBUTING.md

```markdown
# Contributing to <project>

## Development Setup

### Prerequisites

- [The Node.js and pnpm versions the repository declares - `engines` / `packageManager` in its package.json]

### Getting Started

$ git clone ...
$ cd <project>
$ pnpm install
$ pnpm build

### Development Workflow

$ pnpm dev          # Watch mode for all packages
$ pnpm typecheck    # Type checking
$ pnpm lint         # Linting
$ pnpm test         # Tests

## Monorepo Structure

[packages/ directory tree]

## Making Changes

### Working on a single package
### Cross-package changes

## Code Style

[Link to the project's code style guide]

## Pull Request Process

1. Create feature branch
2. Changes + tests
3. Pass pnpm typecheck && pnpm lint && pnpm build
4. Submit PR (include change description)

## Versioning

[Changesets usage]
```

---

## CHANGELOG.md

Follow [Keep a Changelog](https://keepachangelog.com) format:

```markdown
# Changelog

## [Unreleased]

### Added
- New features

### Changed
- Changes to existing features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security-related changes
```

**Rules:**

- Use a `Deprecated` category only where the project deprecates before removing. simplix-react itself never does - its rule is to delete deprecated code immediately - so its own changelog has none
- Maintain a per-package CHANGELOG.md **when the project publishes packages** (each independently versioned package gets its own). A single private application keeps one root CHANGELOG.
