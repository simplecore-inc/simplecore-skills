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

Expected output:
```
ℹ Promoting CmsContentLink...
ℹ Service:
  From: .../generated/main/.../service/CmsContentLinkService.java
  To:   .../src/main/.../service/CmsContentLinkService.java
  ✔ Promoted successfully

ℹ Controller:
  From: .../generated/main/.../controller/CmsContentLinkRestController.java
  To:   .../src/main/.../controller/CmsContentLinkRestController.java
  ✔ Promoted successfully

ℹ DTOs:
  From: .../generated/main/.../dto/CmsContentLinkDTOs.java
  To:   .../src/main/.../dto/CmsContentLinkDTOs.java
  ✔ Promoted successfully

ℹ Service Test:
  From: .../generated/test/.../service/CmsContentLinkServiceTest.java
  To:   .../src/test/.../service/CmsContentLinkServiceTest.java
  ✔ Promoted successfully

ℹ Summary:
  ✔ Promoted: 4 files

✔ Promotion complete!
```

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
