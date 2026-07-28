# I18n Field Patterns

Rules for handling i18n field pairs (`name` + `nameI18n` Map pattern) in DTOs.

> **Scope (canonical):** how to pair `@I18nTrans` with `@JsonIgnore`, nested-object vs direct-field pattern, SearchDTO i18n handling. For field-type-conversion basics or DTO-role decisions, see **entity-to-dto-mapping.md** and **dto-type-reference.md**.

## Overview

SimpliX supports multilingual content through paired fields in entities:

| Entity Field Type | Field Pattern | Purpose |
|-------------------|---------------|---------|
| Base field | `String {name}` | Default language value |
| I18n field | `Map<String, String> {name}I18n` | Translations by locale |

---

## Entity Field Detection

### Check Entity for I18n Pairs

```java
@Entity
public class CmsContent {
    // Base field - default language
    @Column(length = 500)
    private String title;

    // I18n field - translations
    @Convert(converter = StringMapConverter.class)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> titleI18n;
}
```

### Pairing Rules

1. I18n field ends with `I18n` suffix
2. Base field exists with same name (without suffix)
3. I18n field is of type `Map<String, String>`

### Valid Pairs (Check Entity)

| Base Field | I18n Field | Valid |
|------------|------------|-------|
| `title` | `titleI18n` | Yes |
| `description` | `descriptionI18n` | Yes |
| `name` | `nameI18n` | Yes |
| `title` | `titleTranslations` | No (wrong suffix) |
| - | `bodyI18n` | No (no base field) |

---

## DTO Type Handling

### CreateDTO / UpdateDTO

Both base and i18n fields included for input:

**Entity**:
```java
private String title;
private Map<String, String> titleI18n;
```

**DTO**:
```java
@Schema(description = "Content title (default language)")
@FieldLabel("{entities.CmsContent.title}")
@NotBlank
@Length(max = 500)
private String title;

@Schema(description = "Title I18n")
@FieldLabel("{entities.CmsContent.titleI18n}")
private Map<String, String> titleI18n;
```

**API Request**:
```json
{
  "title": "Welcome",
  "titleI18n": {
    "ko": "환영합니다",
    "ja": "ようこそ"
  }
}
```

### DetailDTO / ListDTO

Uses `@I18nTrans` for automatic locale resolution:

**Entity**:
```java
private String title;
private Map<String, String> titleI18n;
```

**DTO**:
```java
@Schema(description = "Content title")
@I18nTrans(source = "titleI18n")
private String title;

@Schema(description = "Title I18n")
@JsonIgnore
private Map<String, String> titleI18n;
```

**API Response** (Accept-Language: ko):
```json
{
  "title": "환영합니다"
}
```

---

## CRITICAL: @I18nTrans Mandatory Pattern

> **IMPORTANT**: Every I18n-capable field MUST follow the paired field pattern. Missing either the `@I18nTrans` annotation or the paired `@JsonIgnore` I18n field will cause i18n resolution to fail.

### Direct Field Pattern (Same DTO)

When I18n field is in the same DTO:

```java
// MANDATORY: Both fields must exist as a pair
@Schema(description = "Display name for the channel")
@I18nTrans(source="channelNameI18n")
private String channelName;

@Schema(description = "Channel Name I18n")
@JsonIgnore
private Map<String, String> channelNameI18n;

// ANOTHER pair for description
@Schema(description = "Description of the channel purpose")
@I18nTrans(source="descriptionI18n")
private String description;

@Schema(description = "Description I18n")
@JsonIgnore
private Map<String, String> descriptionI18n;
```

### Nested Object Pattern (ManyToOne)

When I18n field is inside a nested entity reference:

```java
// MANDATORY: Use source + target for nested object i18n resolution
@Schema(description = "Channel")
@JsonIncludeProperties({"channelId", "channelName", "channelCode"})
@I18nTrans(source="channel.channelNameI18n", target="channel.channelName")
private CmsChannel channel;
```

