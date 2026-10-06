> **AUDIT** category reference inside this skill. Loaded via the Task Router after any CUSTOMIZE work touches existing modules (MANDATORY - parent skill invariants 22–23). Sibling files: `registry.md`, `audit-checklist.md`.

# Commonization Audit (AUDIT overview)

Tracks and enforces UI / code commonization across the project. Ensures that shared patterns extracted into shared packages - framework-generic ones in `@simplix-react/ui`, project-/domain-specific ones in the project's own shared UI package - are consistently applied across all modules, and prevents regression to custom inline implementations.

## Purpose

- Maintain a registry of commonized patterns (components extracted from inline code into shared framework)
- Provide audit checklists so any agent can verify compliance across all modules
- Prevent duplicate custom implementations when a shared component already exists
- Track where each shared component is used and where it should be used

## Workflow

### When a New Pattern is Commonized

1. Register it in the index-plus-detail shape described in `registry.md` § Adding a new pattern - in the project's own reference when the pattern is the project's, contributed upstream to this skill when it holds for any simplix-react project
2. Give it audit criteria with grep patterns that detect violations, alongside the recipes in `audit-checklist.md`

### When Adding New Modules or Pages

1. Check `registry.md` for existing shared components
2. Use shared components instead of writing custom inline implementations
3. If a new pattern emerges that repeats 2+ times, propose extraction

### When Running an Audit

1. Read `audit-checklist.md`
2. Run the grep patterns against the codebase to find violations
3. Report findings with file paths and line numbers
4. Propose replacements using the registered shared component

## Rules

- NEVER write custom inline empty states, status cards, or other registered patterns when a shared component exists
- ALWAYS check this skill's registry before implementing UI patterns that display empty/error/loading states
- When a shared component's API changes, update all entries in the registry and re-audit affected files
- Shared components live in a shared package and are imported from there - framework-generic patterns in `@simplix-react/ui`, project-/domain-specific shared UI in the project's own shared UI package (e.g. `@<scope>/<ui-package>`) - never re-inlined in `modules/` or `apps/` (parent skill invariant #23)

## Two audit scripts, and only one of them can see a painted page

`${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs` reads source and runs with nothing
started. `${CLAUDE_PLUGIN_ROOT}/scripts/audit-rendered.mjs` asks about boxes and rows on a
live page, and **the defects it catches are invisible to the source audit** - the component
is imported, the props typecheck, the request answers 200, and the screen is unusable. What
it checks is whatever `--list` prints; run every id there, never a subset named in prose.

How to run it - including why a product that needs signing in takes the `--print` snippet into
the already-signed-in session rather than `--url` - is owned by the `simplix:frontend-e2e`
skill's `references/browser-driving.md` § The checks that need the browser, and the script that
carries them. **Read `compared` as well as `findings`** - zero findings out of zero comparisons
is a check that reached nothing, and it prints the same exit status as a clean screen.

## Registered Patterns

See [registry.md](registry.md) - the index of all commonized components; full contracts live in the `registry/` detail files it points to. Scan the index first, then Read only the matching detail file.

See [audit-checklist.md](audit-checklist.md) for automated audit patterns.
