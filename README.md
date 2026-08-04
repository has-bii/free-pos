# Free POS

An open-source, free point-of-sale system for restaurants and cafes — built as a portfolio project to demonstrate a production-shaped Cloudflare Workers monorepo (typed RPC, real integration tests, CI/CD).

[![CI](https://github.com/has-bii/free-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/has-bii/free-pos/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?logo=drizzle&logoColor=black)
![TiDB](https://img.shields.io/badge/TiDB_Serverless-EB0029?logo=tidb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)

> **Status: early-stage / work in progress.** Auth is functional; the actual POS features (menus, orders, tables, checkout) haven't been built yet. See [Roadmap](#roadmap) below.

## Architecture

A Turborepo/pnpm monorepo. `apps/frontend` is a client-side SPA that talks to `apps/auth`, a Cloudflare Workers service, over Hono's typed RPC client — so API calls are type-checked end-to-end with no shared schema package. `apps/auth` persists through `packages/database` (Drizzle ORM over TiDB Serverless); JWT signing/verification and auth middleware live in `packages/auth-kit` so any future service can reuse them without depending on `apps/auth` itself.

```mermaid
flowchart LR
    subgraph Client
        FE["apps/frontend<br/>Vite + React + TanStack Router<br/>(static-assets Worker)"]
    end

    subgraph Edge["Cloudflare Workers"]
        AUTH["apps/auth<br/>Hono API<br/>(free-pos-auth)"]
    end

    DB[("TiDB Serverless")]

    FE -- "Hono RPC (hc), httpOnly cookies" --> AUTH
    AUTH -- "Drizzle ORM" --> DB

    AK["packages/auth-kit<br/>JWT + requireAuth + cookies"] -.-> AUTH
    DBP["packages/database<br/>Drizzle schema + client"] -.-> AUTH
    UI["packages/ui<br/>shadcn/ui + Tailwind v4"] -.-> FE
```

**Apps**
- `apps/auth` — Hono API on Cloudflare Workers. Email/password auth (register, login, refresh, `/me`), HS256 JWTs delivered as `httpOnly` cookies.
- `apps/frontend` — Vite + React 19 + TanStack Router SPA, deployed as a static-assets Worker. No SSR, no server component.

**Shared packages**
- `packages/auth-kit` — JWT signing/verification, `requireAuth` middleware, cookie helpers.
- `packages/database` — Drizzle ORM schema/client over TiDB Serverless.
- `packages/ui` — shared shadcn/ui component library, Tailwind v4 theme.
- `packages/typescript-config` — shared `tsconfig` bases (strict mode, `noUncheckedIndexedAccess`, etc.).

## Roadmap

- [x] Email/password auth (register, login, refresh, `/me`) with HS256 JWTs in `httpOnly` cookies
- [x] Login page UI (`apps/frontend`)
- [ ] Menu & item management
- [ ] Table management
- [ ] Order taking / kitchen tickets
- [ ] Checkout & payments
- [ ] Sales reporting

## Getting Started

Requires Node (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev
```

This runs every app in dev mode via Turborepo (`apps/auth` on `wrangler dev`, `apps/frontend` on Vite). Each app and package needs its own local env setup (database connection string, JWT secret, etc.) before `dev`/`test` will work — see the `CLAUDE.md` in each of `apps/auth`, `apps/frontend`, and `packages/database` for exact steps.

Other root-level commands (see [`CLAUDE.md`](./CLAUDE.md) for the full list):

```bash
pnpm build       # turbo run build
pnpm lint        # turbo run lint (biome)
pnpm typecheck   # turbo run typecheck
pnpm test        # turbo run test
```

## License

[MIT](./LICENSE)