**Key Attributes for Nested Objects:**
- `source`: Path to the I18n Map field (e.g., `channel.channelNameI18n`)
- `target`: Path to the field to be resolved (e.g., `channel.channelName`)

### Pattern Selection Guide

| Scenario | Pattern | Example |
|----------|---------|---------|
| I18n in same DTO | `source` only | `@I18nTrans(source="titleI18n")` |
| I18n in nested entity | `source` + `target` | `@I18nTrans(source="channel.nameI18n", target="channel.name")` |
| Multiple I18n in nested | Multiple `@I18nTrans` | Stack multiple annotations |

### Multiple Nested I18n Fields (Repeatable Annotation)

`@I18nTrans` is a **repeatable annotation**, so you can stack multiple annotations for nested objects with multiple I18n fields:

```java
@Schema(description = "Product with multiple translated fields")
public class ProductDTO {

    @Schema(description = "Product translations")
    @JsonIncludeProperties({"name", "description", "category"})
    @I18nTrans(source = "info.nameI18n", target = "info.name")
    @I18nTrans(source = "info.descriptionI18n", target = "info.description")
    @I18nTrans(source = "info.categoryI18n", target = "info.category")
    private ProductInfo info;
}
```

**Real-world example:**

```java
@Schema(description = "Channel that this page belongs to")
@I18nTrans(source="channel.channelNameI18n", target="channel.channelName")
@I18nTrans(source="channel.descriptionI18n", target="channel.description")
private CmsChannelInfoDTO channel;
```

---

## @I18nTrans Annotation

### Purpose

Automatically resolves localized value from i18n Map based on request locale.

### Syntax

```java
@I18nTrans(source = "{i18nFieldName}")
private String {baseFieldName};
```

### How to Configure

1. Find base field in entity: `title`
2. Find i18n field in entity: `titleI18n`
3. Apply annotation: `@I18nTrans(source = "titleI18n")`

### Resolution Logic

1. Get current request locale (e.g., `ko`)
2. Look up value in `titleI18n` Map
3. If found, use localized value
4. If not found, fallback to base field value

---

## @JsonIgnore on I18n Fields

### Purpose

Hide i18n Map from JSON response (only resolved value is needed).

### Pattern

```java
// Base field - visible, auto-resolved
@I18nTrans(source = "titleI18n")
private String title;

// I18n field - hidden from response
@JsonIgnore
private Map<String, String> titleI18n;
```

### Why Hide I18n Map?

1. **Reduces response size**: No need to send all translations
2. **Cleaner API**: Client gets resolved value directly
3. **Consistent structure**: Same field name across locales

---

## Complete Entity to DTO Example

### Entity

```java
@Entity
public class CmsTagGroup {
    @Id
    private String tagGroupId;

    @Column(nullable = false, length = 100)
    private String name;

    @Convert(converter = StringMapConverter.class)
    private Map<String, String> nameI18n;

    private String description;

    @Convert(converter = StringMapConverter.class)
    private Map<String, String> descriptionI18n;
}
```

### CreateDTO

```java
@Data
public static class CmsTagGroupCreateDTO {

    @NotBlank
    @Length(max = 100)
    private String name;

    // Both fields for input
    private Map<String, String> nameI18n;

    private String description;

    private Map<String, String> descriptionI18n;
}
```

### DetailDTO/ListDTO

```java
@Data
public static class CmsTagGroupDetailDTO {
    private String tagGroupId;

    // i18n auto-resolution
    @I18nTrans(source = "nameI18n")
    private String name;

    @JsonIgnore
    private Map<String, String> nameI18n;

    @I18nTrans(source = "descriptionI18n")
    private String description;

    @JsonIgnore
    private Map<String, String> descriptionI18n;
}
```

---

## SearchDTO I18n Handling

### Check Entity for Searchable I18n Content

For text search across translations, typically search the i18n field:

