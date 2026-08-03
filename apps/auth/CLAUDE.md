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
pnpm test            # vitest run
pnpm test -- path/to/file.test.ts    # single file
pnpm test -- -t "name"               # single test by name
```

Run these from `apps/auth/`, or from the repo root with `pnpm --filter @repo/auth <script>`.

## Local setup

Copy `.dev.vars.example` to `.dev.vars` and fill in:
- `SERO_POS_DATABASE_URL` — TiDB connection string (see `packages/database/.env.example` for the required format/ssl param)
- `SERO_POS_JWT_SECRET` — HS256 signing secret

`worker-configuration.d.ts` is wrangler-generated and declares the `CloudflareBindings` type consumed by `AppEnv` in `src/factory.ts`.

## Structure

```
src/
  index.ts                 # app entry: mounts middleware + all module routes under /auth
  factory.ts                # createFactory<AppEnv>() — shared Bindings/Variables typing
  errors.ts                 # typed domain errors (e.g. EmailAlreadyExistsError)
  lib/                      # framework-agnostic helpers: jwt.ts, password.ts, session.ts, request.ts
  middleware/                # db.ts (attaches c.var.db), auth.ts (requireAuth), validate.ts (valibot)
  modules/<name>/            # *.schema.ts, *.handlers.ts, *.routes.ts — see root CLAUDE.md for the pattern
  repositories/*.repository.ts   # only code that imports Drizzle tables from @repo/database
```

Adding a new authenticated endpoint: create a `modules/<name>/` following the `me` module as the minimal template (`requireAuth` in `createHandlers`, no request body validation needed) or `register`/`login` for one that validates a JSON body and touches multiple repositories in a transaction.

## Conventions specific to this app

- Routes are mounted with a shared `/auth` prefix in `index.ts` (`.route("/auth", xRoutes)`) — an individual `*.routes.ts` file should define paths relative to that (e.g. `/register/email`, not `/auth/register/email`).
- Handlers return **only** `c.json(...)`; there's no shared response envelope helper — the `{ message, data }` shape used in `register`/`login`/`me` handlers is convention, not enforced by a type, so match it when adding endpoints.
- Repositories translate constraint violations into errors from `src/errors.ts` (see `UserRepository.insert`'s `ER_DUP_ENTRY` handling) — handlers catch these typed errors rather than inspecting driver error codes/messages themselves.
- `login`/`register` currently pass `{ ipAddress: null, userAgent: null }` into `createSession` rather than `requestMeta(c)` from `src/lib/request.ts` — if you touch session creation, check whether wiring `requestMeta` in is in scope for that change.
