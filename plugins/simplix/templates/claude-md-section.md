# Routing blocks for `simplix` skills

Two blocks. The **project block** names this repository's subprojects and belongs in the
project's own instruction file. The **global block** is path-free and belongs in
`~/.claude/CLAUDE.md`, where it covers every SimpliX project on the machine.

Writing either one is what makes the routing durable — the plugin's SessionStart hook
announces the same thing, but a hook only fires where the plugin is installed, while an
instruction file travels with the repository.

---

## Project block

Insert into the project's `.claude/CLAUDE.md` (or `CLAUDE.md` when the project keeps its
instructions at the root). Replace the table rows with what the detector reported; delete
the row for a subproject the repository does not have.

```markdown
## SimpliX skill routing (MANDATORY)

This repository is built on the SimpliX stack. Each subproject below has a handbook skill
that is a **first-touch gate** — invoke it with the Skill tool before the first read,
write, review, or explanation of a file in that subproject, and never work from memory of
what it contains. Once invoked in a session it does not need re-invoking.

| Path | Stack | Skill |
| --- | --- | --- |
| `<backend-dir>/` | Java, Spring Boot on SimpliX | `simplix:backend` |
| `<frontend-dir>/` | React on simplix-react | `simplix:frontend` |

Rules that follow from the gate:

- **Invoke before the edit, not after.** An edit made before the routed reference is read
  is a violation, not a head start.
- **Cross-subproject work loads both.** A change that spans the API contract invokes both
  skills in the same session and is implemented end to end — backend first, then the
  frontend codegen, then the UI.
- **List screens are a fixed full-stack recipe.** Backend paged searchable endpoint first,
  then the CLI-generated list. Details live in the skills.
- **Before a frontend feature is called complete**, drive its screens in a browser under
  `simplix:frontend-e2e`. A feature whose screens have never been walked by hand is
  unverified no matter how green the build is.

Install: `claude plugin install simplix@simplecore-skills`. Without the plugin these
skills are unavailable — say so rather than approximating them.
```

---

## Global block

Insert into `~/.claude/CLAUDE.md`, under the chapter that covers skill usage. It names no
paths, so it applies to every SimpliX repository on the machine.

```markdown
### SimpliX projects

When a repository is built on the SimpliX stack, its handbook skill is a first-touch gate —
invoke it with the Skill tool before reading, writing, reviewing, or explaining any file it
covers, and follow it rather than memory.

- **`simplix:backend`** — a Spring Boot repository whose classes extend
  `SimpliXBaseController` / `SimpliXBaseService` / `SimpliXBaseRepository`, whose endpoints
  return `SimpliXApiResponse`, or that carries a `.simplix/` generator directory.
- **`simplix:frontend`** — a React repository with a `simplix.config.ts` or
  `@simplix-react/*` dependencies.
- **`simplix:frontend-e2e`** — before declaring any frontend feature complete, and whenever
  a task asks to walk a feature as a user, check screens against each other, or find what is
  confusing, missing, or unusable.

In a monorepo the marker sits in the subproject, so the gate applies per subproject and a
cross-subproject task invokes both skills. Neither skill applies to the simplix-react
framework repository itself — that one is the framework, not a project using it.
```
