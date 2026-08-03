# PRD: JWT Util (Access & Refresh Tokens)

**App:** `apps/auth`
**Status:** Draft
**Date:** 2026-08-03

## 1. Summary

Add a JWT utility module to `apps/auth` for generating and verifying two
distinct token types — short-lived **access tokens** and longer-lived
**refresh tokens**. This PRD covers the signing/verification utility only —
it does not cover a login endpoint, refresh/logout endpoints, auth
middleware, or session-table-based revocation, all of which are explicitly
deferred (see [Out of Scope](#5-out-of-scope)).

## 2. Background

`apps/auth` currently exposes `/health` and `POST /auth/register/email`
(see [`user-registration.md`](./user-registration.md)), which explicitly
deferred "session/JWT issuance" as separate future work. This PRD is that
follow-up, scoped specifically to the JWT utility itself so that a future
login/session endpoint has a tested, reusable primitive to call rather than
inventing JWT handling inline.

The Worker runs on Cloudflare Workers, so the implementation must be
compatible with the Workers runtime (Web Crypto, no Node built-ins).
`@tsndr/cloudflare-worker-jwt` was chosen: a zero-dependency library
purpose-built for Cloudflare Workers. (Hono, already a dependency, ships its
own `hono/utils/jwt`, and `jose` is the broader industry-standard option —
both were considered, but `@tsndr/cloudflare-worker-jwt` is the selected
approach for this util.)

## 3. Goals

- Provide a small, well-defined utility for signing and verifying access and
  refresh tokens.
- Make it structurally impossible for a refresh token to be accepted where
  an access token is expected, or vice versa, via a `type` claim stamped at
  signing time and enforced at verification time.
- Keep the utility a pure function of `(payload, secret)` — no environment
  or database access — so it stays trivially testable and reusable by
  whatever login/refresh endpoint calls it later.

## 4. Functional Requirements

### 4.1 Dependency

Add `@tsndr/cloudflare-worker-jwt` (`^3.2.2`) to the `catalog:` block in
`pnpm-workspace.yaml`, and reference it via `catalog:` in
`apps/auth/package.json`.

### 4.2 File location

`apps/auth/src/lib/jwt.ts` (mirrors the existing `src/lib/password.ts`
pattern).

### 4.3 Algorithm & secret

- **Algorithm:** HS256.
- **Secret:** a single shared secret used for both token types,
  `SERO_POS_JWT_SECRET`. Passed explicitly into every function call as a
  parameter — the util does not read `c.env` internally, keeping it a pure
  function.
- Because access and refresh tokens share one secret, the `type` claim
  check (below) is the *only* thing preventing a refresh token from being
  accepted as an access token or vice versa. It must be enforced
  unconditionally, not treated as optional defense-in-depth.

### 4.4 Payload type

```ts
export type JwtPayload = { sub: string } & Record<string, unknown>
```

`sub` (the user id) is required on every token; any additional claims a
future caller needs (role, business id, etc.) are passed through untyped.

### 4.5 API

```ts
function signAccessToken(payload: JwtPayload, secret: string): Promise<string>
function signRefreshToken(payload: JwtPayload, secret: string): Promise<string>
function verifyAccessToken(token: string, secret: string): Promise<JwtPayload | null>
function verifyRefreshToken(token: string, secret: string): Promise<JwtPayload | null>
```

- **`signAccessToken`** — stamps `exp = now + 900s` (15 minutes) and
  `type: "access"` into the payload before signing. Returns the signed
  token string.
- **`signRefreshToken`** — stamps `exp = now + 2,592,000s` (30 days) and
  `type: "refresh"` into the payload before signing. Returns the signed
  token string.
- **`verifyAccessToken`** — verifies signature and standard claims (`exp`,
  `nbf`, `iat`) via the library, then checks `payload.type === "access"`.
  Returns the decoded payload on success; returns `null` on any failure.
- **`verifyRefreshToken`** — same as above but requires
  `payload.type === "refresh"`.

### 4.6 Failure contract

Both verify functions **never throw** for expected failure modes — invalid
signature, expired token, malformed token, or wrong `type`. They return
`null` in every such case.

This is a deliberate application-level contract layered on top of the
underlying library, which throws integration errors (e.g. malformed token)
unconditionally and verification errors (expired, bad signature) only when
`throwError: true` is passed. `verifyAccessToken`/`verifyRefreshToken` must
catch and normalize all of these to `null` so callers can rely on a single,
total contract: `null` means "not a valid token of this type," full stop.

### 4.7 Secret provisioning

Add `SERO_POS_JWT_SECRET` to `apps/auth/.dev.vars.example` (placeholder
value) alongside `SERO_POS_DATABASE_URL`, documenting the convention even
though no route reads it yet. The real local value goes in `.dev.vars`
(gitignored, not created by this PRD); the production value is provisioned
via `wrangler secret put` once a real caller exists.

## 5. Out of Scope

Explicitly deferred, not part of this PRD:

- **Login endpoint** (e.g. `POST /auth/login/email`) that calls
  `signAccessToken`/`signRefreshToken`.
- **Refresh endpoint** that calls `verifyRefreshToken` and issues a new
  access token.
- **Logout / token revocation.**
- **Session-table integration.** No linkage between issued tokens and the
  existing `session` table (`id`, `token`, `expiresAt`, `ipAddress`,
  `userAgent` columns). A future PRD can decide whether refresh tokens
  should be tracked there (e.g. via a `jti` claim) to support server-side
  revocation.
- **Auth middleware** that reads a bearer token off incoming requests and
  calls `verifyAccessToken` to protect routes.
- **Automated tests.** Deferred, consistent with the registration PRD's
  precedent.
- **Asymmetric signing (RS256/ES256).** Not needed while `apps/auth` is the
  sole signer and verifier of these tokens.
- **Per-call configurable TTLs.** Access/refresh expiry are fixed constants
  in this version (15 minutes / 30 days); making them caller-configurable
  is not addressed.

## 6. Open Follow-Ups (Not Blocking This PRD)

- Design the login endpoint that authenticates against the `account` table
  and calls `signAccessToken`/`signRefreshToken` (mirrors registration's
  credential-check pattern).
- Design refresh/logout endpoints, and decide whether refresh tokens should
  be tracked in the `session` table for revocation.
- Design auth middleware for protecting future routes with
  `verifyAccessToken`.
- Add automated tests for the util (signature tampering, expiry,
  type-confusion rejection) once test coverage becomes a priority.
- Reconsider algorithm/secret separation (RS256, or per-type secrets) if a
  second service ever needs to verify these tokens independently.
