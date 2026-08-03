# PRD: Login Endpoint & JWT Wiring (Login + Register)

**App:** `apps/auth`
**Status:** Draft
**Date:** 2026-08-03

> File paths below reflect the pre-restructure layout. See
> [ADR 001: Module Structure](../adr/001-module-structure.md) for the
> current location of this logic (`modules/login/`, `repositories/`, `lib/session.ts`
> is now `createSession`, no longer `issueSession`).

## 1. Summary

Add a login endpoint (`POST /auth/login/email`) to `apps/auth`, and wire the
existing registration endpoint (`POST /auth/register/email`) up to issue
tokens on success too, so both endpoints return an authenticated session
(access token + refresh token) rather than register being a dead end that
requires a separate login call. Refresh tokens are tracked in the `session`
table so they can be revoked later, even though no endpoint yet reads or
deletes those rows (see [Out of Scope](#5-out-of-scope)).

## 2. Background

[`jwt-util.md`](./jwt-util.md) added `signAccessToken` / `signRefreshToken` /
`verifyAccessToken` / `verifyRefreshToken` in `src/lib/jwt.ts` as a pure,
callerless utility, and explicitly deferred "the login endpoint" and
"session-table integration" as its next follow-ups. [`user-registration.md`](./user-registration.md)
shipped account creation but deferred "session/JWT issuance" entirely — a
successful registration currently returns just `{ id, name, email,
createdAt }` with no way to become authenticated except a login endpoint
that doesn't exist yet.

This PRD is that follow-up: it adds the login endpoint, makes both login and
register issue tokens, and decides (for the first time) how refresh tokens
relate to the `session` table.

## 3. Goals

- Let a user authenticate with email + password and receive an access token
  and a refresh token.
- Make registration itself return an authenticated session, so a client
  doesn't need to immediately call login after registering.
- Track issued refresh tokens in the `session` table via a `jti` claim, so a
  future revocation/logout mechanism has something to act on, without
  building that mechanism now.
- Keep login's failure responses free of account-enumeration signal, in
  contrast to registration's `409`, which is unavoidably enumerable by
  design.
- Share the token-issuance + session-write logic between login and register
  through one library function, rather than duplicating it.

## 4. Functional Requirements

### 4.1 `verifyPassword` (`src/lib/password.ts`)

Add a `verifyPassword(password: string, stored: string): Promise<boolean>`
alongside the existing `hashPassword`:

- Parses the `algorithm$iterations$saltBase64$hashBase64` format written by
  `hashPassword`. Any parse failure (unexpected format, unknown algorithm)
  returns `false` rather than throwing.
- Re-derives a hash from `password` using the stored salt and iteration
  count (via the existing `derive` helper).
- Compares the derived hash to the stored hash in **constant time** (a
  manual byte-by-byte accumulated-XOR compare — the Workers runtime has no
  `crypto.timingSafeEqual`), not `===`/string equality, to avoid leaking
  match-progress via response timing.
- Returns `true` only on an exact, constant-time match.

### 4.2 `issueSession` (new `src/lib/session.ts`)

A shared helper used by both register and login:

```ts
function issueSession(
  db: DrizzleClient,
  userId: string,
  secret: string,
  meta: { ipAddress: string | null; userAgent: string | null },
): Promise<{ accessToken: string; refreshToken: string }>
```

Behavior:

1. Generate a session id: `const sessionId = uuidv7()`.
2. Sign tokens:
   - `signAccessToken({ sub: userId }, secret)` — no `jti`; access tokens
     are never looked up in the DB.
   - `signRefreshToken({ sub: userId, jti: sessionId }, secret)`.
3. Insert a `session` row:
   - `id`: `sessionId`
   - `token`: `sessionId` (same value — see [4.3](#43-session-row-shape))
   - `userId`: `userId`
   - `expiresAt`: `now + 2,592,000s` (30 days, matching the refresh token's
     TTL — computed independently here, not parsed back out of the signed
     token)
   - `ipAddress`, `userAgent`: passed through from `meta`
4. Return `{ accessToken, refreshToken }`.

This function does not verify anything or check for an existing session —
it unconditionally issues a new one. Multiple concurrent sessions per user
are allowed; a new login does not invalidate previously issued sessions.

### 4.3 Session row shape

`session.token` is set to the **same** uuidv7 value as `session.id`, and
that same value is embedded as the refresh token's `jti` claim. There is no
independently-generated secret for the `token` column — `id` is already
128 bits of randomness, and `jti` was never meant to be secret (the token's
HMAC signature is what makes it unforgeable). This keeps the schema decoupled
from JWT payload size: a future revocation/refresh endpoint looks up
`session` by `jti` from the decoded (not yet necessarily trusted-for-auth)
refresh token, rather than by matching the full token string against
`session.token`.

`ipAddress` / `userAgent` are read from the request (`CF-Connecting-IP` and
`User-Agent` headers) by the calling route and passed into `issueSession`;
either may be `null` if absent.

### 4.4 `POST /auth/register/email` changes

Existing validation, duplicate-email check, and `user`/`account` transaction
are unchanged. After the transaction commits, call `issueSession` and
include its result in the response:

`201 Created`

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "createdAt": "string (ISO 8601)",
  "accessToken": "string",
  "refreshToken": "string"
}
```

### 4.5 `POST /auth/login/email` (new)

**Request body:**

```json
{
  "email": "string",
  "password": "string"
}
```

Validated via the same `validate("json", schema)` middleware pattern as
registration:

| Field      | Rules                                                          |
|------------|-----------------------------------------------------------------|
| `email`    | required, valid email format; trimmed and lowercased            |
| `password` | required, non-empty (no minimum length — that's a signup-time policy, not a login-time check) |

**On validation failure:** `400 Bad Request`, same shape as registration's
validation error response.

**Authentication logic:**

1. Look up `user` by the normalized email.
2. If found, look up `account` where `userId` matches and `providerId =
   "credential"`.
3. If both are found and `account.password` is non-null, call
   `verifyPassword(password, account.password)`.
4. If any step fails (no user, no credential account, null password, or
   `verifyPassword` returns `false`), respond identically — see
   [4.6](#46-login-failure-response).
5. On success, call `issueSession` and return its result.

`emailVerified` is **not** checked — since no verification flow exists yet
(per the registration PRD), gating login on it would make every account
permanently unusable rather than enforce anything meaningful.

**Success response:** `200 OK`

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "createdAt": "string (ISO 8601)",
  "accessToken": "string",
  "refreshToken": "string"
}
```

Mirrors register's response shape exactly, so client code has one
"authenticated session" response to parse regardless of which endpoint
produced it.

### 4.6 Login failure response

Every authentication failure — unknown email, no credential account, or
wrong password — returns the **same** response, with no distinguishing
detail:

`401 Unauthorized`

```json
{
  "message": "Invalid email or password."
}
```

This is a deliberate departure from registration's `409` (which
intentionally confirms whether an email is registered, an accepted
trade-off per the registration PRD). Login is a higher-value target for
credential-stuffing/enumeration, so it gets the stricter, generic contract.

## 5. Out of Scope

Explicitly deferred, not part of this PRD:

- **Logout endpoint.** No route deletes a `session` row. Sessions accumulate
  until they expire naturally (30 days); nothing revokes them early.
- **Refresh endpoint.** No route accepts a refresh token and issues a new
  access token. `verifyRefreshToken` remains uncalled in application code.
- **Auth middleware.** No route reads a bearer token off incoming requests
  to protect itself. `verifyAccessToken` remains uncalled in application
  code.
- **Rate limiting / bot protection** on `/auth/login/email`, consistent with
  the registration PRD's deferral of the same for `/auth/register/email`.
- **Cookie-based token delivery.** Both tokens are returned in the JSON
  response body only; no `Set-Cookie` handling.
- **`emailVerified` enforcement.** Not checked at login.
- **Session cleanup job.** Expired `session` rows are not proactively
  deleted by any scheduled process.
- **Automated tests**, consistent with both prior PRDs' precedent.
- **Editing `jwt-util.md` / `user-registration.md`.** Both remain as-written,
  dated snapshots; this PRD supersedes their relevant "Open Follow-Ups"
  items by existing, without retroactively editing them.

## 6. Open Follow-Ups (Not Blocking This PRD)

- Design a refresh endpoint (`POST /auth/refresh` or similar) that verifies
  a presented refresh token, looks up its `session` row by `jti`, and issues
  a new access token — deciding along the way whether to rotate the refresh
  token/`session` row or leave it as-is.
- Design a logout endpoint that deletes the `session` row matching a
  presented refresh token's `jti`.
- Design auth middleware for protecting future routes with
  `verifyAccessToken`.
- Design rate limiting for `/auth/login/email` (and reconsider it for
  `/auth/register/email`) once abuse is observed or before wider launch.
- Reconsider single-session-per-user or per-device-type session limits if a
  real product need for it emerges (this PRD allows unlimited concurrent
  sessions).
- Reconsider cookie-based refresh token delivery (`httpOnly`, `Secure`,
  scoped `SameSite`) once a concrete browser client with a known
  origin/CORS relationship to `apps/auth` exists.
- Add a scheduled cleanup job for expired `session` rows.
- Add automated tests for both endpoints (credential verification,
  timing-safe comparison, unified error response, session-row shape) once
  test coverage becomes a priority.
