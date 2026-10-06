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

**Cause**: `modulePath` in the yml is not the one the entity's package gives, in a layout that builds the repository import from it (`../entity/yml-configuration.md` § Wrong Import in Generated Code; both layouts: `../entity/base-entity-patterns.md` § Path convention).

```yaml
# Entity at: {basePackage}/domain/entity/cms/channel/CmsChannel.java
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

## A JSON Column Holding a List of Domain POJOs

Three separate failures come out of one field, all from the same cause: the generator reads
the declared type and a `List<T>` looks to it like a relation, while the i18n tests read
`field.getType()` and see `java.util.List`.

```java
@Type(JsonType.class)
@Column(name = "steps")
private List<StepSpec> steps;   // a value object, not an entity
```

**① The generator emits a service and a test for a repository that does not exist.** It reads
`StepSpec` as a referenced entity and injects a
`StepSpecService`. Removing the `reference:` block from the yml does not stop it -
the type is re-inferred from the field. **Delete the injection by hand after promoting**, and
expect it back after every regeneration.

**② The generated test calls setters for derived i18n columns.** `setTitleSearch` /
`setTitleSortEn` and their siblings are computed by a listener from the i18n map and have no
setter on the DTO. Delete those lines after promoting.

**③ The translation tests do not see the POJO's fields at all, and stay silent about it.**
`field.getType()` returns `java.util.List`, which is outside the domain package, so the POJO's
fields are never walked: they are left with **no label in any locale and nothing fails** - and
writing the labels anyway makes them fail as orphan keys, which reads as the opposite problem.
The fix is in the tests, not in the entity: resolve the generic argument of a JSON-mapped
field, whichever annotation maps it (`../entity/field-types.md` § JSON Fields), and walk the
type it names.
