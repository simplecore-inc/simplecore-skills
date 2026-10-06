---
description: Detect the SimpliX subprojects here, write the skill routing, and arm the gates
argument-hint: "[--project | --global] [path]"
---

# SimpliX Init

Wire this repository for the SimpliX handbooks. Two halves, and a project needs both:

- **the routing block** in an instruction file, which tells Claude the skills are a first-touch
  gate. It travels with the repository and works without the plugin.
- **the gate config** in each subproject, which tells the plugin's hooks to hold Claude to that.
  It only works where the plugin is installed, and it is what catches a skimmed instruction.

Write the routing when it is missing, arm the gates when they are off, and say plainly which of
the two you did.

1. Run the detector and read its report:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json
   ```

   Pass `--root=<path>` when `$ARGUMENTS` names a directory other than the current one.

2. Report what it found in one short paragraph: the matched subprojects with their paths
   and markers, which skills therefore apply, and - from `routedBy` and each match's
   `skillGate` / `e2eGate` - which of the two halves is already in place. A gate reads as
   armed only when every key its hook needs is present; `skillGateMissing` /
   `e2eGateMissing` name the keys a declared gate lacks, and such a gate refuses nothing.
   `routedBy` may name a file above the scanned directory, up to the repository root.

   - `frameworkRepo: true` → this IS a framework repository, not a project using it:
     `framework` names which (`simplix`, the Spring framework whose own Gradle group is
     `dev.simplecore.simplix`, or `simplix-react`, which publishes under `@simplix-react/`).
     Say so and stop; the consumer handbooks do not apply here.
   - No matches → say so and stop. Do not write a routing block into a repository that
     has no SimpliX marker; offer instead to re-run against a subdirectory.
   - `routedBy` already set → the routing exists in that file. Read it, report whether it
     still matches what the detector found, and offer to update only the parts that drifted.
   - `wired: true` → both halves are in place. Say so and stop; there is nothing to write.

3. Read the block templates:

   ```
   ${CLAUDE_PLUGIN_ROOT}/templates/claude-md-section.md
   ```

4. Ask the user where to write it, unless `$ARGUMENTS` already decided:

   - **`--project`** (default) - the project block, into `.claude/CLAUDE.md`, or into the
     repository's existing instruction file when it keeps one elsewhere (`CLAUDE.md`,
     `AGENTS.md`). Fill the table with the detected paths and delete rows for stacks the
     repository does not have.
   - **`--global`** - the path-free block, into `~/.claude/CLAUDE.md`, under whatever
     chapter covers skill usage.

   In a monorepo, the project block goes in the repository root's instruction file - one
   table listing every subproject - not one block per subproject.

5. Show the exact text you intend to insert and where, then write it only after the user
   agrees. Merge rather than overwrite: when the target file already has a SimpliX
   section, update that section in place; when it has none, append the block, matching the
   file's existing heading level and tone.

6. **Arm the gates.** For every matched subproject whose `skillGate` (or, for a frontend, whose
   `e2eGate`) is false, write `<subproject>/.claude/simplix.json`. Merge into an existing file
   rather than replacing it - the `audit` section, if present, belongs to the convention audit
   script and must survive.

   ```json
   {
     "skillGate": {
       "skills": ["simplix:frontend", "simplix:frontend-e2e"],
       "sourceDirs": ["modules/", "apps/", "packages/"]
     },
     "e2eGate": {
       "skill": "simplix:frontend-e2e",
       "uiDirs": ["modules/", "apps/"]
     }
   }
   ```

   - `skills` are the skills whose invocation opens the edit gate: the subproject's handbook,
     plus `simplix:frontend-e2e` for a frontend since a browser audit reads and fixes the same
     files. A backend gets `["simplix:backend"]` and no `e2eGate` - it serves no screens.
   - `sourceDirs` and `uiDirs` are project-relative prefixes. **Read them off the repository** -
     the source roots the detector's markers point at, the Gradle `settings.gradle` includes,
     the pnpm workspace globs. Never copy the example: a layout this plugin assumed rather than
     observed gates the wrong files, or nothing at all.
   - Show the file and get agreement before writing, the same as the routing block.

   Say what each gate does in one clause, because the user has no reason to know: the skill gate
   refuses an edit (Write, Edit, MultiEdit) under those directories until the handbook is loaded;
   the e2e gate stops a session that changed screens once, at its end, when none of them was
   opened in a browser or the convention audit never ran. Both have escape hatches
   (`SIMPLIX_SKILL_GATE=off`, `SIMPLIX_E2E_GATE=off`) for scripted migrations.

7. Verify what you wrote, and report the result:

   - **`--project`**: re-run the detector. `routedBy` must name the file you wrote and `wired`
     must be true.
   - **`--global`**: read the inserted section back from `~/.claude/CLAUDE.md`. The detector
     reads only the repository's own instruction files, so `routedBy` stays empty for a global
     block; that is expected, and it is no reason to write a project block the user did not ask
     for.

   Tell the user the routing applies immediately to anyone reading the instruction file, and the
   gates apply from the next edit in this session: both hooks read `.claude/simplix.json` on every
   tool call. So invoke the subproject's handbook skill before the next source edit here.

Do not commit. Report; the user commits.
