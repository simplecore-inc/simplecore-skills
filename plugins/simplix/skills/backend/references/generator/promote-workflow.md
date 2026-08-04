# Promote Workflow Reference

Move generated CRUD code from `generated/` to `src/` after verification.

> **Scope (canonical):** `yo simplix:promote` command, file-mapping table (service/controller/DTO/test destinations), verification steps. Runs after `yo simplix:generate`. For template issues encountered during generation, see **troubleshooting.md**; for template editing see **template-customization.md**.

## Required Arguments

**MANDATORY**: The promote command requires the entity name. If missing, use AskUserQuestion to prompt.

| Argument | Required | Description |
|----------|----------|-------------|
| EntityName | **YES** | The name of the entity to promote |

## Why Promote?

- Generated code starts in `generated/` for isolation during development
- Promoting to `src/` integrates the code into the main codebase
- Allows regeneration without affecting production code

## What Promote Does

1. Copies files from `generated/` to `src/` directory
2. **Deletes the original files from `generated/`** (prevents duplicate class errors)
3. Creates destination directories if they don't exist
4. Shows summary of promoted files

## File Mapping

| Type | From (generated/) | To (src/) |
|------|-------------------|-----------|
| Service | `generated/main/java/.../service/` | `src/main/java/.../service/` |
| Controller | `generated/main/java/.../controller/` | `src/main/java/.../controller/` |
| DTOs | `generated/main/java/.../dto/` | `src/main/java/.../dto/` |
| Service Test | `generated/test/java/.../service/` | `src/test/java/.../service/` |

## Usage

```bash
# Promote (skips if destination exists)
yo simplix:promote EntityName

# Force overwrite existing files in src/
yo simplix:promote EntityName --force
```

**IMPORTANT**: Always use `yo simplix:promote` instead of manual file operations. The command ensures:
- Files are deleted from `generated/` after copying (no duplicate classes)
- Proper directory structure is created
- Consistent file handling across all entities

## Example: Promote CmsContentLink

```bash
# Generate CRUD files first
yo simplix:generate CmsContentLink --force

# Promote to src/ (use --force if files already exist)
yo simplix:promote CmsContentLink --force
```

It reports one `From` / `To` pair per artefact — service, controller, DTOs, service test — and a
count. Four promoted files is the normal shape for an entity with no optional parts.

## Before generating: the collision check (MANDATORY)

**`yo simplix:promote` OVERWRITES `src/` files silently.** Before generating an entity `X`,
verify no hand-authored `X{Service,RestController,DTOs}` already exists in the target
`modulePath` package. `yo simplix:generate X` + `promote` will clobber a same-named
hand-written `XService` — a lifecycle or action service, say — with a generated CRUD one and
delete its logic.

On a clash, either **rename the hand-authored class to a role-specific name**
(`XLifecycleService`, `XQueryService`) before generating, or **do not generate `X`** at all
because it is managed through its parent aggregate (see the child-entity patterns). After
every `promote`, re-compile and confirm no pre-existing service was overwritten.

## Trimming a generated controller is manual, and verified after each cut

Never bulk-delete endpoint methods with a fragile script: a mis-parse silently eats the
constructor or leaves a dangling body. Remove one endpoint method at a time — Javadoc,
annotations and body as a unit — and compile after each.

For an append-only audit or history entity, trim the writes down to a read surface (keep `get`
+ `search`). Re-apply `@RequiresFeature` and a real `@Tag` description after any
re-generation; regeneration wipes both.

## After generating: the promoted service test goes stale with the service

The promoted `*ServiceTest` references the generated CRUD DTOs and methods. If the service is
converted to non-CRUD, or generated DTOs are deleted, **delete or rewrite that test in the same
step** — a stale generated test fails for a reason that has nothing to do with the change
being made.

## Post-Promote Verification

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

- [ ] Run `yo simplix:promote EntityName --force`
- [ ] Verify no files remain in `generated/` for the entity
- [ ] Build passes (no duplicate class errors)
- [ ] Tests pass
