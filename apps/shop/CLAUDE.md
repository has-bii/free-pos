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
`FREE_POS_FRONTEND_ORIGIN`. `FREE_POS_JWT_SECRET` must be byte-for-byte
identical to the `apps/auth` Worker secret: auth issues the HS256 access cookie
and this Worker verifies it through the shared `@repo/auth-kit` middleware.
`FREE_POS_FRONTEND_ORIGIN` must match the auth Worker exactly so credentialed
browser requests pass CORS. Copy `.env.test.example` to `.env.test` for route
tests; tests require a TiDB database with `test` in its name and migrations
applied.

The Worker exposes public `GET /shops` and `GET /shops/:slug` routes plus
authenticated `GET /shops/me`, `POST /shops`, `PUT /shops/:id`, and
`DELETE /shops/:id`. Auth uses `requireAuth` from `@repo/auth-kit`; no local
auth implementation belongs here. Auth cookies are issued only by
`apps/auth`: the access cookie uses `Path=/` and the production shared cookie
domain, while the refresh cookie remains scoped to `apps/auth`'s `/refresh`
endpoint. Production `auth`, `shop`, and frontend hosts must share the same
registrable domain (for example, `auth.yourdomain.com`,
`shop.yourdomain.com`, and `app.yourdomain.com`); a separate `workers.dev`
host cannot receive an access cookie scoped to `.yourdomain.com`.
