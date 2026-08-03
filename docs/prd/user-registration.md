# PRD: User Registration (Email + Password)

**App:** `apps/auth`
**Status:** Draft
**Date:** 2026-08-02

> File paths below reflect the pre-restructure layout. See
> [ADR 001: Module Structure](../adr/001-module-structure.md) for the
> current location of this logic (`modules/register/`, `repositories/`, `lib/`).

## 1. Summary

Add a registration endpoint to `apps/auth` that lets a business owner create an
account using email and password. This PRD covers account creation only — it
does not cover login/session issuance, business/store setup, or email
verification, all of which are explicitly deferred (see [Out of Scope](#5-out-of-scope)).

## 2. Background

`apps/auth` is a Cloudflare Worker (Hono) currently exposing only a `/health`
endpoint. `packages/database` already defines a schema (`user`, `session`,
`account`, `verification`) shaped after common auth-library conventions, but
no auth library is installed — this feature is implemented directly against
that schema using Hono + Drizzle.

The Worker runs on **Cloudflare Workers Free tier**, which caps CPU time at
10ms per request. This constrains the password hashing parameters (see
[Password Hashing](#43-password-hashing)).

## 3. Goals

- Let a business owner create an account with `name`, `email`, and `password`.
- Store credentials securely, using a hashing approach compatible with the
  Workers runtime and its CPU budget.
- Return a clear, well-formed response on success and on validation/conflict
  errors.

## 4. Functional Requirements

### 4.1 Endpoint

`POST /auth/register/email`

**Request body:**

```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

No `confirmPassword` field — password confirmation is a client-side UX
concern, not enforced by the API.

### 4.2 Validation

Validated using `valibot` (new dependency) via Hono's validator middleware.

| Field    | Rules                                                              |
|----------|---------------------------------------------------------------------|
| `name`   | required, non-empty string                                         |
| `email`  | required, valid email format; trimmed and lowercased before use    |
| `password` | required, minimum 8 characters, no complexity rules enforced     |

**On validation failure:** `400 Bad Request`

```json
{
  "message": "string",
  "error": {
    "email": "string",
    "password": "string"
  }
}
```

Only the fields that failed validation are included under `error`.

### 4.3 Password Hashing

- **Algorithm:** PBKDF2-SHA256 via the Workers runtime's native `crypto.subtle`
  (Web Crypto API). No external or WASM dependency.
- **Iterations:** 50,000.
  - OWASP's current recommendation for PBKDF2-SHA256 is 600,000 iterations.
    Benchmarking (`crypto.subtle.deriveBits`, V8) showed 100,000 iterations
    alone consumes ~10.8ms — the *entire* Workers Free tier CPU budget — with
    no headroom for request parsing, validation, or the DB call's non-I/O
    work. 50,000 iterations (~5.5ms) was chosen to leave safety margin under
    the 10ms cap.
  - **This is a documented trade-off, not an oversight.** Offline
    brute-force resistance is weaker than OWASP's baseline recommendation as
    a direct consequence of the Free tier's CPU constraint. Upgrading to
    Workers Paid (30s CPU budget) would remove this constraint and is a
    reasonable future follow-up, but is not required by this PRD.
- **Storage:** salt and derived hash are stored together in
  `account.password` (a single `text` column), in a self-describing format,
  e.g. `pbkdf2-sha256$50000$<saltBase64>$<hashBase64>`, so the algorithm and
  parameters travel with the hash and can be changed/rotated later without
  breaking existing rows.

### 4.4 Account Creation

On successful validation, with no existing account for the (normalized)
email:

1. Insert a `user` row (`name`, `email`, `emailVerified: false` — the
   schema's default; not set to `true` here since email verification is
   deferred, not abandoned).
2. Insert an `account` row linked via `userId`, with `providerId:
   "credential"`, `accountId: <user.id>`, and the hashed `password`.
3. Both inserts happen in a single transaction — if either fails, neither
   persists.

**No session or token is issued.** Session/JWT issuance is separate future
work; this endpoint's job ends at confirming the account was created.

### 4.5 Success Response

`201 Created`

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "createdAt": "string (ISO 8601)"
}
```

Password/hash is never included in the response.

### 4.6 Duplicate Email

If a `user` with the normalized email already exists:

`409 Conflict`

```json
{
  "message": "Email already registered."
}
```

This is an explicit, non-ambiguous error. Account enumeration via this
endpoint is an accepted trade-off for this product (B2B, not high-sensitivity
consumer auth) in exchange for clearer UX; it is not addressed here for
login/password-reset flows, which may warrant different treatment.

## 5. Out of Scope

Explicitly deferred, not part of this PRD:

- **Business/store entity creation.** Registration creates only a `user` +
  `account`. No `business`/`store`/tenant table or linkage.
- **Login and session/JWT issuance.** To be designed and implemented
  separately.
- **Email verification.** `user.emailVerified` remains `false` after
  registration; no verification email is sent, no email-sending service is
  integrated. Accounts are immediately usable once session/login exists.
- **OAuth / social login.** Only email+password for now. The `account` table
  supports multiple providers, and `/auth/register/<provider>` is a natural
  future path, but no additional provider is built here.
- **Rate limiting / bot protection.** No IP-based rate limiting or CAPTCHA
  (e.g. Turnstile) on this endpoint.
- **CORS configuration.** No frontend exists yet in this monorepo; CORS will
  be added when a calling origin is known.
- **Automated tests.** Not specified as part of this PRD.
- **Breach-list / complexity password rules.** Length-only policy (≥8 chars).

## 6. Open Follow-Ups (Not Blocking This PRD)

- Consider upgrading to Workers Paid tier to allow stronger PBKDF2 iteration
  counts (or migrating to a memory-hard algorithm like Argon2id via WASM).
- Design session/JWT issuance (referenced in this PRD's Q&A as "set up
  later").
- Design email verification flow once an email-sending provider is chosen.
- Design rate limiting (Workers Rate Limiting API is a natural fit) once
  abuse is observed or before wider launch.
- Design business/store entity and its relationship to `user`.
