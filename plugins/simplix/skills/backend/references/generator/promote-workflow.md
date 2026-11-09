# Promote Workflow Reference

Move generated CRUD code from `generated/` to `src/` after verification.

> **Scope (canonical):** `yo simplix:promote` command, the tracked-render rules (fingerprint, stored base, three-way merge, conflicts), file-mapping table (service/controller/DTO/test destinations), verification steps. Runs after `yo simplix:generate`. For template issues encountered during generation, see **troubleshooting.md**; for template editing see **template-customization.md**; for `yo simplix:generated`, `version` and `init` see **commands.md**.

## Required Arguments

**MANDATORY**: The promote command requires the entity name. If missing, use AskUserQuestion to prompt.

| Argument | Required | Description |
|----------|----------|-------------|
| EntityName | **YES** | The name of the entity to promote |
| `--module` | **YES** | The yml's `promoteModule` (e.g. `admin/billing`); promote refuses to run without it |
| `--adopt` | no | Record the current render as the base of existing files that have none (§ Usage) |
| `--force` | no | Overwrite the promoted files, edits and removals included (§ Usage) |
| `--skip-version-check` | no | Promote although the project requires a newer generator (`commands.md` § `yo simplix:version`) |

## Why Promote?

- Generated code starts in `generated/` for isolation during development
- Promoting to `src/` integrates the code into the main codebase
- Allows regeneration without affecting production code

## What Promote Does

1. Stamps each rendered file in `generated/` with the marker and the render fingerprint, and writes it to the module's `src/` directory by the tracked-render rule (§ Usage), creating destination directories as needed
2. Stores the stamped render under `.simplix/bases/` as the merge base for the next promote
3. **Deletes the original from `generated/`** once the file is written, merged or left as it was (prevents duplicate class errors in a project that compiles `generated/`). A file whose outcome is `conflict` or `no-base` keeps its render in `generated/`, so the promote can run again after the fix
4. Prints one outcome per file and a count per outcome, and exits non-zero on `conflict` or `no-base`

A file whose render is missing from `generated/` is skipped with a warning to run `yo simplix:generate <Entity>` first.

## File Mapping

| Type | From (generated/) | To (src/) |
|------|-------------------|-----------|
| Service | `generated/main/java/.../service/` | `src/main/java/.../service/` |
| Controller | `generated/main/java/.../controller/` | `src/main/java/.../controller/` |
| DTOs | `generated/main/java/.../dto/` | `src/main/java/.../dto/` |
| TreeService (tree entities) | `generated/main/java/.../service/` | `src/main/java/.../service/` |
| Service Test | `generated/test/java/.../service/` | `src/test/java/.../service/` |

The repository is not in the mapping: the generator does not write it (`template-customization.md` § Template Files).

## Usage

```bash
# Promote as a tracked render: write absent or untouched files, merge into edited ones
yo simplix:promote EntityName --module <promoteModule>

# Report every promoted file; non-zero on stale, conflict and no-base
yo simplix:generated
```

Every promoted file opens with `// @simplix-generated` and `// @simplix-render <fingerprint> promote
<Entity> --module <module>`, and promote stores the render under `.simplix/bases/` (committed). A
later generate then promote reports one outcome per file:

| Outcome | The file was | What promote did |
|---|---|---|
| `written` | absent, or untouched (still exactly the render it was laid down as) | wrote the fresh render and stored it as the base |
| `merged` | edited, and the template change merges cleanly | wrote the three-way merge (`git merge-file`: edits, stored base, fresh render) and stored the fresh render as the base |
| `current` | edited, and already carries the template change | left the file, stored the fresh render as the base |
| `removed` | deleted after it was laid down (a base is stored) | left it deleted |
| `adopted` | edited, with no base, under `--adopt` | stamped it, kept its edits, stored the fresh render as the base |
| `conflict` | edited, and the template change collides with the edits | kept the file untouched, wrote the merge with markers to `generated/conflicts/<path>.conflict`, exit 1 |
| `no-base` | edited, with no stored base | kept the file, exit 1 (run with `--adopt` or `--force`) |

A conflict is the expected outcome when the template and the customisation both append after the
last method of a class.

