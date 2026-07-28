---
description: Detect the SimpliX subprojects here and write the skill routing into the instruction file
argument-hint: "[--project | --global] [path]"
---

# SimpliX Init

Detect which SimpliX subprojects this repository holds and write the skill routing block
into an instruction file, so the gate survives without depending on the plugin's
SessionStart hook firing.

1. Run the detector and read its report:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json
   ```

   Pass `--root=<path>` when `$ARGUMENTS` names a directory other than the current one.

2. Report what it found in one short paragraph: the matched subprojects with their paths
   and markers, and which skills therefore apply.

   - `frameworkRepo: true` → this IS simplix-react, not a project using it. Say so and
     stop; the consumer handbooks do not apply here.
   - No matches → say so and stop. Do not write a routing block into a repository that
     has no SimpliX marker; offer instead to re-run against a subdirectory.
   - `routedBy` already set → the routing exists in that file. Read it, report whether it
     still matches what the detector found, and offer to update only the parts that drifted.

3. Read the block templates:

   ```
   ${CLAUDE_PLUGIN_ROOT}/templates/claude-md-section.md
   ```

4. Ask the user where to write it, unless `$ARGUMENTS` already decided:

   - **`--project`** (default) — the project block, into `.claude/CLAUDE.md`, or into the
     repository's existing instruction file when it keeps one elsewhere (`CLAUDE.md`,
     `AGENTS.md`). Fill the table with the detected paths and delete rows for stacks the
     repository does not have.
   - **`--global`** — the path-free block, into `~/.claude/CLAUDE.md`, under whatever
     chapter covers skill usage.

   In a monorepo, the project block goes in the repository root's instruction file — one
   table listing every subproject — not one block per subproject.

5. Show the exact text you intend to insert and where, then write it only after the user
   agrees. Merge rather than overwrite: when the target file already has a SimpliX
   section, update that section in place; when it has none, append the block, matching the
   file's existing heading level and tone.

6. Verify by re-running the detector — `routedBy` must now name the file you wrote — and
   report the result. Tell the user the routing takes effect for new sessions.

Do not commit. Report; the user commits.
