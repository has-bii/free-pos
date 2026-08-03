# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `packages/database`-specific details.

## What this is

`@repo/database`: Drizzle ORM schema + client for the shared TiDB Serverless (MySQL-dialect) database. No business logic — consumers (currently `apps/auth`) own their own repositories/queries against the exported tables and `Database` type.

## Commands

```
pnpm lint            # biome check .
pnpm typecheck       # tsc --noEmit
pnpm db:generate     # drizzle-kit generate — writes a new migration into drizzle/ from src/schema.ts
pnpm db:migrate      # drizzle-kit migrate — applies pending migrations in drizzle/
```

`pnpm test` is currently a no-op placeholder (`echo "no tests" && exit 0`) — there's nothing to run here yet.

Both `db:generate` and `db:migrate` (and `drizzle.config.ts`) read `DATABASE_URL` from `.env` (via `dotenv/config`), not from `SERO_POS_DATABASE_URL` — that's a separate env var used only by the running `apps/auth` Worker. Copy `.env.example` to `.env` and fill in a TiDB Cloud connection string (the `ssl` query param is mandatory; plain-text connections are rejected).

## Workflow for schema changes

1. Edit `src/schema.ts`.
2. `pnpm db:generate` to produce a new SQL file in `drizzle/` plus an updated `drizzle/meta/_journal.json` snapshot. Don't hand-edit files under `drizzle/` — they're generated and must match the journal.
3. `pnpm db:migrate` to apply it to the DB pointed at by `.env`.

## Structure

- `src/schema.ts` — all table definitions (`user`, `session`, `account`, `verification`). Every table uses a `varchar(36)` primary key defaulted via `uuidv7()` (time-sortable), not an autoincrement int — follow that pattern for new tables. `createdAt`/`updatedAt` follow a consistent `timestamp(...).notNull().defaultNow()` / `.onUpdateNow()` pair.
- `src/client.ts` — `createDatabaseClient(databaseUrl)` is the only place that constructs a `@tidbcloud/serverless` connection + `drizzle-orm/tidb-serverless` instance. It also re-exports everything from `./schema`, so consumers import both tables and the client from `@repo/database` (the package's `main`/`types` point at `src/client.ts`). The exported `Database` type (`ReturnType<typeof createDatabaseClient>`) is what downstream `DatabaseExecutor`/transaction types are built from in consuming apps.
- `drizzle.config.ts` — dialect `mysql`, schema `./src/schema.ts`, output `./drizzle`.

## Table shapes (current)

The `user`/`session`/`account`/`verification` schema closely mirrors Better Auth's core table conventions (field names like `emailVerified`, `providerId`, `accountId`), though this repo does not depend on the Better Auth library — auth logic is hand-rolled in `apps/auth`. Keep that shape in mind if adding OAuth providers or additional auth features: `account.providerId` is already used to distinguish `"credential"` (password) accounts from what would be OAuth provider rows.
