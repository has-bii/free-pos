# PRD: reef-pos Monorepo Scaffolding

## Status
Draft — approved for implementation on 2026-07-31.

## Purpose
Scaffold `reef-pos` as a pnpm + Turborepo monorepo that will host independently deployable microservices, each shipping to Cloudflare Workers. This PRD covers repository plumbing only — build tooling, workspace layout, CI/CD, and shared config. It does **not** cover business logic: the `auth` app ships as a bare Hono skeleton, and the `database` package ships with no real schema. Both are follow-up work once the scaffold lands.

## Non-goals
- Implementing actual authentication logic (session/JWT strategy, password hashing, OAuth) in `auth`.
- Defining a real Drizzle schema (users, sessions, etc.) in `database`.
- Multiple deploy environments beyond a single production Cloudflare environment.
- Turborepo remote caching.
- Any app beyond `auth` (future services will follow the same scaffold pattern).

---

## Repository layout

```
reef-pos/
├── apps/
│   └── auth/                    # Hono app, deployed as a Cloudflare Worker
│       ├── src/
│       │   └── index.ts         # bare Hono app, single GET /health route
│       ├── test/
│       │   └── health.test.ts    # smoke test via @cloudflare/vitest-pool-workers
│       ├── wrangler.jsonc
│       ├── vitest.config.ts
│       ├── package.json
│       └── tsconfig.json         # extends @reef-pos/typescript-config
├── packages/
│   ├── database/                 # Drizzle + TiDB Serverless, scaffold-only
│   │   ├── src/
│   │   │   ├── schema.ts         # one placeholder table
│   │   │   └── client.ts         # tidb-serverless connection helper
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── typescript-config/
│       ├── base.json              # shared strict tsconfig
│       └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml                 # runs on push/PR to main
│       └── deploy.yml             # runs on merge to production
├── .nvmrc                         # 24.18.0
├── .gitignore
├── lefthook.yml
├── biome.json
├── pnpm-workspace.yaml             # includes catalog
├── turbo.json
├── package.json                    # root, packageManager pin
└── PRD.md
```

---

## Decisions

