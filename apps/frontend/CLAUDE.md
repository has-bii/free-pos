# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `apps/frontend`-specific details.

## What this is

`@repo/frontend`: client-side SPA built with Vite + React 19 + TanStack Router, no server component (no TanStack Start, no SSR). Renders entirely in the browser off a static bundle, deployed as a Cloudflare Workers static-assets Worker (`sero-pos-frontend`), see Deploying below. Calls `apps/auth` via a typed Hono RPC client — see API client below.

## Commands

```
pnpm dev             # vite — http://localhost:5173
pnpm build           # vite build
pnpm preview          # vite preview — serve the production build locally
pnpm lint            # biome check .
pnpm typecheck       # tsc --noEmit
pnpm test            # no-op — no tests yet
```

Run these from `apps/frontend/`, or from the repo root with `pnpm --filter @repo/frontend <script>`.

## Deploying

Deployed as a static-assets-only Cloudflare Worker (`sero-pos-frontend`, `wrangler.jsonc`) — no `main`/Worker script, since this app has no server code: `assets.directory` points at the Vite `dist/` build, and `assets.not_found_handling: "single-page-application"` serves `index.html` for unmatched routes so client-side routing works. Deployed from the `production` branch via a `deploy-frontend` job in `.github/workflows/deploy.yml`, parallel to (not dependent on) `apps/auth`'s deploy job — the two are independent artifacts with nothing to coordinate (no shared migration step). The production custom domain (`app.sero-pos.com`) is attached to the Worker manually via the Cloudflare dashboard rather than declared in `wrangler.jsonc`, mirroring how `apps/auth`'s `auth.sero-pos.com` is attached — see that app's `CLAUDE.md`. No PR preview deployments yet.

## Routing

File-based: routes live under `src/routes/`, and the `@tanstack/router-plugin` Vite plugin (configured in `vite.config.ts` with `target: "react"`, `autoCodeSplitting: true`) regenerates `src/routeTree.gen.ts` from them on every `dev`/`build` run. `src/routeTree.gen.ts` is committed (not gitignored) — same call as `apps/auth/worker-configuration.d.ts`, so a fresh checkout typechecks without first running `dev`/`build` (`pnpm typecheck` doesn't invoke Vite, so it can't regenerate this file itself). It's excluded from Biome in the root `biome.json`, like `worker-configuration.d.ts` — never hand-edit it, just run `pnpm dev` or `pnpm build` again after adding/renaming a route file.

`src/routes/__root.tsx` is the root route (just an `<Outlet />` for now); `src/routes/index.tsx` is `/`.

## React Compiler

Enabled via `babel-plugin-react-compiler` + `@rolldown/plugin-babel`'s `reactCompilerPreset`, wired in `vite.config.ts` (`@vitejs/plugin-react` exposes `reactCompilerPreset`, but doesn't run it itself — it's an optional peer dep enabled by adding a separate `babel({ presets: [reactCompilerPreset()] })` plugin, since Vite 8 uses Rolldown and JSX/refresh are handled by `@vitejs/plugin-react`'s own oxc-based transform rather than Babel). No manual `useMemo`/`useCallback`/`React.memo` needed for components that follow the Rules of React — the compiler auto-memoizes. To confirm it's running on a given build, check for `_c(` (the compiler's memo-cache helper) in the built output.

## Styling / shared UI

Tailwind v4, CSS-first config. There is no local Tailwind entry point or `tailwind.config.ts` in this app — `src/main.tsx` imports `@repo/ui/styles/globals.css` directly, so `packages/ui` is the single source of the theme (see `packages/ui/CLAUDE.md`). `components.json` here exists only so the shadcn CLI can add app-local, non-shared components under `src/components/`; anything meant to be reused should go in `packages/ui` instead, added via `pnpm dlx shadcn@latest add <component>` from `packages/ui/`, not from here.

## API client

`src/modules/auth/lib/api.ts` calls `apps/auth` via Hono's typed RPC client: `hc<AppWithErrors>(baseUrl, { init: { credentials: "include" } })`. `AppWithErrors` is exported from `apps/auth/src/index.ts` — `ApplyGlobalResponse<typeof app, { 400: {...} }>` annotates the 400 response shape on top of the inferred route types, since Hono can't infer a useful type for `validate.ts`'s dynamic per-field valibot error object on its own. `baseUrl` reads `import.meta.env.VITE_AUTH_API_URL`, falling back to `apps/auth`'s local `wrangler dev` address (`http://localhost:8787`) when unset — so a plain local `pnpm build`/`pnpm dev` always targets local `apps/auth`. The production value (`https://auth.sero-pos.com`) is stored as the `VITE_AUTH_API_URL` repo secret (not sensitive on its own, but kept alongside `CLOUDFLARE_API_TOKEN`/`PRODUCTION_DATABASE_URL` rather than inlined in the workflow — set via `gh secret set VITE_AUTH_API_URL`) and passed as a step-level env var on the `deploy-frontend` job's build step in `.github/workflows/deploy.yml`. `VITE_AUTH_API_URL` is also declared in `turbo.json`'s `build` task `env` array so turbo's strict env mode actually forwards it (same pattern as `test`'s `TEST_DATABASE_URL` — see root `CLAUDE.md`). No `.env.production` file — deliberately not committed.

Importing `AppWithErrors` requires `tsconfig.json`/`vite.config.ts` to map `@repo/auth/*` (→ `apps/auth/src/*`) and `@repo/auth-kit/*` (→ `packages/auth-kit/src/*`, mirroring `apps/auth`'s own mapping) as raw source, plus `tsconfig.json` `include`-ing `apps/auth/worker-configuration.d.ts` for the `CloudflareBindings` global it references. This makes `apps/auth`'s entire route graph part of `apps/frontend`'s typecheck under a different (DOM-inclusive) `lib` than `apps/auth` itself compiles with — see the root `CLAUDE.md`'s "Cross-runtime source-path imports" note before changing any of this wiring or debugging a typecheck error that only reproduces here.

## Conventions specific to this app

- Imports use the same self-referencing subpath style as every other `@repo/*` package: `@repo/frontend/*` → `./src/*`, `@repo/ui/*` → `../../packages/ui/src/*`, `@repo/auth/*` → `../auth/src/*`, `@repo/auth-kit/*` → `../../packages/auth-kit/src/*` (the latter two type-only in practice — see API client above). All are declared in `tsconfig.json` `paths` and mirrored as `resolve.alias` regexes in `vite.config.ts` (Vite doesn't read tsconfig `paths` — same note as `apps/auth/vitest.config.ts`). Keep both files in sync if any mapping changes.
- `src/modules/auth/` holds the login feature: `components/` (`LoginForm.tsx`, `GoogleIcon.tsx`), `hooks/useLoginForm.ts` (the TanStack Form instance, wired to `authApi` for the submit), `schemas/login.schema.ts` (valibot, mirrors `apps/auth/src/modules/login/login.schema.ts`), `lib/api.ts` (the RPC client above). Follow this `modules/<feature>/` shape for future features rather than one flat `components/` directory.
- `src/components/forms/` holds app-local, form-library-agnostic building blocks used across features but not generic enough for `packages/ui` (`InputPassword.tsx` — show/hide toggle wrapping `packages/ui`'s `input-group`; `SubmitButton.tsx` — loading-state wrapper around `packages/ui`'s `button`). Reusable *outside* forms still belongs in `packages/ui` instead.
- No test setup yet (`test` is a no-op, matching `@repo/database`'s pattern) — add Vitest + Testing Library when there's actual component/route logic worth testing.