**Resolving a conflict.** Edit the promoted file itself, using the `.conflict` file to see both sides
of each hunk, then promote again. The next promote closes the conflict only when the resolved region
equals the template's side of the hunk (it then reports `current`). Any other resolution, such as a
combination of the template change and the customisation, merges the same two changes against the
same stored base and reports the same hunks again, because `promote` has no flag that records a
resolution (`--adopt` acts only on files that have no base, `--force` discards the edits). Record the
fresh render as the base with the generator's own helpers, run from the project root against the
`generated/` file `generate` just wrote:

```js
import fs from 'node:fs';
import { carryStamp, recordBase, stampRender } from '<simplix-generator>/generators/utils/tracked-render.js';
const stamped = stampRender(fs.readFileSync('<generated file>', 'utf8'), 'promote <Entity> --module <module>');
fs.writeFileSync('<promoted file>', carryStamp(fs.readFileSync('<promoted file>', 'utf8'), stamped));
recordBase(process.cwd(), '<promoted file>', stamped);
```

Then `yo simplix:promote` reports `current` for the file and `yo simplix:generated` counts it as
edited. Do this only after the template's new parts are in the file by hand; recording the base
over an unresolved file makes the template change look already merged.

`--force` writes the fresh render over the promoted file whatever it holds, edits and removals
included, and stores it as the base; it is never the regeneration path. `--adopt` acts only on files
that have no stored base: an existing file is stamped, keeps its edits and takes the current render
as its base (so its customisations read as edits against that render, and any template change that
landed between the original promote and the adopt reads as a customisation too); a missing file gets
its base recorded so later promotes leave it deleted. A file that already has a base goes through the
normal tracked promote. Adopt once per project, for files promoted before tracked renders existed.
The collision check below still comes first: a hand-authored `XService` with no stamp reads as
`no-base`, is kept, and fails promote.

**IMPORTANT**: Always use `yo simplix:promote` instead of manual file operations. The command ensures:
- Files are deleted from `generated/` once handled (no duplicate classes), except on `conflict` and `no-base`
- Proper directory structure is created
- Every file carries its fingerprint and a stored base, so the next template change reaches it

## Example: Promote CmsContentLink

```bash
# Generate CRUD files first
yo simplix:generate CmsContentLink --force

# Promote to src/
yo simplix:promote CmsContentLink --module <promoteModule>
```

It reports one `From` / `To` pair per artefact (service, controller, DTOs, service test; the tree
service and its test are added when the render produced them), its outcome, and a count per outcome.

**A changed yml needs `generate <Entity> --force` before the promote.** A `generate` without `--force`
skips a render that already sits in `generated/` (a `SKIP ... already exists` line), so the promote
writes the old render again and `yo simplix:generated` calls the file `stale`: a field added to the yml
is in no DTO. `--force` here overwrites only the `generated/` render, never a promoted file; the
promote then merges it three ways. Check that the new field is in the DTO before the Gradle run.

## Before generating: the module path names a group

In a grouped backend (`modules/<group>/<module>`), `modulePath` and `promoteModule` start with an
existing group. A first segment that is no group makes generate and promote create a new top-level
module beside the groups, and nothing else refuses it. `audit-backend.mjs` rule
`generator-module-outside-the-groups` fails it against the groups the project lists in
`.claude/simplix.json` `audit.moduleGroups`; with no list the rule is silent.
Example: `promoteModule: <module>` creates `modules/<module>`; `promoteModule: <group>/<module>` is the module.

## Before generating: the collision check (MANDATORY)

**`yo simplix:promote --force` OVERWRITES `src/` files silently** (§ Usage), and a promote without it keeps an unstamped file only by failing. Before generating an entity `X`,
verify no hand-authored `X{Service,RestController,DTOs}` already exists in the target
`modulePath` package. `yo simplix:generate X` + `promote` will clobber a same-named
hand-written `XService` - a lifecycle or action service, say - with a generated CRUD one and
delete its logic.

