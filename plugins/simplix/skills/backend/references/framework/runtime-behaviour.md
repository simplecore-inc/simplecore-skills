# What the framework does that the code does not show

Behaviours of the SimpliX runtime that no file in the project states, and that each cost a
session to work out. They are not conventions to follow — they are facts to know before
reading a symptom.

## Contents

1. [The token endpoint takes HTTP Basic, and the spec does not say so](#the-token-endpoint-takes-http-basic-and-the-spec-does-not-say-so)
2. [Token issue has no event — the provider is the only seam](#token-issue-has-no-event--the-provider-is-the-only-seam)
3. [Generated CRUD writes no audit event](#generated-crud-writes-no-audit-event)
4. [Never run a build while the application is running](#never-run-a-build-while-the-application-is-running)

---

## The token endpoint takes HTTP Basic, and the spec does not say so

`POST /auth/token/issue` reads the username and password from an
`Authorization: Basic` header — `SimpliXAuthSecurityConfiguration` says so in a comment on
that path's filter chain, and that comment is the only place it is written down. A **filter**
handles it, not a controller, so springdoc has no method to read and **the generated spec
carries no request body for that path** — reading the API document answers nothing about what
to send.

```bash
curl -s -u '<username>:<password>' -X POST "$API/api/v1/auth/token/issue"
```

**A JSON body comes back 401 `AUTH_INVALID_CREDENTIALS`** — the same code, the same message,
and the same user-facing sentence as a wrong password. So a wrong request **shape** and a
wrong **password** are indistinguishable from the outside, and the natural conclusion from a
run of failures is that the credentials are stale.

Two things make that conclusion look confirmed, and neither is evidence:

- **Every account fails, which reads as "the seed is broken".** Of course they do — the shape
  is wrong for all of them.
- **The log line `Unable to extract username` looks like the explanation and is not.** It comes
  from the audit handler reading the `Authorization` header of a *failed* request; a sign-in
  request legitimately has none, so that line is normal.

**Before concluding a password is wrong, send one request with `-u`.** If it returns 200 and a
token, nothing was ever wrong with the credentials.

## Token issue has no event — the provider is the only seam

`TokenAuditEventPublisher` declares `publishTokenIssueSuccess`, and **no framework code calls
it** (renewal, revocation and refusal are all published). So there is no event to subscribe to
for "a token was issued", and anything that has to happen at issue time — writing a session
row, recording a device — has nowhere to listen.

**Override the provider instead.** `SimpliXJweTokenProvider` is a plain public class whose
`createTokenPair` and `refreshTokens` are both overridable. Four things about doing it:

- **The provider class is itself an `@AutoConfiguration`**, so it registers itself as a bean. A
  `@ConditionalOnMissingBean` factory therefore never wins — **the replacement needs
  `@Primary`.** Without it the context fails to start, and **the failure message names an
  unrelated filter registration**, so the search starts in the wrong place.
- **The two tokens carry no shared claim.** Access and refresh each get their own random
  identifier and nothing links them, so a refresh request cannot be traced to the session it
  belongs to by reading the token. Whatever records the session has to store the refresh
  token's identifier itself — and a revocation check built without that link **silently blocks
  nothing**: a signed-out session refreshes back to life and its expiry moves out a month.
- **Record renewal in the provider, never from the lifecycle event.** `TokenLifecycleEvent`'s
  `REFRESHED` arrives **before** the provider has written the new identifier, and it carries
  only the new one — the previous identifier is not populated. So a listener looking the
  session up by what the event carries never finds it, and a listener that opens a new row when
  it finds nothing **adds one row per refresh**. Those extra rows carry no refresh-token
  identifier, so signing one of them out of a device list does nothing to the real session:
  the screen reports the device signed out and the device keeps working. Only the provider has
  both identifiers and the presented credential at once.
- **Issue now performs a database write**, which changes the timing of anything measuring token
  lifetime. A test that issues a token with a one-second lifetime and validates it immediately
  becomes flaky; widen the lifetime rather than the assertion.

Assert the invariant directly: after one sign-in and one refresh, the session table holds
**one** row.

## Generated CRUD writes no audit event

`SimpliXBaseService`'s create / update / delete write **nothing** to the audit table. Only a
hand-written service that records one does.

The consequence is structural rather than accidental: **a generated entity's history view is
permanently empty.** Updating the record through its own generated endpoint adds no event, so
the screen counts zero and draws zero. It is not lying — it counted — but a zero there reads as
"nobody has ever changed this", and that is the wrong sentence.

So before building a history surface over a generated entity, decide who writes the event.
Where nothing does yet, say so on the screen rather than letting an honest zero stand in for a
history.

## Never run a build while the application is running

`bootRun` holds the build output open, and a `build` in the same tree replaces the classes
under it — the running application then dies with `NoClassDefFoundError` on the next class it
had not yet loaded. The error names a class and says nothing about the build that removed it,
so it reads as a missing dependency.

Stop the application, build, start it again. This is the backend half of the same rule the
frontend has for typechecking against a running dev server.
