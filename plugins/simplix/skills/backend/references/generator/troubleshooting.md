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
private boolean active;  // → isActive()  - breaks framework lookups
```

## A JSON Column Holding a List of Domain POJOs

```java
@Type(JsonType.class)
@Column(name = "steps")
private List<StepSpec> steps;   // StepSpec stands for any value object, not an entity
```

**The generator reads such a field as a value, never as a relation, when it can find the type's
source.** A field type that is neither basic nor an enum is judged by its own source under the
entity scan path, matched by package and name: a type that declares `@Entity` is a related entity, a
type that declares none (a record, an embeddable, a converted value) is `typeKind: value`. A value
gets no `ObjectProvider<StepSpecService>`, no relation DTO and no `reference:` block in a new yml;
the DTO carries `List<StepSpec>` as the entity does. The judgment reads the type, never the mapping
annotation or the field's name, so `@Type(JsonType.class)`, `@JdbcTypeCode(SqlTypes.JSON)` and a
converter behave alike.

- **A type with no source under the scan path is still read as a relation**: a library type, or a
  class nested inside the entity. The symptom is an injected `ObjectProvider<StepSpecService>` for
  a service that does not exist. Give the value type its own file in the domain module, under the
  scan path; a generator that predates the `value` kind shows the same symptom for every such
  field, and `yo simplix:version --update` is the fix.
- **The DTO imports a value's type only through the template's `typeKind === 'value'` branch.** A
  project template copied before the kind existed lacks it, and its fresh DTO then refers to
  `StepSpec` without importing it. Copy the branch (`// Handle a value type kept in the row`, after
  the enum branch of the import block) from the generator's `sample/.simplix/templates/dto/EntityDTOs.java.template`
  into the project's `.simplix/templates/dto/EntityDTOs.java.template`.
- **A conflict on a value field after that is a customisation, not a generator defect.** A held DTO
  that draws the list through its own view type (`List<StepView>` where the template writes
  `List<StepSpec>`) collides with the template's line by design: keep the held line in the file and
  record the fresh render as the base (`promote-workflow.md` § Usage).

Two failures of the same field remain outside the generator's classification:

**① The generated test calls setters for derived i18n columns.** `setTitleSearch` /
`setTitleSortEn` and their siblings are computed by a listener from the i18n map and have no
setter on the DTO. Delete those lines after promoting.

**② The translation tests do not see the POJO's fields at all, and stay silent about it.**
`field.getType()` returns `java.util.List`, which is outside the domain package, so the POJO's
fields are never walked: they are left with **no label in any locale and nothing fails** - and
writing the labels anyway makes them fail as orphan keys, which reads as the opposite problem.
The fix is in the tests, not in the entity: resolve the generic argument of a JSON-mapped
field, whichever annotation maps it (`../entity/field-types.md` § JSON Fields), and walk the
type it names.

