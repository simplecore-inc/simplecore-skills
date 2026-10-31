# Routing blocks for `simplecore` skills

The **project block** names this repository's glossary and belongs in the project's own instruction file. The **global Korean block** and the
**global local-server block** are path-free and belong in `~/.claude/CLAUDE.md`, where they cover
every project on the machine.

Writing them is what makes the routing durable. The plugin's SessionStart hook announces the same
thing, but a hook only fires where the plugin is installed, while an instruction file travels with
the repository - and a global block covers the sessions that never touch a marked project at all.

`/simplecore:init` writes them.

---

## Project block

Insert into the project's `CLAUDE.md` (or `.claude/CLAUDE.md`, or `AGENTS.md` when the project
keeps its instructions there). Delete the sections the repository does not have, keep the closing
install line whichever sections stay, and replace every path with what the detector reported.

```markdown
## Korean output

This project's documents are Korean. Invoke `simplecore:korean-docs` when writing, translating,
proofreading, reviewing, or auditing a Korean document, screen copy, or glossary entry; ordinary
replies follow the Korean habits block in the global instructions and do not invoke it. Follow
`<glossary path>` for standard translations and banned spellings. A term decided during a task
is registered in the glossary in the same task.

Skills come from the `simplecore` plugin (`claude plugin install simplecore@simplecore-skills`).
When one is not in the `Skill` tool list, install it rather than working from memory.
```

---

## Global Korean block

Insert into `~/.claude/CLAUDE.md`, under the chapter that covers skill usage or output language.
It names no paths, so it applies to every project on the machine.

```markdown
### Korean output

Ordinary replies follow the Korean habits block below and do not invoke a skill. Invoke
`simplecore:korean-docs` when writing, translating, proofreading, reviewing, or auditing a Korean
document, screen copy, or glossary entry. Where a project keeps its own glossary
(`.claude/GLOSSARY.md` or `GLOSSARY.md`), that glossary wins over the baseline.

<!-- Paste skills/korean-docs/references/global-korean-card.md here, whole. -->
```

---

## Global local-server block

Insert into `~/.claude/CLAUDE.md`. Screen verification needs a running application, and a session
that has to ask before every restart cannot walk a whole feature area - so the authority is stated
once, globally, with its boundary drawn at the local machine.

```markdown
### Local development servers

For a development server on the local machine (`localhost`, `127.0.0.1`, `[::1]`, or the
development machine's private IP), start, restart, and stop it directly as the work needs. Do not
stop to ask each time.

- **Take the commands from the project**, never from memory: its package scripts, Gradle tasks,
  compose file, or the dev-server section of its own instruction files.
- **Read the port from the server's own output or a readiness probe.** A dev server whose usual
  port is taken moves silently to another one, and a hardcoded port then verifies the wrong thing.
- **Restart rather than reason about staleness.** A screen served from a stale build looks exactly
  like a missing translation or a vanished column; when output disagrees with the source, rebuild
  or restart before writing anything down as a defect.
- **Reclaim a port you own.** When the port is held by a development server from an earlier
  session of this same project, stop that process and start a fresh one. Never kill a process you
  cannot identify as this project's development server.
- **Leave the environment as you found it.** Stop the servers this session started once the work
  no longer needs them, and say which are still running and why when you leave one up.
- **Out of scope**: remote hosts of any kind - production, staging, shared development -
  container orchestrators outside the local machine, and anything serving other people. Ask first.
```