### Package scope & workspace protocol
- All internal packages are published under the `@reef-pos/*` npm scope (private, never published to a registry).
- Internal cross-package dependencies use `workspace:*` (e.g. `auth`'s `package.json` depends on `"@reef-pos/database": "workspace:*"`), since these packages are versioned and released together, not independently.

### Runtime & package manager
- **Node.js 24**, pinned via `.nvmrc` → `24.18.0`. Node is only used for local dev/tooling — Cloudflare Workers runs on `workerd`, not Node.
- **pnpm**, pinned exact via Corepack: `"packageManager": "pnpm@11.16.0"` in the root `package.json`.
- **Turborepo**, pinned exact: `turbo@2.10.7`.

### Dependency version policy
- **Every dependency in every `package.json` is exact-pinned** — no `^` or `~` ranges anywhere in the repo. Upgrades are deliberate, single-commit actions (can be automated later via Renovate/Dependabot, but always land as an exact new pin, not a floating range).
- Shared dependency versions (used by more than one workspace package) are declared once via pnpm's `catalog:` feature in `pnpm-workspace.yaml`, and referenced from each `package.json` as `"dependency-name": "catalog:"`. Catalog entries themselves are exact versions, per the policy above.
- Versions to pin at scaffold time (latest as of 2026-07-31):

  | Package | Version |
  |---|---|
  | `typescript` | `7.0.2` |
  | `turbo` | `2.10.7` |
  | `@biomejs/biome` | `2.5.6` |
  | `lefthook` | `2.1.10` |
  | `hono` | `4.12.33` |
  | `wrangler` | `4.117.0` |
  | `drizzle-orm` | `0.45.2` |
  | `drizzle-kit` | `0.31.10` |
  | `@tidbcloud/serverless` | `0.3.0` |
  | `vitest` | `4.1.10` |
  | `@cloudflare/vitest-pool-workers` | `0.20.0` |

### Linting & formatting
- **Biome only** (no Prettier). Biome handles both linting and formatting for all JS/TS/JSON files in the repo.
- Ruleset: **`recommended`** (not `all`) — stable baseline, avoids churn from nursery/stylistic rules. Config lives in a single root `biome.json`.

### TypeScript
- **TypeScript `7.0.2`**, exact-pinned. This is the native Go-rewritten compiler (GA July 8, 2026, 8–12x faster full builds). Relevant breaking changes from TS 6 already accounted for in config below: `target: es5` and `moduleResolution: node` no longer exist; `baseUrl` is removed in favor of `paths`.
- Shared base config lives in `packages/typescript-config/base.json`, extended by every app/package's own `tsconfig.json`.
- Base config settings:
  - `strict: true`, `module: esnext`, `types: []` (TS 7 new-project defaults)
  - `moduleResolution: "bundler"` (matches esbuild-based bundling in Wrangler; `node` resolution mode no longer exists in TS 7)
  - `target: "es2022"`
  - `noUncheckedIndexedAccess: true`
  - `noImplicitOverride: true`
  - `exactOptionalPropertyTypes: true`
  - `noFallthroughCasesInSwitch: true`
  - `skipLibCheck: true`
  - `isolatedModules: true`
- Known ecosystem caveat (informational, not a blocker for this stack): tools built against TS's old programmatic API (Vue/Astro/Svelte tooling, `typescript-eslint`, webpack `ts-loader`) haven't fully caught up to TS 7 yet. None of that applies here — no webpack, no non-TS frameworks, Biome instead of ESLint. `drizzle-kit`/`wrangler` compatibility with TS 7 is unverified but low-risk, since neither invokes the TS compiler API directly (both bundle via esbuild).

### Database package (`packages/database`)
- ORM: Drizzle, backed by **TiDB Serverless** (TiDB Cloud), via `drizzle-orm/tidb-serverless` + the `@tidbcloud/serverless` HTTP driver — this driver works natively in Cloudflare Workers (HTTP-based, no raw TCP socket required, so no Hyperdrive needed).
- Scaffold-only scope: one placeholder table in `schema.ts` and a working `drizzle-kit` migration setup, sufficient to prove the migration pipeline works end-to-end. No real domain schema yet.
- Connection string read from `DATABASE_URL` (see Secrets section).

### Auth app (`apps/auth`)
- Bare Hono app deployed as a Cloudflare Worker via `wrangler.jsonc`.
- Single route: `GET /health` returning a 200 with a trivial JSON body, to prove the deploy pipeline and test setup work.
- No auth strategy, no session/JWT handling implemented. Depends on `@reef-pos/database` as a workspace dependency for future use (import not necessarily exercised yet).

### Testing
- **Vitest** + **`@cloudflare/vitest-pool-workers`**, so tests run inside the actual `workerd` runtime rather than Node.
- One smoke test per app/package at scaffold time (e.g. `auth`'s `/health` route returns 200). No tests require a live TiDB connection.

### Cloudflare / Wrangler
- Config format: **`wrangler.jsonc`** (Cloudflare's current recommended default, supports comments).
- Single (default/production) environment only — no named `env.staging`/`env.production` blocks, since there's only one deploy target (see Branching below).

### Git hooks
- **lefthook**, running Biome check (and typecheck) on pre-commit, to catch formatting/lint/type errors before they reach a PR.

### Branching & CI/CD
- Two branches: **`main`** and **`production`**.
- `main`: CI only. GitHub Actions runs `turbo lint typecheck test build` on every push and PR. No deploy.
- `production`: CD. On merge, GitHub Actions runs `wrangler-action` to deploy `auth` to the single Cloudflare production environment. Promotion from `main` to `production` happens via a regular PR (review gate).
- No Turborepo remote caching for now — repo is small enough that full cold-cache CI runs are cheap; revisit once more apps/packages are added.

### Secrets & environment variables
- Single **`DATABASE_URL`** connection-string env var, used consistently across local/dev/production (TiDB Serverless supports connection-string form).
- Local dev: `.dev.vars.example` committed with a placeholder value; `.dev.vars` gitignored.
- Production: set via `wrangler secret put DATABASE_URL` (manual, one-time — not injected through GitHub Actions).
- GitHub Actions only needs one secret: a Cloudflare API token, used by `wrangler-action` to authenticate the deploy.

---

## Open follow-ups (explicitly out of scope for this PRD)
- Real `auth` implementation (session/JWT strategy, password hashing, any auth library).
- Real `database` schema for users/sessions/etc.
- Additional apps/services beyond `auth`.
- Staging environment / multi-environment Wrangler config, if/when needed.
- Turborepo remote caching, if CI time becomes a problem.
- Dependency update automation (Renovate/Dependabot) respecting the exact-pin policy.
