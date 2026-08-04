# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Free POS (`free-pos`): a Turborepo/pnpm monorepo. Contains a Cloudflare Workers service, `apps/auth`, backed by a shared `packages/database` package (Drizzle ORM over TiDB Serverless) and a shared `packages/auth-kit` package (JWT signing/verification, the `requireAuth` middleware, and auth cookie helpers — for `apps/auth` and any future service that needs to authenticate requests). It also contains `apps/frontend`, a client-side SPA (Vite + React + TanStack Router, no server component) that consumes the shared shadcn/ui component library in `packages/ui`, deployed as a static-assets-only Cloudflare Worker. `apps/frontend` calls `apps/auth` over Hono's typed RPC client (`hc`) — see `apps/frontend/CLAUDE.md`'s API client section.

## Commands

Run from the repo root — Turborepo fans these out to every workspace package, respecting the `^typecheck` dependency graph declared in `turbo.json`:

```
pnpm install            # install all workspace deps (pnpm workspaces + catalog:)
pnpm build              # turbo run build
pnpm dev                # turbo run dev (persistent, e.g. wrangler dev)
pnpm lint               # turbo run lint (biome check . per package)
pnpm typecheck          # turbo run typecheck (tsc --noEmit per package)
pnpm test               # turbo run test (vitest run per package; apps/auth needs a test DB — see apps/auth/CLAUDE.md)
pnpm format             # biome format --write . (whole repo)
pnpm ui:add <component> # add a shadcn/ui component to packages/ui, e.g. pnpm ui:add badge — see packages/ui/CLAUDE.md
```

To scope any of the above to one package, use turbo's filter flag, e.g. `pnpm turbo run test --filter=@repo/auth`, or `cd` into the package and run its scripts directly (`pnpm --filter @repo/auth dev`, etc.).

Each app/package's own `CLAUDE.md` documents its package-specific scripts (e.g. `db:generate`/`db:migrate` in `packages/database`), local env setup, and testing details.

## Formatting, linting, git hooks

- **Biome** (not ESLint/Prettier) is the sole formatter/linter, configured at the root (`biome.json`): tabs, double quotes, semicolons only where needed (`asNeeded`). Run `pnpm format` rather than hand-formatting.
- **Lefthook** runs on pre-commit (`lefthook.yml`): `biome check --write` on staged JS/TS/JSON files (auto-fixes and re-stages), plus a full `turbo run typecheck` across the monorepo. A commit can fail purely on an unrelated package's type error — run `pnpm typecheck` before committing if unsure.
- CI (`.github/workflows/ci.yml`) runs `pnpm turbo run lint typecheck test` on push/PR to `main`. There's no separate CI-only config to keep in sync with. The `test` task needs the `TEST_DATABASE_URL` repo secret (a real TiDB test database) — see `apps/auth/CLAUDE.md`.
- Any env var a turbo task needs must be listed in that task's `env` array in `turbo.json`. Turbo runs in strict env mode, so an undeclared var is silently dropped rather than erroring — `test` declares `TEST_DATABASE_URL` for this reason.
- Deploy (`.github/workflows/deploy.yml`) triggers on push to a `production` branch, running two independent jobs: `deploy` applies pending `@repo/database` migrations to the production DB (via the `PRODUCTION_DATABASE_URL` repo secret) then runs `wrangler deploy` for `apps/auth`; `deploy-frontend` builds (via the `VITE_AUTH_API_URL` repo secret — see `apps/frontend/CLAUDE.md`'s API client section) and deploys `apps/frontend` as a static-assets Worker. The two don't depend on each other — new deployable apps need their own job added here.

## Workspace/versioning conventions

- Internal packages are referenced as `@repo/<name>` via `workspace:*` in `package.json` and consumed with subpath imports mapped through each package's `tsconfig.json` `paths` (e.g. `@repo/auth/factory` → `apps/auth/src/factory.ts`, a package importing its own modules). The same mapping style is used for cross-package imports too — e.g. `apps/auth`'s `tsconfig.json` maps `@repo/auth-kit/*` to `../../packages/auth-kit/src/*` so it can import `@repo/auth-kit/jwt`, `@repo/auth-kit/cookies`, etc. Since wrangler's bundler reads tsconfig `paths` but Vite does not, any package with a Vite-based config (`vitest.config.ts`, or `apps/frontend/vite.config.ts`) must mirror the same mapping as a `resolve.alias` — see the comment in `apps/auth/vitest.config.ts` or `apps/frontend/vite.config.ts`. When adding a new internal module, you generally don't need a barrel/index re-export — import the concrete path directly.
- **Cross-runtime source-path imports need matching ambient types on both sides.** `apps/frontend` maps `@repo/auth/*`/`@repo/auth-kit/*` to `apps/auth`/`packages/auth-kit`'s raw source (see `apps/frontend/CLAUDE.md`'s API client section) purely to import a *type* (`AppWithErrors`) — but `tsc` still type-checks the whole reachable module graph, including `apps/auth`'s runtime code, under `apps/frontend`'s own tsconfig. `apps/auth` compiles Workers-only (`lib: ["ESNext"]` + `worker-configuration.d.ts`'s Cloudflare types, no DOM); `apps/frontend` compiles browser-only (`react-library.json`'s DOM libs, no Workers types). `apps/frontend/tsconfig.json` includes `apps/auth/worker-configuration.d.ts` so `CloudflareBindings` resolves, which covers most of the gap — but DOM's and Workers' *global* type declarations (e.g. `SubtleCrypto`) can still disagree on one call site even after that (see the comment on the `salt as BufferSource` cast in `apps/auth/src/lib/password.ts`). If a change to `apps/auth`'s source trips a new error only under `apps/frontend`'s typecheck, this dual-lib mismatch is almost certainly why — don't relax `apps/auth`'s own tsconfig to fix it.
- Shared third-party dependency versions are pinned once in `pnpm-workspace.yaml` under `catalog:` and referenced from each package.json as `"catalog:"`. Add new shared deps there rather than hardcoding a version in a package.
- `packages/typescript-config` is the single source of `tsconfig` compiler options (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ESNext/bundler resolution); every package's `tsconfig.json` extends either `@repo/typescript-config/base.json` (Workers/Node) or `@repo/typescript-config/react-library.json` (browser/React — adds `jsx`/DOM libs on top of `base.json`) and adds its own `paths`.

## Architecture

### Adding a new app

For a new Cloudflare Workers service, follow the `apps/auth` shape: a Hono app built via a shared `factory.ts` (`createFactory<AppEnv>()` from `hono/factory`) so route modules, middleware, and handlers all share one typed `Bindings`/`Variables` env instead of redeclaring generics everywhere. Bindings (`CloudflareBindings`) come from `worker-configuration.d.ts` (generated by wrangler — see `apps/auth/wrangler.jsonc`); `Variables` holds per-request state set by middleware (e.g. `db`, `userId`).

For a new browser app, follow the `apps/frontend` shape instead: Vite + React, `tsconfig.json` extending `@repo/typescript-config/react-library.json`, and any shared/reusable UI added to `packages/ui` rather than duplicated per app.

See each app/package's own `CLAUDE.md` for its module layout, repository pattern, and other implementation details.

## Env vars

Each app/package documents its own required env vars in its `CLAUDE.md` (e.g. `apps/auth/CLAUDE.md`, `packages/database/CLAUDE.md`).
