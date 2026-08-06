# Shop service

`@repo/shop` is the public shop directory and owner-scoped CRUD Cloudflare
Worker. It shares the database and access-token secret with `apps/auth`.

## Commands

```text
pnpm dev
pnpm deploy
pnpm lint
pnpm typecheck
pnpm test
pnpm cf-typegen
```

Required bindings are `FREE_POS_DATABASE_URL`, `FREE_POS_JWT_SECRET`, and
`FREE_POS_FRONTEND_ORIGIN`. Copy `.env.test.example` to `.env.test` for route
tests; tests require a TiDB database with `test` in its name and migrations
applied.

The Worker exposes public `GET /shops` and `GET /shops/:slug` routes plus
authenticated `GET /shops/me`, `POST /shops`, `PUT /shops/:id`, and
`DELETE /shops/:id`. Auth uses `requireAuth` from `@repo/auth-kit`; no local
auth implementation belongs here.