**Entity**:
```java
private String title;
private Map<String, String> titleI18n;  // JSON stored
```

**SearchDTO**:
```java
// Search in i18n translations
@SearchableField(entityField = "titleI18n", operators = {CONTAINS})
private String title;
```

Or search both:
```java
// Search default language
@SearchableField(entityField = "title", operators = {CONTAINS})
private String title;

// Search translations separately
@SearchableField(entityField = "titleI18n", operators = {CONTAINS})
private String titleI18n;
```

---

## Common I18n Field Pairs

Check entity for these common pairs:

| Base Field | I18n Field | Typical Use |
|------------|------------|-------------|
| `title` | `titleI18n` | Content titles |
| `name` | `nameI18n` | Entity names |
| `description` | `descriptionI18n` | Descriptions |
| `summary` | `summaryI18n` | Summaries |
| `body` | `bodyI18n` | Content body |
| `label` | `labelI18n` | UI labels |
| `authorName` | `authorNameI18n` | Author names |

---

## Entity to DTO Checklist

### For CreateDTO/UpdateDTO

- [ ] Both base and i18n fields included
- [ ] Validation on base field (if required)
- [ ] No validation on i18n field (optional)
- [ ] `Map<String, String>` type for i18n field

### For DetailDTO/ListDTO

- [ ] `@I18nTrans(source="{i18nField}")` on base field
- [ ] `@JsonIgnore` on i18n field
- [ ] Both fields present (for data mapping)

---

## Troubleshooting

### Issue: @I18nTrans not resolving

**Entity Check**:
```java
// Verify i18n field exists and has correct name
private String title;
private Map<String, String> titleI18n;  // Must end with I18n
```

**DTO Check**:
```java
// Source must match exact i18n field name
@I18nTrans(source = "titleI18n")  // Not "title_i18n"
private String title;
```

### Issue: I18n field appearing in response

**DTO Check**:
```java
// Must have @JsonIgnore
@JsonIgnore
private Map<String, String> titleI18n;
```

### Issue: Both fields required in CreateDTO

**DTO Check**:
```java
// Only base field should be required
@NotBlank
private String title;

// I18n field should be optional
private Map<String, String> titleI18n;  // No @NotNull
```

### Issue: I18n pair not detected

**Entity Check**:
1. Field naming: `{name}` + `{name}I18n`
2. Base field exists
3. I18n field is `Map<String, String>`

---

## Quick Reference

| Entity Has | CreateDTO | DetailDTO |
|------------|-----------|-----------|
| `String name` | `String name` (with validation) | `@I18nTrans String name` |
| `Map nameI18n` | `Map nameI18n` (no validation) | `@JsonIgnore Map nameI18n` |

| Check | Action |
|-------|--------|
| Entity has `*I18n` Map field | Look for base field pair |
| Base field has i18n pair | Add `@I18nTrans` in Detail/List DTO |
| I18n field in Detail/List DTO | Add `@JsonIgnore` |

## Aggregation / Projection DTOs Carry the Pair Too

The `@I18nTrans` + `@JsonIgnore` pair applies to EVERY read-path DTO that copies an i18n-backed field — not just the entity's own Detail/List DTOs. Aggregation, projection, self-service, and report DTOs (e.g. a balance summary carrying a type name, a report row carrying a holiday name) are the common blind spot: they hand-copy `entity.getName()` and silently ship the untranslated default.

**Rule**: any DTO field populated from an entity field that has an `*I18n` map pair MUST declare `@I18nTrans(source = "...I18n")`, carry the `@JsonIgnore` map, and have the mapper copy the map alongside the base value.

**Detection** (run from the module root):
```bash
# DTO name fields not annotated with @I18nTrans — verify each read-path hit
grep -rn -B3 "private String name;" --include="*DTOs.java" src/main/java | grep -v I18nTrans
```
Search/Create/Update DTO `name` fields are write-path input and are exempt.
