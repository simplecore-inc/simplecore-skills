# JavaDoc Formatting

The project standard for JavaDoc code examples differs from the Java default in one important way: use `{@code}` inside `<pre>` tags, not bare `<pre>`.

## Rules

- **Code examples**: wrap the block with `<pre>{@code ... }</pre>`
- **Paragraph breaks**: use `<p>` (HTML entity style), not blank lines alone

## Why `{@code}`?

`{@code}` treats `@`, `<`, `>` as literal characters, so you don't have to HTML-escape annotations or generics. Without it, `@Override` inside JavaDoc gets interpreted as a JavaDoc tag and breaks rendering.

## Pattern

```java
/**
 * Creates a new entity.
 *
 * <p>Example usage:
 * <pre>{@code
 * Entity e = service.create(new CreateDTO("name"));
 * e.getId();
 * }</pre>
 *
 * <p>Returns a persisted entity with generated ID.
 */
```

## Anti-Pattern

```java
/**
 * <pre>
 * &#064;Override                     ← Fragile HTML escape
 * public void method() {
 *   List&lt;String&gt; list = ... ;     ← Fragile HTML escape
 * }
 * </pre>
 */
```

Use `<pre>{@code ... }</pre>` and the same code reads naturally as Java source.

---

## When to Write JavaDoc

- **Always**: public API methods in `packages/` (reused by other modules)
- **Always**: complex service methods with non-obvious behavior (transaction boundaries, side effects, error conditions)
- **Always**: non-CRUD controller endpoints (see `non-crud-controller.md` lines 72-77 for example)
- **Skip**: standard CRUD methods that match the canonical shape (the shape IS the documentation)
- **Skip**: private helpers with self-explanatory names and short bodies

## Standard Tags for Service Methods

```java
/**
 * Triggers a full configuration download for the specified controller.
 *
 * <p>Sends all configuration data (SU-01 through SU-14) in topological order.
 * If a previous full download was interrupted, resumes from the last completed phase.
 *
 * @param controllerId the target controller ID
 * @return full download result with transaction ID and start phase
 * @throws SimpliXGeneralException GEN_NOT_FOUND if controller or sync state missing,
 *         GEN_CONFLICT if circuit breaker OPEN or lock unavailable
 */
@Transactional
public FullDownloadResult triggerFullDownload(String controllerId) { ... }
```

### Tag Order

1. Summary sentence (first sentence, ends with period)
2. `<p>` paragraphs for additional context
3. `@param` — one per parameter, in declaration order
4. `@return` — what the method returns (skip for `void`)
5. `@throws` / `@exception` — with `ErrorCode` context for `SimpliXGeneralException`
6. `@see` — cross-references (sparingly)