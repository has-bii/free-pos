# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `apps/auth`-specific details.

## What this is

`@repo/auth` (Worker name `sero-pos-auth`): a Cloudflare Workers service built on Hono, providing email/password authentication (register, login, refresh, `/me`) plus a `/health` DB check. Deployed from the `production` branch (see `.github/workflows/deploy.yml`).

Access and refresh tokens are HS256 JWTs delivered as `httpOnly` cookies (never in a JSON response body) — signing/verification, the `requireAuth` middleware, and the cookie helpers live in `@repo/auth-kit` (`../../packages/auth-kit`), which this app depends on rather than reimplementing. See that package's own `CLAUDE.md` for what's in it.

## Commands

```
pnpm dev            # wrangler dev, http://localhost:8787
pnpm deploy          # wrangler deploy
pnpm lint            # biome check .
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest run — needs .env.test, see Testing below
pnpm test -- path/to/file.test.ts    # single file
pnpm test -- -t "name"               # single test by name
```

Run these from `apps/auth/`, or from the repo root with `pnpm --filter @repo/auth <script>`.

## Local setup

Copy `.dev.vars.example` to `.dev.vars` and fill in:
- `SERO_POS_DATABASE_URL` — TiDB connection string (see `packages/database/.env.example` for the required format/ssl param)
- `SERO_POS_JWT_SECRET` — HS256 signing secret
- `SERO_POS_FRONTEND_ORIGIN` — exact-match origin allowed by CORS (e.g. the frontend's local dev URL); required in every environment
- `SERO_POS_COOKIE_DOMAIN` — access-token cookie `Domain`. Leave empty in `.dev.vars` (host-only cookie, matching how the shared `sero-pos.com` registrable domain doesn't exist locally); set to `.sero-pos.com` in prod via `wrangler secret put SERO_POS_COOKIE_DOMAIN`

All four are set on the production Worker via `wrangler secret put <NAME>` (see the comment in `wrangler.jsonc`) — none of them appear there, `vars` is unused.

`worker-configuration.d.ts` is wrangler-generated (`pnpm cf-typegen`) and declares the `CloudflareBindings` type consumed by `AppEnv` in `src/factory.ts`. Re-run `cf-typegen` after adding/renaming a binding in `.dev.vars` or `wrangler.jsonc`.

## Testing

`test/` holds HTTP route tests that run the real Worker in workerd (`@cloudflare/vitest-pool-workers`) against a **real TiDB database**. There are no unit tests and no mocks — requests go through the Worker's real entry point via the loopback binding, exercising the whole middleware chain, and assertions check the response *and* the rows that were written.

Use `exports.default.fetch()` and `env` from `cloudflare:workers`, wrapped by `test/helpers/http.ts`. The `SELF` and `env` exports from `cloudflare:test` do the same thing but are deprecated as of `@cloudflare/vitest-pool-workers@0.20.1` — don't reintroduce them.

### One-time setup

1. Create a database on your TiDB cluster with `test` in its name — e.g. `CREATE DATABASE sero_pos_test;`. The name is not cosmetic: `test/setup.ts` refuses to run against anything else, because teardown issues `DELETE`s.
2. Apply migrations to it: point `DATABASE_URL` in `packages/database/.env` at the new database and run `pnpm --filter @repo/database db:migrate`. Test runs never perform DDL, so this is manual — after adding a migration, re-run it or `test/setup.ts`'s drift guard refuses to start the suite (see Known limits).
3. `cp .env.test.example .env.test` and set `TEST_DATABASE_URL` to that same connection string.

`vitest.config.ts` injects `TEST_DATABASE_URL` as the Worker's `SERO_POS_DATABASE_URL` binding and hardcodes `SERO_POS_JWT_SECRET` (tests hand-sign an expired token, so they need the key), `SERO_POS_FRONTEND_ORIGIN`, and `SERO_POS_COOKIE_DOMAIN` (empty, exercising the host-only path). These `miniflare.bindings` override `.dev.vars`, so a test run never touches your dev database.

### Writing tests

- **Every test mints its own email**: `` const email = `t-${crypto.randomUUID()}@test.invalid` `` via `uniqueEmail()`. Nothing is truncated between tests and files run in parallel, so a hardcoded address is a latent flake — reject it in review.
- Track every email you create and delete it in `afterAll` with `deleteTestUsersByEmail`. Deleting the `user` row cascades to `account` and `session`.
- Seed fixtures through `registerUser()` (which calls the real `POST /register/email`), never by inserting rows. `test/helpers/db.ts` is for teardown and assertions only.
- Registering costs a real 50,000-iteration PBKDF2 hash plus TiDB round-trips, so share one fixture per file via `beforeAll` where the test doesn't need a fresh user. Timeouts are raised to 20s for this reason.
- If a run is killed mid-suite, `t-*@test.invalid` rows survive. Harmless; clear them with `DELETE FROM user WHERE email LIKE 't-%@test.invalid'`.
- **Tokens live in cookies, not the response body or `Authorization` header.** `test/helpers/http.ts`'s `CookieJar`/`TestClient` stand in for a browser: `registerUser()` returns a `client` (a `TestClient`) that already carries the `Set-Cookie` cookies from registration, and `client.get`/`client.post`/`client.postJson` replay whatever cookies in its jar apply to the request path — including respecting the refresh cookie's `Path=/refresh` scoping, so a `client.post("/refresh")` attaches it automatically while a `client.get("/me")` does not. Grab a raw cookie value with `client.jar.get(ACCESS_TOKEN_COOKIE_NAME)` (from `@repo/auth-kit/cookies`) when a test needs to replay it manually — e.g. via the stateless `get`/`post` + `cookieHeader(name, value)` helpers — to hand-craft a forged/expired/garbage token, or to prove a token remains valid after the cookie instructing the browser to drop it has been cleared (see `logout.test.ts`'s idempotency case).

### Known limits

- **Runs in CI** against the same kind of test database, via the `TEST_DATABASE_URL` repo secret. Two things to know: the var must stay declared in `turbo.json`'s `test` task (turbo's strict env mode drops undeclared vars *silently*, and the suite would fail on the "not set" guard), and PRs from forks don't get repo secrets, so both the migrate step and the suite fail there by design.
- **CI applies migrations for you.** A step in `.github/workflows/ci.yml` runs `pnpm --filter @repo/database db:migrate` against the test database (via `DATABASE_URL`, drizzle-kit's own env var) before the turbo step, so a PR that adds a migration doesn't need manual intervention. Locally, `test/setup.ts` carries a third guard that compares `packages/database/drizzle/meta/_journal.json`'s entry count against the applied-migrations row count in the test database and throws with the `db:migrate` command to run if you're behind — so a stale local test database fails fast with an instruction instead of a column-not-found error mid-suite.
- `pnpm typecheck` *does* cover `test/` (one `tsc --noEmit` pass over the package), so a broken test still fails the lefthook pre-commit hook.
- `vitest.config.ts` re-declares both the `@repo/auth/*` → `src/*` and `@repo/auth-kit/*` → `../../packages/auth-kit/src/*` mappings as Vite `resolve.alias` entries, because Vite does not read tsconfig `paths` the way wrangler's bundler does. Keep all three (this file, `tsconfig.json`, and `packages/auth-kit/tsconfig.json`) in sync.
- Deliberate coverage gaps, not currently exercised by any test: `verifyPassword`'s early returns, the `/health` 503 branch, `onError`, and the `EmailAlreadyExistsError` race.

## Structure

```
src/
  index.ts                 # app entry: CORS + db middleware, all module routes mounted at root; exports AppWithErrors (RPC type)
  factory.ts                # createFactory<AppEnv>() — shared Bindings/Variables typing; exports AppEnv
  errors.ts                 # typed domain errors (e.g. EmailAlreadyExistsError)
  lib/                      # framework-agnostic helpers: password.ts, session.ts, request.ts
  middleware/                # db.ts (attaches c.var.db), validate.ts (valibot)
  modules/<name>/            # *.schema.ts, *.handlers.ts, *.routes.ts — see Module layout below
  repositories/*.repository.ts   # only code that imports Drizzle tables from @repo/database
```

JWT signing/verification and `requireAuth` live in `@repo/auth-kit`, not under `src/` here — see `../../packages/auth-kit/CLAUDE.md`.

Adding a new authenticated endpoint: create a `modules/<name>/` following the `me` module as the minimal template — `factory.createHandlers(requireAuth<AppEnv>((c) => c.env.SERO_POS_JWT_SECRET), async (c) => ...)`, no request body validation needed — or `register`/`login` for one that validates a JSON body and touches multiple repositories in a transaction. `requireAuth` is imported from `@repo/auth-kit/middleware/auth` and instantiated inline at each call site (there is no local `apps/auth/src/middleware/auth.ts` wrapper); `AppEnv` comes from `@repo/auth/factory`.

## Module layout (per feature, e.g. `modules/register/`)

- `*.schema.ts` — valibot input schema.
- `*.handlers.ts` — `factory.createHandlers(validate(...), async (c) => ...)`; business logic lives here, talking to repositories, never to Drizzle tables directly.
- `*.routes.ts` — thin: `factory.createApp().post("/path", ...handlers)`, mounted in `src/index.ts` via `.route("/", xRoutes)`.

## Repositories (`src/repositories/*.repository.ts`)

Plain object literals of async methods (`export const X = { ... }`) that are the *only* code allowed to import Drizzle table objects from `@repo/database` and run queries. They accept a `DatabaseExecutor` (`Database | Transaction`, defined in `factory.ts`) so the same method works inside or outside a `db.transaction(...)` — see `register.handlers.ts` for a multi-table transaction (`user` + `account` insert) example. DB-level constraint violations (e.g. duplicate email) are translated into typed errors (`src/errors.ts`, e.g. `EmailAlreadyExistsError`) at the repository boundary, not left as raw driver errors for handlers to inspect.

## Auth flow

- Passwords: PBKDF2-SHA256 via Web Crypto, implemented as the `Password` namespace in `src/lib/password.ts`. Iteration count is deliberately capped for the Workers free-tier 10ms CPU budget — see the comment there before changing `ITERATIONS`.
- Tokens: short-lived access token + long-lived refresh token, both HS256 JWTs signed/verified by `@repo/auth-kit/jwt`'s `JWT` namespace (see `packages/auth-kit/CLAUDE.md`). `JWT.REFRESH_TOKEN_TTL_SECONDS` is the single source of truth for the refresh TTL — both `Session.createSession` and `Session.rotateSession` (`src/lib/session.ts`) compute the `session` row's `expiresAt` from it directly.
- Tokens are delivered as `httpOnly`, `Secure`, `SameSite=Lax` cookies — `sero_pos_access_token` (`Path=/`, optionally `Domain=.sero-pos.com` in prod so any `*.sero-pos.com` service receives it) and `sero_pos_refresh_token` (`Path=/refresh`, always host-only). Never returned in a JSON response body. `login.handlers.ts`/`register.handlers.ts` set both via `setAuthCookies` (`@repo/auth-kit/cookies`) after creating the session; `refresh.handlers.ts` sets fresh ones on a successful rotation and clears both (`clearAuthCookies`) on any failure path, so a dead refresh token doesn't linger in the browser; `logout.handlers.ts` clears both unconditionally.
- CORS (`hono/cors`, mounted in `index.ts`) exact-matches `Origin` against `SERO_POS_FRONTEND_ORIGIN` and sets `credentials: true` — required for the browser to send/receive cookies cross-origin from `app.sero-pos.com`. No separate CSRF token: `SameSite=Lax` is the sole defense, which works because `app.sero-pos.com` and `auth.sero-pos.com` share the registrable domain `sero-pos.com` and so are same-site.
- Sessions are rows in the `session` table keyed by a `uuidv7` `id` that is the stable session identity and never changes. `token` is a separate `uuidv7`, the rotating credential embedded as the refresh JWT's `jti`; `id` is embedded as `sid` in both tokens. `POST /refresh` (`modules/refresh/`) reads the presented refresh token from its cookie (no JSON body — there's no `refresh.schema.ts`), verifies it, then `SessionRepository.rotateToken` does a compare-and-swap on `token` (matching on the old value, writing a new `token` + `expiresAt`) so a replayed/stale refresh token fails closed — see the comments in `src/lib/session.ts` and `session.repository.ts` for the invariants this depends on.
- `requireAuth` (`@repo/auth-kit/middleware/auth`) reads the access token from its cookie and sets `c.var.userId`/`c.var.sessionId`; it does not touch the DB. Handlers needing the full user row still look it up via `UserRepository.findById`.
- `requestMeta(c)` (`src/lib/request.ts`) extracts `CF-Connecting-IP` / `User-Agent` for session metadata.

## Known limitations (see `docs/prd/httponly-cookie-auth.md`)

- **Concurrent refresh race**: two parallel requests hitting an expired access token can both trigger `/refresh`; only the first CAS wins, the second gets a spurious 401. Not solved server-side — the frontend's API client must coalesce concurrent refresh triggers into one in-flight request.
- **Shared HS256 secret**: widening the access-token cookie's `Domain` to `.sero-pos.com` means every future verifying service needs `SERO_POS_JWT_SECRET` distributed to it. Deferred until a second service actually exists (would move to RS256/JWKS).

## Conventions specific to this app

- Routes are mounted at the root in `index.ts` (`.route("/", xRoutes)`) — the service is deployed on its own `auth.sero-pos.com` subdomain, so an individual `*.routes.ts` file defines paths directly (e.g. `/register/email`), with no additional prefix.
- Handlers return **only** `c.json(...)`; there's no shared response envelope helper — the `{ message, data }` shape used in `register`/`login`/`me` handlers is convention, not enforced by a type, so match it when adding endpoints.
- Repositories translate constraint violations into errors from `src/errors.ts` (see `UserRepository.insert`'s `ER_DUP_ENTRY` handling) — handlers catch these typed errors rather than inspecting driver error codes/messages themselves.
- `login`/`register` currently pass `{ ipAddress: null, userAgent: null }` into `createSession` rather than `requestMeta(c)` from `src/lib/request.ts` — if you touch session creation, check whether wiring `requestMeta` in is in scope for that change.
- `index.ts` exports `AppWithErrors`, a `typeof app` augmented via Hono's `ApplyGlobalResponse` with an explicit 400 shape (`{ message: string, error: Record<string, unknown> }`) — this is the type `apps/frontend` imports for its `hc()` RPC client (see `apps/frontend/CLAUDE.md`'s API client section), so it's a real consumer contract now, not just an internal type. `validate.ts`'s 400 body shape (`error[field] = { message: issue.message }`, first issue per field) is what that annotation describes — keep both in sync if either changes. Importing this type pulls this app's whole source tree into `apps/frontend`'s typecheck (see the root `CLAUDE.md`'s "Cross-runtime source-path imports" note) — a change here that's fine under this app's own tsconfig can still break `apps/frontend#typecheck`.
