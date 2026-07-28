# Entity Security Patterns

Security and compliance patterns at the entity level (ISO 27001, SOC2, GDPR).

> **Scope (canonical):** `AesEncryptionConverter` for PII, `HashingAttributeConverter` for searchable hashes (e.g., `emailHashed`), `@MaskSensitive` for audit logs, password hashing with BCrypt. For non-entity security (controller-level `@PreAuthorize`) see SKILL.md invariant #2; project-wide compliance rules live in the project's own security reference when it keeps one.
>
> **Note on examples:** Service classes in this file use `@RequiredArgsConstructor` because they reside in `app.*` packages (infrastructure), where this is permitted per SKILL.md Invariant 8. Services in `web.*` packages MUST use explicit constructors with `super(repository, entityManager)`.

---

## Overview

The patterns below exist to satisfy the compliance regimes a SimpliX project is typically held to. Read the project's own obligations and apply whichever bind it:
- **ISO 27001**: Information security management
- **SOC2 Type 2**: Security, availability, processing integrity
- **GDPR**: EU data protection regulations

---

## Encryption Patterns

### AES Encryption (For Storage)

Use for sensitive data that needs to be retrieved:

```java
@Convert(converter = AesEncryptionConverter.class)
@Column(name = "email", length = 512)
private String email;
```

**Important Notes:**
- Increase column length for encryption overhead (256 chars -> 512)
- Encrypted data is Base64 encoded
- Key management via Vault in production

### Hash (For Searching)

Use for encrypted unique fields that need searching:

```java
@Convert(converter = HashingAttributeConverter.class)
@Column(name = "email_hashed", length = 64, unique = true)
private String emailHashed;
```

**Key Points:**
- SHA-256 produces 64-character hex string
- One-way hash - cannot be reversed
- Use for lookup, not display

### Complete PII Pattern

```java
// Encrypted storage - can be decrypted for display
@Convert(converter = AesEncryptionConverter.class)
@Column(name = "email", length = 512)
private String email;

// Hash for unique constraint and searching
@Convert(converter = HashingAttributeConverter.class)
@Column(name = "email_hashed", length = 64, unique = true)
private String emailHashed;

// Partial value for display (optional)
@Column(name = "email_masked", length = 64)
private String emailMasked;  // e.g., "u***@example.com"
```

### Service Layer Pattern

```java
@Service
@RequiredArgsConstructor
public class UserAccountService {

    public void updateEmail(String userId, String newEmail) {
        UserAccount user = repository.findById(userId).orElseThrow();

        // Set encrypted value
        user.setEmail(newEmail);

        // Set hash for searching
        user.setEmailHashed(newEmail);  // Converter handles hashing

        // Set masked value for display
        user.setEmailMasked(DataMaskingUtils.maskEmail(newEmail));

        repository.save(user);
    }
}
```

---

## GDPR Required Fields

### User Entity Fields

For entities containing personal data:

```java
// Right to be forgotten (GDPR Art. 17)
@Column(name = "anonymized", nullable = false)
@Builder.Default
private Boolean anonymized = false;

// Anonymization timestamp
@Column(name = "anonymized_at")
private Instant anonymizedAt;

// Storage limitation (GDPR Art. 5.1.e)
@Column(name = "retention_expires_at")
private Instant retentionExpiresAt;

// Legal hold - prevents deletion when true
@Column(name = "legal_hold", nullable = false)
@Builder.Default
private Boolean legalHold = false;
```

### Complete UserAccount Example

