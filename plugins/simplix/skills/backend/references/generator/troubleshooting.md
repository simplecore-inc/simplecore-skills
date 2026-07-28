# Generator Troubleshooting

Common errors and fixes when running `yo simplix:generate`.

## Generator Not Found

```bash
# Install globally
npm install -g yo generator-simplix

# Or run via npx
npx yo simplix:generate EntityName
```

## YML Not Found (Entity configuration not found)

```
Error: Entity configuration not found
```

**Fix**: Run config first.

```bash
yo simplix:config EntityName --force
```

## Import Errors in Generated Code

**Cause**: `modulePath` in YML doesn't match entity location.

```yaml
# Entity at: domain/entity/cms/channel/CmsChannel.java
modulePath: cms/channel  # Must mirror the package path
```

**Additional cause**: target module's `build.gradle.kts` missing dependency on the generated code's source module (often manifests as 'cannot find symbol' for entity or DTO imports).

## Field Missing in DTO

**Cause**: Field's `views` array doesn't include the DTO type being generated.

```yaml
fieldName:
  views: [list, detail, edit]  # Add the views you need
```

## Enum Import Errors

**Cause**: Generator looks up enums by convention.

Enum location: `domain/enums/cms/ContentStatus.java`
Generator expects: `{basePackage}.domain.enums.{package}.{EnumName}`

If the package doesn't match, the generated import will be wrong.

## Boolean Getter Issues (`isField()` vs `getField()`)

**Cause**: Primitive `boolean` produces `isField()`, wrapper `Boolean` produces `getField()`. SimpliX expects the getter form.

```java
// Correct
private Boolean active;  // → getActive()

// Wrong
private boolean active;  // → isActive()  — breaks framework lookups
```
