# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `apps/auth`-specific details.

## What this is

`@repo/auth` (Worker name `sero-pos-auth`): a Cloudflare Workers service built on Hono, providing email/password authentication (register, login, `/me`) plus a `/health` DB check. Deployed from the `production` branch (see `.github/workflows/deploy.yml`).

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

`worker-configuration.d.ts` is wrangler-generated and declares the `CloudflareBindings` type consumed by `AppEnv` in `src/factory.ts`.

## Testing

`test/` holds HTTP route tests that run the real Worker in workerd (`@cloudflare/vitest-pool-workers`) against a **real TiDB database**. There are no unit tests and no mocks — requests go through the Worker's real entry point via the loopback binding, exercising the whole middleware chain, and assertions check the response *and* the rows that were written.

Use `exports.default.fetch()` and `env` from `cloudflare:workers`, wrapped by `test/helpers/http.ts`. The `SELF` and `env` exports from `cloudflare:test` do the same thing but are deprecated as of `@cloudflare/vitest-pool-workers@0.20.1` — don't reintroduce them.

### One-time setup

1. Create a database on your TiDB cluster with `test` in its name — e.g. `CREATE DATABASE sero_pos_test;`. The name is not cosmetic: `test/setup.ts` refuses to run against anything else, because teardown issues `DELETE`s.
2. Apply migrations to it: point `DATABASE_URL` in `packages/database/.env` at the new database and run `pnpm --filter @repo/database db:migrate`. Test runs never perform DDL, so this is manual — after adding a migration, re-run it or `test/setup.ts`'s drift guard refuses to start the suite (see Known limits).
3. `cp .env.test.example .env.test` and set `TEST_DATABASE_URL` to that same connection string.

`vitest.config.ts` injects `TEST_DATABASE_URL` as the Worker's `SERO_POS_DATABASE_URL` binding and hardcodes `SERO_POS_JWT_SECRET` (tests hand-sign an expired token, so they need the key). These `miniflare.bindings` override `.dev.vars`, so a test run never touches your dev database.

### Writing tests

- **Every test mints its own email**: `` const email = `t-${crypto.randomUUID()}@test.invalid` `` via `uniqueEmail()`. Nothing is truncated between tests and files run in parallel, so a hardcoded address is a latent flake — reject it in review.
- Track every email you create and delete it in `afterAll` with `deleteTestUsersByEmail`. Deleting the `user` row cascades to `account` and `session`.
- Seed fixtures through `registerUser()` (which calls the real `POST /auth/register/email`), never by inserting rows. `test/helpers/db.ts` is for teardown and assertions only.
- Registering costs a real 50,000-iteration PBKDF2 hash plus TiDB round-trips, so share one fixture per file via `beforeAll` where the test doesn't need a fresh user. Timeouts are raised to 20s for this reason.
- If a run is killed mid-suite, `t-*@test.invalid` rows survive. Harmless; clear them with `DELETE FROM user WHERE email LIKE 't-%@test.invalid'`.

### Known limits

