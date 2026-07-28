# Field Types Reference

All field-type patterns for SimpliX JPA entities.

> **Scope (canonical):** per-type annotations and patterns — ID (UUID v7), String, Boolean, Enum, i18n Map, JSON, Encrypted (PII), Date/Time, Numeric, Search index, Sort order. For entity-level cross-cutting concerns (audit, soft delete, events) see **base-entity-patterns.md**; for FK handling see **relationship-patterns.md**; for encryption detail see **entity-security-patterns.md**.

## Contents

- [ID Field (Primary Key)](#id-field-primary-key)
- [String Fields](#string-fields)
- [Boolean Fields](#boolean-fields)
- [Enum Fields](#enum-fields)
- [i18n Fields (Multilingual)](#i18n-fields-multilingual)
- [JSON Fields](#json-fields)
- [Encrypted Fields (PII)](#encrypted-fields-pii)
- [Date/Time Fields](#datetime-fields)
- [Numeric Fields](#numeric-fields)
- [Search Index Field](#search-index-field)
- [Sort Order Field](#sort-order-field)
- [Field Annotations Summary](#field-annotations-summary)
- [See Also](#see-also)

---

## ID Field (Primary Key)

### UUID v7 Pattern (Recommended)

```java
@Id
@GeneratedValue(strategy = GenerationType.UUID, generator = "uuid-v7")
@UuidV7Generator
@Column(name = "entity_id", nullable = false, unique = true, updatable = false)
private String entityId;
```

**Key Points:**
- UUID v7 is time-ordered (sortable by creation time)
- Column name follows pattern: `{entity_name}_id` (snake_case)
- Field name follows pattern: `{entityName}Id` (camelCase)
- Always `nullable = false`, `unique = true`, `updatable = false`

### getId/setId Override

```java
@Override
public String getId() {
    return getEntityId();
}

@Override
public void setId(String id) {
    setEntityId(id);
}
```

---

## String Fields

### Basic String

```java
@Column(name = "name", nullable = false, length = 128)
private String name;
```

### Unique String

```java
@Column(name = "channel_code", nullable = false, unique = true, length = 64)
private String channelCode;
```

### Natural ID (Business Key)

```java
@NaturalId
@Column(name = "channel_code", nullable = false, unique = true, length = 64)
private String channelCode;
```

### Text (Long String)

```java
@Column(name = "description", columnDefinition = "TEXT")
private String description;
```

### Rich Text / HTML Content

```java
@Column(name = "body", columnDefinition = "TEXT")
private String body;
```

---

## Boolean Fields

### Important: Use Wrapper Type

```java
// Correct - wrapper type
@Column(name = "active", nullable = false)
private Boolean active = true;

// Wrong - primitive type (causes issues with DTOs)
// private boolean active;
```

**Why Wrapper Type:**
- DTOs need `getActive()` not `isActive()`
- Allows null for optional boolean fields
- Consistent with other field types

### Common Boolean Fields

```java
@Column(name = "active", nullable = false)
@Builder.Default
private Boolean active = true;

@Column(name = "featured")
private Boolean featured = false;

@Column(name = "published", nullable = false)
@Builder.Default
private Boolean published = false;
```

---

## Enum Fields

### Entity Field Declaration

```java
@Enumerated(EnumType.STRING)
@Column(name = "status", nullable = false, length = 32)
private ContentStatus status = ContentStatus.DRAFT;
```

**Key Points:**
- Always use `EnumType.STRING` (not `ORDINAL`)
- Set appropriate `length` for the longest enum value
- Provide default value when appropriate

### LabeledEnum Interface

All enums MUST implement `LabeledEnum` for i18n support:

```java
package {basePackage}.domain.enums.cms;

import com.simplix.core.i18n.LabeledEnum;

public enum ContentStatus implements LabeledEnum {
    DRAFT,
    PUBLISHED,
    SCHEDULED,
    ARCHIVED;

    @Override
    public String getLabel() {
        return name();
    }
}
```

### Enum File Location

```
modules/domain/.../enums/{module}/{EnumName}.java
```

**Package Structure:**
- `enums/cms/` - CMS related enums
- `enums/user/` - User related enums
- `enums/org/` - Organization related enums
- `enums/audit/` - Audit related enums
- `enums/auth/` - Authentication/Authorization related enums

### Enum i18n Messages (MANDATORY)

**File Location:**
```
modules/domain/.../resources/messages/enums/{module}/enums-{module}-messages.properties
```

**Message Format:**
```properties
# Enum type label
enum.ContentStatus=Content Status

# Enum value labels
enum.ContentStatus.DRAFT=Draft
enum.ContentStatus.PUBLISHED=Published
enum.ContentStatus.SCHEDULED=Scheduled
enum.ContentStatus.ARCHIVED=Archived
```

**Multi-language Files:**
```
enums-cms-messages.properties      # Default (English)
enums-cms-messages_ko.properties   # Korean
enums-cms-messages_ja.properties   # Japanese
```

**Korean Example (`enums-cms-messages_ko.properties`):**
```properties
enum.ContentStatus=콘텐츠 상태
enum.ContentStatus.DRAFT=초안
enum.ContentStatus.PUBLISHED=발행됨
enum.ContentStatus.SCHEDULED=예약됨
enum.ContentStatus.ARCHIVED=보관됨
```

### Enum Naming Conventions

| Convention | Example |
|------------|---------|
| Enum class | PascalCase: `ContentStatus`, `UserRole` |
| Enum values | UPPER_SNAKE_CASE: `DRAFT`, `IN_PROGRESS` |
| Package | lowercase: `enums/cms/`, `enums/user/` |
| i18n key | `enum.{EnumName}.{VALUE}` |

### Common Enum Patterns

**Status Enum:**
```java
public enum ContentStatus implements LabeledEnum {
    DRAFT,
    PUBLISHED,
    ARCHIVED;
}
```

**Type Enum:**
```java
public enum ChannelType implements LabeledEnum {
    BLOG,
    NEWS,
    ANNOUNCEMENT,
    FAQ;
}
```

**Action Enum (for Audit):**
```java
public enum AuditAction implements LabeledEnum {
    LOGIN_SUCCESS,
    LOGIN_FAILURE,
    LOGOUT,
    ENTITY_CREATED,
    ENTITY_UPDATED,
    ENTITY_DELETED;
}
```

### Enum Validation (Domain Tests)

Domain module tests validate enum i18n:

```bash
./gradlew :packages:domain-<aggregate>:test
```

**Test validates:**
- Every enum implements `LabeledEnum`
- Every enum has i18n messages for all values
- Messages exist in all required languages

**Fix missing translations before proceeding with code generation.**

### Enum in YML Configuration

When referencing enum fields in SimpliX YML:

```yaml
fields:
  status:
    sortable: true
    views: [list, detail, edit, batchUpdate]
    required: true
    searchOperators: [equals, in]
```

**Search Operators for Enums:**
- `equals` - Single value match
- `in` - Multiple value match (dropdown multi-select)

---

## i18n Fields (Multilingual)

### Pattern: Default + i18n Map

```java
// Default language value
@Column(name = "name", nullable = false, length = 128)
private String name;

// Multilingual values as JSON
@Type(JsonType.class)
@Column(name = "name_i18n", columnDefinition = "TEXT")
private Map<String, String> nameI18n;
```

### Multiple i18n Fields

```java
@Column(name = "title")
private String title;

@Type(JsonType.class)
@Column(name = "title_i18n", columnDefinition = "TEXT")
private Map<String, String> titleI18n;

@Column(name = "description", columnDefinition = "TEXT")
private String description;

@Type(JsonType.class)
@Column(name = "description_i18n", columnDefinition = "TEXT")
private Map<String, String> descriptionI18n;
```

### i18n in Search Index

```java
@PrePersist
@PreUpdate
private void generateSearchIndex() {
    this.searchIndex = SearchIndexBuilder.create()
        .text(name)
        .i18n(nameI18n)
        .text(title)
        .i18n(titleI18n)
        .build();
}
```

---

## JSON Fields

### Map Type

```java
@Type(JsonType.class)
@Column(name = "metadata", columnDefinition = "TEXT")
private Map<String, Object> metadata;
```

### List Type

```java
@Type(JsonType.class)
@Column(name = "tags", columnDefinition = "TEXT")
private List<String> tags;
```

### Custom Object

```java
@Type(JsonType.class)
@Column(name = "settings", columnDefinition = "TEXT")
private ChannelSettings settings;
```

---

## Encrypted Fields (PII)

### AES Encryption

For sensitive data storage:

```java
@Convert(converter = AesEncryptionConverter.class)
@Column(name = "email", length = 512)
private String email;
```

**Important:**
- Increase column length (encryption adds overhead)
- Original 256 chars -> Use 512 for column length

### Hash for Searching

For encrypted unique fields that need searching:

```java
@Convert(converter = HashingAttributeConverter.class)
@Column(name = "email_hashed", length = 64, unique = true)
private String emailHashed;
```

### Complete PII Pattern

```java
// Encrypted storage
@Convert(converter = AesEncryptionConverter.class)
@Column(name = "email", length = 512)
private String email;

// Searchable hash
@Convert(converter = HashingAttributeConverter.class)
@Column(name = "email_hashed", length = 64, unique = true)
private String emailHashed;

// Partial for display (optional)
@Column(name = "email_last4", length = 4)
private String emailLast4;
```

---

## Date/Time Fields

Every temporal field belongs to exactly ONE semantic kind (skill invariant #18). Decide the kind FIRST — it fixes the Java type, column type, JSON shape, and search behavior.

| Semantic kind | Meaning | Java type | Column | JSON |
|---|---|---|---|---|
| **Absolute instant** | One global point in time — same moment in every zone | `Instant` | TIMESTAMP (UTC-normalized) | RFC 3339 with offset |
| **Calendar date** | "That date in that locale" — not a point in time until a zone is applied | `LocalDate` | DATE | `yyyy-MM-dd` |
| **Wall-clock time** | "That time of day in that locale" — recurs daily | `LocalTime` | TIME | `HH:mm[:ss]` |
| **Calendar period** | Year-month / year bucket | fixed-width String `yyyy-MM` + `@Pattern` validation | VARCHAR | `yyyy-MM` |

```java
// Absolute instant — event timestamps, expirations, activation windows with time-of-day precision
@Column(name = "published_at")
private Instant publishedAt;

// Calendar date — holidays, leave dates, effective-from/to, birth dates
@Column(name = "birth_date")
private LocalDate birthDate;

// Wall-clock time — shift start/end, core time, cutoff times
@Column(name = "shift_start")
private LocalTime shiftStart;
```

### Forbidden

- **String columns holding an offset-carrying or variable-format date/time** (RFC 3339 etc.) — they lose input validation, chronological search/sort (searchable-jpa compares VARCHAR lexicographically), OpenAPI `format` hints, and cannot serve controllers in different site timezones (one string carries one offset). Wire/SDK string formats are produced at the transmission boundary (SU mappers, site timezone) — never stored. See AP-27.
- **`LocalDateTime` / `OffsetDateTime` / `ZonedDateTime` entity fields** — SimpliX's auto-applied JPA converters UTC-normalize them, so they cannot preserve an original offset; an absolute point in time is `Instant`, a zone-free value is `LocalDate`/`LocalTime`.

### Timezone configuration fields

Fields that hold a timezone (e.g. `Site.timezone`) store **IANA zone IDs** (`"Asia/Seoul"`), never fixed offsets (`"+09:00"`) — offsets shift with DST; compute the offset at use time from the zone ID.

### Zone handling in services

Never call argless `LocalDate.now()` / `LocalTime.now()` / `OffsetDateTime.now()` / `Year.now()` / `YearMonth.now()`, `ZoneId.systemDefault()`, or `TimeZone.getDefault()` in main code — the container's TZ must never decide a domain result. `Instant.now()` is zone-free and unrestricted. Resolve the `ZoneId` explicitly, in this order:

1. **Site timezone** — `Site.timezone` (IANA ID), for anything attributed to a physical site: work-date attribution, visit dates, kiosk "today", policy windows, site-scoped day boundaries.
2. **Domain operation-policy default zone** — when no site applies (e.g. `defaultTimeZone` on the domain's operation policy).
3. **App timezone** — the single configured fallback. Never hardcode a zone literal (`ZoneId.of("Asia/Seoul")`) — inject it from configuration. Sole exception: `ZoneOffset.UTC` where the storage contract itself is UTC (statistics buckets, retention batches), with a justifying comment on the constant.

Every `Instant ↔ LocalDate`/`LocalTime` conversion names its zone in code: `instant.atZone(zone).toLocalDate()`, `date.atStartOfDay(zone).toInstant()`. Time-sensitive components (schedulers, evaluators) take an injected `java.time.Clock` through their single explicit constructor (see AP-26). User/browser timezones are display-only and never influence stored values. Anti-pattern: AP-28. These zone rules bind ALL Java code including schedulers and infrastructure.

---

## Numeric Fields

### Integer

```java
@Column(name = "view_count", nullable = false)
@Builder.Default
private Integer viewCount = 0;
```

### Long

```java
@Column(name = "sort_order", nullable = false)
@Builder.Default
private Long sortOrder = 0L;
```

### BigDecimal (Money/Precision)

```java
@Column(name = "price", precision = 19, scale = 4)
private BigDecimal price;
```

---

## Search Index Field

### Pattern

```java
@Column(name = "search_index", columnDefinition = "TEXT")
@NotAudited
private String searchIndex;

@PrePersist
@PreUpdate
private void generateSearchIndex() {
    this.searchIndex = SearchIndexBuilder.create()
        .text(name)
        .i18n(nameI18n)
        .text(channelCode)
        .richText(body)  // Strips HTML
        .build();
}
```

### SearchIndexBuilder Methods

| Method | Purpose |
|--------|---------|
| `.text(String)` | Add plain text |
| `.i18n(Map<String, String>)` | Add all i18n values |
| `.richText(String)` | Strip HTML and add text |
| `.build()` | Generate final index string |

---

## Sort Order Field

### Auto-increment Pattern

```java
@Column(name = "sort_order", nullable = false)
@Builder.Default
private Long sortOrder = 0L;
```

### In YML Configuration

```yaml
sortOrderConfig:
  field: sortOrder
  autoIncrement: true
  gap: 100
```

---

## Field Annotations Summary

| Annotation | Purpose |
|------------|---------|
| `@Column(name = "x")` | Column name |
| `@Column(nullable = false)` | NOT NULL |
| `@Column(unique = true)` | Unique constraint |
| `@Column(length = n)` | VARCHAR length |
| `@Column(columnDefinition = "TEXT")` | Long text |
| `@Column(precision = p, scale = s)` | Decimal precision |
| `@NaturalId` | Business key |
| `@Enumerated(EnumType.STRING)` | Enum as string |
| `@Type(JsonType.class)` | JSON storage |
| `@Convert(converter = X.class)` | Custom converter |
| `@NotAudited` | Exclude from audit |
| `@Comment("x")` | Column description |
| `@Builder.Default` | Lombok default value |

---

## See Also

- [Base Entity Patterns](base-entity-patterns.md) - BaseEntity, audit, soft delete
- [Relationship Patterns](relationship-patterns.md) - FK and relationships
- [Entity Security Patterns](entity-security-patterns.md) - Encryption, GDPR