```java
@Entity
@Table(name = "user_account")
public class UserAccount extends BaseEntity<String> {

    // Identity
    @Id
    @Column(name = "user_account_id")
    private String userAccountId;

    // Encrypted PII
    @Convert(converter = AesEncryptionConverter.class)
    @Column(name = "email", length = 512)
    private String email;

    @Convert(converter = HashingAttributeConverter.class)
    @Column(name = "email_hashed", length = 64, unique = true)
    private String emailHashed;

    @Convert(converter = AesEncryptionConverter.class)
    @Column(name = "mobile", length = 512)
    private String mobile;

    @Convert(converter = HashingAttributeConverter.class)
    @Column(name = "mobile_hashed", length = 64)
    private String mobileHashed;

    // Display name (not PII)
    @Column(name = "display_name", length = 128)
    private String displayName;

    // Account status
    @Column(name = "enabled", nullable = false)
    private Boolean enabled = true;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @Column(name = "locked", nullable = false)
    private Boolean locked = false;

    // GDPR compliance
    @Column(name = "anonymized", nullable = false)
    private Boolean anonymized = false;

    @Column(name = "anonymized_at")
    private Instant anonymizedAt;

    @Column(name = "retention_expires_at")
    private Instant retentionExpiresAt;

    @Column(name = "legal_hold", nullable = false)
    private Boolean legalHold = false;

    // Security
    @Column(name = "super_admin", nullable = false)
    private Boolean superAdmin = false;
}
```

---

## Anonymization Pattern

### Service Implementation

```java
@Service
@RequiredArgsConstructor
public class UserAnonymizationService {

    private final UserAccountRepository repository;

    @Transactional
    public void anonymizeUser(String userId) {
        UserAccount user = repository.findById(userId).orElseThrow();

        // Check legal hold
        if (user.getLegalHold()) {
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "Cannot anonymize: legal hold active", null);
        }

        // Anonymize PII
        user.setEmail(null);
        user.setEmailHashed(null);
        user.setMobile(null);
        user.setMobileHashed(null);
        user.setDisplayName("Deleted User");

        // Mark as anonymized
        user.setAnonymized(true);
        user.setAnonymizedAt(Instant.now());

        // Disable account
        user.setEnabled(false);
        user.setActive(false);

        repository.save(user);
    }
}
```

### Important Rules

1. **Never hard delete** - always anonymize
2. **Check legal hold** before anonymization
3. **Keep audit trail** - don't delete audit records
4. **Retain non-PII** - keep IDs for referential integrity

---

## Audit Logging

### AuditEvent Entity

```java
@Entity
@Table(name = "audit_event")
public class AuditEvent extends BaseEntity<String> {

    @Column(name = "audit_event_id")
    private String auditEventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false)
    private ActorType actorType;

    @Column(name = "actor_id")
    private String actorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false)
    private AuditAction action;

    @Column(name = "entity_type", length = 128)
    private String entityType;

    @Column(name = "entity_id")
    private String entityId;

    // Masked sensitive data
    @MaskSensitive
    @Column(name = "ip_address")
    private String ipAddress;

    @MaskSensitive
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @MaskSensitive
    @Type(JsonType.class)
    @Column(name = "details", columnDefinition = "TEXT")
    private Map<String, Object> details;
}
```

### @MaskSensitive Usage

The `@MaskSensitive` annotation marks fields that should be masked in logs:

```java
@MaskSensitive
@Column(name = "ip_address")
private String ipAddress;
```

**Masking behavior:**
- IP: `192.168.1.100` -> `192.168.***`
- User-Agent: First 50 chars only
- JSON: Sensitive keys replaced with `[MASKED]`

### AuditAction Enum

```java
public enum AuditAction implements LabeledEnum {
    // Authentication
    LOGIN_SUCCESS,
    LOGIN_FAILURE,
    LOGOUT,
    PASSWORD_CHANGE,

    // Authorization
    ROLE_ASSIGNED,
    ROLE_REVOKED,
    PERMISSION_GRANTED,
    PERMISSION_DENIED,

    // Data access
    DATA_VIEW,
    DATA_EXPORT,

    // CRUD
    ENTITY_CREATED,
    ENTITY_UPDATED,
    ENTITY_DELETED,

    // Security events
    ACCOUNT_LOCKED,
    ACCOUNT_UNLOCKED,
    SUSPICIOUS_ACTIVITY
}
```

### Recording Audit Events