- **Runs in CI** against the same kind of test database, via the `TEST_DATABASE_URL` repo secret. Two things to know: the var must stay declared in `turbo.json`'s `test` task (turbo's strict env mode drops undeclared vars *silently*, and the suite would fail on the "not set" guard), and PRs from forks don't get repo secrets, so both the migrate step and the suite fail there by design.
- **CI applies migrations for you.** A step in `.github/workflows/ci.yml` runs `pnpm --filter @repo/database db:migrate` against the test database (via `DATABASE_URL`, drizzle-kit's own env var) before the turbo step, so a PR that adds a migration doesn't need manual intervention. Locally, `test/setup.ts` carries a third guard that compares `packages/database/drizzle/meta/_journal.json`'s entry count against the applied-migrations row count in the test database and throws with the `db:migrate` command to run if you're behind — so a stale local test database fails fast with an instruction instead of a column-not-found error mid-suite.
- `pnpm typecheck` *does* cover `test/` (one `tsc --noEmit` pass over the package), so a broken test still fails the lefthook pre-commit hook.
- `vitest.config.ts` re-declares the `@repo/auth/*` → `src/*` mapping as a Vite `resolve.alias`, because Vite does not read tsconfig `paths` the way wrangler's bundler does. Keep the two in sync.
- Deliberate coverage gaps (`verifyRefreshToken`, `verifyPassword`'s early returns, the `/health` 503 branch, `onError`, the `EmailAlreadyExistsError` race) are catalogued in `docs/prd/auth-route-tests.md` §7 with what it would take to close each.

## Structure

```
src/
  index.ts                 # app entry: mounts middleware + all module routes under /auth
  factory.ts                # createFactory<AppEnv>() — shared Bindings/Variables typing
  errors.ts                 # typed domain errors (e.g. EmailAlreadyExistsError)
  lib/                      # framework-agnostic helpers: jwt.ts, password.ts, session.ts, request.ts
  middleware/                # db.ts (attaches c.var.db), auth.ts (requireAuth), validate.ts (valibot)
  modules/<name>/            # *.schema.ts, *.handlers.ts, *.routes.ts — see Module layout below
  repositories/*.repository.ts   # only code that imports Drizzle tables from @repo/database
```

Adding a new authenticated endpoint: create a `modules/<name>/` following the `me` module as the minimal template (`requireAuth` in `createHandlers`, no request body validation needed) or `register`/`login` for one that validates a JSON body and touches multiple repositories in a transaction.

## Module layout (per feature, e.g. `modules/register/`)

- `*.schema.ts` — valibot input schema.
- `*.handlers.ts` — `factory.createHandlers(validate(...), async (c) => ...)`; business logic lives here, talking to repositories, never to Drizzle tables directly.
- `*.routes.ts` — thin: `factory.createApp().post("/path", ...handlers)`, mounted in `src/index.ts` via `.route("/auth", xRoutes)`.

## Repositories (`src/repositories/*.repository.ts`)

Static-method classes (`abstract class X { static async ... }`) that are the *only* code allowed to import Drizzle table objects from `@repo/database` and run queries. They accept a `DatabaseExecutor` (`Database | Transaction`, defined in `factory.ts`) so the same method works inside or outside a `db.transaction(...)` — see `register.handlers.ts` for a multi-table transaction (`user` + `account` insert) example. DB-level constraint violations (e.g. duplicate email) are translated into typed errors (`src/errors.ts`, e.g. `EmailAlreadyExistsError`) at the repository boundary, not left as raw driver errors for handlers to inspect.

## Auth flow

- Passwords: PBKDF2-SHA256 via Web Crypto, implemented in `src/lib/password.ts`. Iteration count is deliberately capped for the Workers free-tier 10ms CPU budget — see the comment there before changing `ITERATIONS`.
- Tokens: short-lived access token + long-lived refresh token, both HS256 JWTs (`src/lib/jwt.ts`, using `@tsndr/cloudflare-worker-jwt`). Refresh token TTL must stay in sync with the `session` row's `expiresAt` — see the comment in `src/lib/session.ts`.
- Sessions are rows in the `session` table keyed by a `uuidv7` id, which doubles as the session/refresh token value (`SessionRepository.insert(db, { ...session, token: session.id })`).
- `requireAuth` middleware (`src/middleware/auth.ts`) validates the `Authorization: Bearer <token>` header against the access token and sets `c.var.userId`; it does not touch the DB. Handlers needing the full user row still look it up via `UserRepository.findById`.
- `requestMeta(c)` (`src/lib/request.ts`) extracts `CF-Connecting-IP` / `User-Agent` for session metadata.

## Conventions specific to this app

- Routes are mounted with a shared `/auth` prefix in `index.ts` (`.route("/auth", xRoutes)`) — an individual `*.routes.ts` file should define paths relative to that (e.g. `/register/email`, not `/auth/register/email`).
- Handlers return **only** `c.json(...)`; there's no shared response envelope helper — the `{ message, data }` shape used in `register`/`login`/`me` handlers is convention, not enforced by a type, so match it when adding endpoints.
- Repositories translate constraint violations into errors from `src/errors.ts` (see `UserRepository.insert`'s `ER_DUP_ENTRY` handling) — handlers catch these typed errors rather than inspecting driver error codes/messages themselves.
- `login`/`register` currently pass `{ ipAddress: null, userAgent: null }` into `createSession` rather than `requestMeta(c)` from `src/lib/request.ts` — if you touch session creation, check whether wiring `requestMeta` in is in scope for that change.