**The clash is by simple class name across the whole tree, not only in the target package.**
Spring names a bean after the class's simple name, so a generated `XService` beside any other
`XService` (a worker's queue service in another module, say) stops the context with a
conflicting bean definition. Grep `class XService\b` and `class XRestController\b` over every
source root before generating.

On a clash, either **rename the hand-authored class to a role-specific name**
(`XLifecycleService`, `XQueryService`) before generating, or **do not generate `X`** at all
because it is managed through its parent aggregate (see the child-entity patterns). After
every `promote`, re-compile and confirm no pre-existing service was overwritten.

**A controller's class name is part of the API contract.** SimpliX Meta and the OpenAPI document
derive every operation id from it (`AdminUserRoleRest_search`), and the frontend's generated hooks
are keyed on those ids. Renaming a live controller to the generator's `<Entity>RestController`
renames every id the frontend consumes. Keep the live name with the yml key `controllerName`
(`entity/yml-configuration.md`): `generate` writes and `promote` moves the file of that name. The
audit's `controller-name-not-from-yml` fails a controller whose name is not the one its yml names,
and `entity-without-generator-input` fails a `SimpliXBaseController` subclass whose entity has no
yml at all.

## Trimming a generated controller is manual, and verified after each cut

Never bulk-delete endpoint methods with a fragile script: a mis-parse silently eats the
constructor or leaves a dangling body. Remove one endpoint method at a time - Javadoc,
annotations and body as a unit - and compile after each.

For an append-only audit or history entity, trim the writes down to a read surface (keep `get`
+ `search`). The project's feature-gate annotation, if it has one, and a real `@Tag` description are
edits of the promoted file: the three-way merge keeps them across a regeneration, and a promote that
reports a `conflict` on those lines is resolved in the file (§ Usage).

## After generating: the promoted service test goes stale with the service

The promoted `*ServiceTest` references the generated CRUD DTOs and methods. If the service is
converted to non-CRUD, or generated DTOs are deleted, **delete or rewrite that test in the same
step** - a stale generated test fails for a reason that has nothing to do with the change
being made.

## After promoting: the permission target, the ID-mismatch message and the tag

Where the project's controller template reads `permissionGroup`, `notFoundMessageKey` and
`ownerPermission` (`entity/yml-configuration.md` § Project template keys), set those yml keys
before generating and there is nothing to rewrite here. Otherwise:

- The controller template emits the entity name as the permission target. Invariant #9 forbids it
  (the audit's `permission-target-not-group`): rewrite each target to the feature-area group the
  related controllers share, or move the rewrite into the template behind `permissionGroup`.
- A service template copied from an older generation resolves the `update` guard's message at
  throw time with an English default (the audit's `throw-time-english-default`). Throw the
  `{error.<domain>.idCannotChange}` placeholder (SKILL.md #3; `template-customization.md` §
  Service Template Example; the generator's sample throws `{error.id.cannot.change}`), add the
  key in every locale, and change the template's copy so the next promote needs no rewrite.
- The generated `@Tag(name)` is `{module}.{subdomain}.{Entity}` with no `web` segment (#10; the
  audit's `tag-java-package-namespace`). Its description is the entity's class `@Comment`.

## Post-Promote Verification

Run the first check before `yo simplix:generated`: that command renders every promoted entity into
`generated/` again and leaves the renders there.

```bash
# Verify generated files are deleted
find generated -name "EntityName*" -type f
# Should return empty (0 files)

# Build to ensure everything compiles (use the module that contains the entity)
./gradlew :{module}:compileJava :{module}:compileTestJava
# Example: ./gradlew :modules:facility-config:compileJava :modules:facility-config:compileTestJava

# Run tests to verify
./gradlew :{module}:test --tests "*EntityNameServiceTest*"
```

## Checklist

- [ ] Run `yo simplix:promote EntityName --module <promoteModule>`, and resolve every reported conflict in the file
- [ ] Verify no files remain in `generated/` for the entity (before the next step re-renders them)
- [ ] `yo simplix:generated` exits 0, and `.simplix/bases/` is committed with the promoted files
- [ ] Every `hasPermission` target rewritten to the feature-area group (#9), and the `@Tag` free of a `web` segment (#10)
- [ ] The service's ID-mismatch guard throws the `{error.<domain>.idCannotChange}` placeholder (#3)
- [ ] `node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs"` reports 0 error-level hits on the promoted files
- [ ] Build passes (no duplicate class errors)
- [ ] Tests pass