```java
@Service
@RequiredArgsConstructor
public class AuditEventRecorder {

    private final AuditEventRepository repository;

    public void recordLogin(String userId, String ipAddress, boolean success) {
        AuditEvent event = AuditEvent.builder()
            .actorType(ActorType.USER)
            .actorId(userId)
            .action(success ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILURE)
            .ipAddress(ipAddress)
            .build();

        repository.save(event);
    }

    public void recordDataAccess(String userId, String entityType, String entityId) {
        AuditEvent event = AuditEvent.builder()
            .actorType(ActorType.USER)
            .actorId(userId)
            .action(AuditAction.DATA_VIEW)
            .entityType(entityType)
            .entityId(entityId)
            .build();

        repository.save(event);
    }
}
```

---

## Password Security

### Password Field

Never store plain text passwords:

```java
// Password is hashed in service layer, not entity
@Column(name = "password", nullable = false)
private String password;  // BCrypt hash

// Password history for reuse prevention
@Type(JsonType.class)
@Column(name = "password_history", columnDefinition = "TEXT")
private List<String> passwordHistory;

// Failed attempts tracking
@Column(name = "failed_attempts", nullable = false)
@Builder.Default
private Integer failedAttempts = 0;

@Column(name = "locked_until")
private Instant lockedUntil;
```

### Service Layer

```java
@Service
@RequiredArgsConstructor
public class PasswordService {

    private final PasswordEncoder passwordEncoder;
    private static final int MAX_HISTORY = 5;

    public void changePassword(UserAccount user, String newPassword) {
        String hashedPassword = passwordEncoder.encode(newPassword);

        // Check password history
        if (isPasswordReused(user, newPassword)) {
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "Cannot reuse recent passwords", null);
        }

        // Update history
        List<String> history = user.getPasswordHistory();
        if (history == null) history = new ArrayList<>();
        history.add(0, user.getPassword());
        if (history.size() > MAX_HISTORY) {
            history = history.subList(0, MAX_HISTORY);
        }
        user.setPasswordHistory(history);

        // Set new password
        user.setPassword(hashedPassword);
    }

    private boolean isPasswordReused(UserAccount user, String newPassword) {
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            return true;
        }
        if (user.getPasswordHistory() != null) {
            return user.getPasswordHistory().stream()
                .anyMatch(h -> passwordEncoder.matches(newPassword, h));
        }
        return false;
    }
}
```

---

## Access Control Fields

### Entity-Level Access

```java
// Owner
@Column(name = "owner_id")
private String ownerId;

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "owner_id", insertable = false, updatable = false)
private UserAccount owner;

// Organization
@Column(name = "organization_id")
private String organizationId;

// Visibility
@Enumerated(EnumType.STRING)
@Column(name = "visibility", nullable = false)
private Visibility visibility = Visibility.PRIVATE;
```

### Visibility Enum

```java
public enum Visibility implements LabeledEnum {
    PRIVATE,      // Owner only
    ORGANIZATION, // Same organization
    PUBLIC        // Everyone
}
```

---

## Compliance Checklist for Entities

Before creating entities with sensitive data:

| Check | Description |
|-------|-------------|
| [ ] Encryption | Sensitive data encrypted with AES |
| [ ] Hash | Encrypted unique fields have hash for search |
| [ ] GDPR fields | anonymized, retentionExpiresAt, legalHold |
| [ ] Audit | Actions logged via AuditEvent |
| [ ] Access control | ownerId, organizationId, visibility |
| [ ] No plain passwords | BCrypt in service layer |
| [ ] @MaskSensitive | Applied to logged sensitive fields |

---

## Key Management

### Development

Uses static key from properties (never in production):

```yaml
encryption:
  key: ${ENCRYPTION_KEY:development-only-key}
```

### Production Requirements

1. Use Vault or secure key management
2. Key rotation every 90 days
3. Dual-key period: 30 days for transition
4. Never commit keys to repository

---

## See Also

- [Base Entity Patterns](base-entity-patterns.md) - Entity structure
- [Field Types](field-types.md) - Encrypted field types
- CLAUDE.md - Full security guidelines