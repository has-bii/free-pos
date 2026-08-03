# ADR 001: Module Structure for `apps/auth`

**Status:** Accepted — implemented
**Date:** 2026-08-03
**Scope:** `apps/auth/src` only. `packages/database` is **not** modified.

## 1. Context

`apps/auth` grew two endpoints (`POST /auth/register/email`, `POST /auth/login/email`)
via [`user-registration.md`](../prd/user-registration.md) and
[`login-and-jwt-wiring.md`](../prd/login-and-jwt-wiring.md). Both landed in a single
`src/routes/auth.ts` (~160 lines) that mixes five concerns in two handlers:

- valibot request schemas
- driver-specific error detection (`isDuplicateEntryError`, matching `/duplicate entry/i`)
- direct drizzle queries against `user`, `account`, `session`
- password hashing and session issuance
- HTTP response shaping

Still queued in the PRDs' Out of Scope: logout, refresh, auth middleware,
`emailVerified` enforcement. Each would add to the same file.

This ADR records the target structure and the reasoning behind its non-obvious parts.

## 2. Decisions

### 2.1 No service layer

Routes call repositories directly. Handlers own orchestration.

**Why:** a service that cannot touch `Context` needs an invented channel to
distinguish "409 conflict" from "500" — discriminated unions re-switched in the
handler, or domain error classes plus a mapper. Both are ceremony at this size.
`c.json(body, 201)` also carries the literal status type that feeds Hono's RPC
client types; routing through a service and re-wrapping loses that for no gain.

The usual counter-argument (testability) is weak in Hono: `app.request(path, init)`
is a first-class in-process API, so testing a handler costs about what testing a
function costs.

**Accepted cost:** logic bound to `c` is unreachable from non-HTTP entry points
(`scheduled`, `queue`). Mitigated by 2.5.

### 2.2 Modules are per use case

`src/modules/{register,login,...}/` — one module per use case, each holding its
own valibot schema, handlers, and routes.

**Considered and rejected:** modules per domain (`modules/auth/`) and per entity
(`modules/user/`). The per-use-case boundary was chosen deliberately, with the
duplication problem solved by 2.3 rather than by redrawing the boundary.

### 2.3 Repositories are app-level and table-shaped

`src/repositories/{user,account,session}.repository.ts` — **not** inside modules.

**Why:** `register` and `login` overlap ~80% in table access (both need
`findUserByEmail`; both insert a session). `refresh` and `logout` will both want
session queries. Tables are table-shaped; modules are use-case-shaped. Putting
SQL in modules means four partial copies of three tables' access, with drift risk.

Modules keep everything that genuinely varies per use case: input schemas,
orchestration, response shape.

### 2.4 Repository signature: plain functions taking an executor

```ts
// derived in apps/auth (packages/database is untouched)
type Database = ReturnType<typeof createDatabaseClient>
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
type DatabaseExecutor = Database | Transaction
```

Every repository function takes `DatabaseExecutor` as its first argument.

**Why the union is mandatory, not stylistic:** drizzle's `TiDBServerlessDatabase`
(`tidb-serverless/driver.d.ts:11`) and `TiDBServerlessTransaction`
(`tidb-serverless/session.d.ts:50`) are sibling classes extending `MySqlDatabase`
and `MySqlTransaction` respectively. They are **not assignable to each other**, so
a function typed `(db: Database)` cannot be called with a `tx`. Register is a
transaction over two tables, so this breaks on the first repository written.

The handler owns the transaction boundary:

```ts
await c.var.db.transaction(async (tx) => {
  await insertUser(tx, newUser)
  await insertCredentialAccount(tx, { ... })
})
```

Rejected: closure factories (`userRepository(db)`) and classes — both make the
transaction story "construct a second repository" rather than "pass an argument",
and nothing in this codebase is class-based.

### 2.5 `lib/` is pure — it never touches the database

`lib/` holds no db import and no `Context`. This splits the current
`lib/session.ts`, which today both signs tokens and inserts a row:

```ts
// lib/session.ts — pure
export async function createSession(
  userId: string,
  secret: string,
  meta: { ipAddress: string | null; userAgent: string | null },
): Promise<{
  session: { id: string; userId: string; expiresAt: Date; ipAddress: string | null; userAgent: string | null }
  accessToken: string
  refreshToken: string
}>
```

```ts
// in register.handlers.ts and login.handlers.ts
const { session, accessToken, refreshToken } = await createSession(userId, c.env.SERO_POS_JWT_SECRET, meta)
await insertSession(c.var.db, session)
```

**Why this shape rather than inlining:** `SESSION_TTL_SECONDS` (`lib/session.ts`)
and `REFRESH_TOKEN_TTL_SECONDS` (`lib/jwt.ts`) must stay equal — both `2_592_000`.
Duplicating the mint-and-persist sequence across register, login, and the future
refresh endpoint multiplies the ways those silently diverge. Two lines per handler
instead of eight, with the TTL constants colocated.

`createSession` returns a **plain object**, not `typeof session.$inferInsert`, so
`lib/` does not import the schema even as a type. The repository owns row details
the domain should not know about: `token: id`, `createdAt`, `updatedAt`.

### 2.6 Handlers via `factory.createHandlers`, routes files are wiring

```ts
// factory.ts
type AppEnv = { Bindings: CloudflareBindings; Variables: { db: Database } }
export const factory = createFactory<AppEnv>()
```

`CloudflareBindings` is a global interface (`worker-configuration.d.ts:4-6`)
carrying `SERO_POS_DATABASE_URL` and `SERO_POS_JWT_SECRET` — no import needed.

Hono's best-practices page argues against controllers on **type-inference**
grounds only: *"the path parameter cannot be inferred in the Controller without
writing complex generics."* `factory.createHandlers()` is the documented escape
hatch, and the objection is moot for the current routes — `/register/email` and
`/login/email` have no path params. When a route does (`/sessions/:id`), use
`createFactory<AppEnv, '/sessions/:id'>()`; the `Factory<E, P>` signature supports it.

`createHandlers` and `createMiddleware` are **type-level only** at runtime
(`helper/factory/index.js`: a `.filter()` and an identity function). Zero runtime cost.

### 2.7 No `initApp`; middleware mounted explicitly

`factory.createApp()` is the **only** thing that runs `initApp` — verified in
`hono/dist/helper/factory/index.js`. Hono's docs show the db-injection middleware
inside `initApp`, but this app mounts it explicitly in `index.ts` instead.

**Why:** there is one root app, so `initApp` saves nothing, and it hides middleware
ordering — which the deferred auth middleware will care about. Also, since
`app.route()` runs both the parent's and the mounted app's middleware, an `initApp`
used for both would set `c.var.db` twice per request.

### 2.8 `db` on the context

`middleware/db.ts` sets `c.set("db", createDatabaseClient(c.env.SERO_POS_DATABASE_URL))`.
Replaces the three inline `createDatabaseClient` calls.

Cost is one object allocation per request, including 404s: `connect()` in
`@tidbcloud/serverless` is `return new Connection(config)` and the driver is
fetch-based, so nothing opens at construction.

### 2.9 Typed errors, caught in the handler

`src/errors.ts` holds domain errors (`EmailAlreadyExistsError`). The **repository**
catches the MySQL driver error and throws the typed one; the handler catches the
typed one and returns 409. Driver knowledge stays in the layer that owns the driver.

Handlers use `try/catch` rather than a global `app.onError` map, because
**Hono infers RPC types from what the handler returns** — a 409 produced in
`onError` is invisible to `hono/client`, which would then claim the route only
returns 201 or 400. `app.onError` exists in `index.ts` only as a safety net
turning unhandled throws into a generic 500.

### 2.10 Register keeps its pre-check `select`

The pre-`select` on email is **not** redundant with the duplicate-key catch, and
must not be "cleaned up":

- The **pre-check** saves CPU. Without it, a duplicate registration pays the full
  PBKDF2 cost before failing. `lib/password.ts`'s 50,000 iterations are already
  tuned against the Workers Free tier 10ms CPU cap
  (see [user-registration.md §4.3](../prd/user-registration.md#43-password-hashing)).
  The pre-check is a network round trip, not CPU.
- The **catch** guarantees correctness in the check-then-insert race window.

Two paths to one 409, guarding different resources.

### 2.11 Input schemas only

Valibot validates requests. Responses go through a pure `toAuthResponse(user, tokens)`
mapper in `lib/serialize.ts` — both endpoints return the identical body
(`{ id, name, email, createdAt, accessToken, refreshToken }`), built by hand twice today.

Rejected: valibot output schemas with `v.parse` before responding. The leak
protection is real but a whitelisting mapper gets most of it without spending the
10ms CPU budget validating self-constructed data.

### 2.12 Naming and mounting

Files are prefixed: `register.handlers.ts`, `user.repository.ts` — so fuzzy-find
and editor tabs stay unambiguous once four modules each have a `handlers.ts`.

Each module exports a Hono app carrying its **full** sub-path; `index.ts` mounts
each at `/auth`:

```ts
export const registerRoutes = factory.createApp().post("/register/email", ...registerEmailHandlers)

const app = factory.createApp()
  .route("/auth", registerRoutes)
  .route("/auth", loginRoutes)
```

Mounting twice at the same prefix is legal, chaining preserves RPC types, and the
real path stays greppable in the module file rather than assembled across three files.

### 2.13 `/health` stays in `index.ts`

Infrastructure, not domain. It moves from its own `createDatabaseClient` call to
`c.var.db`. Its `try/catch` → 503 must survive the new `app.onError`; it does,
because the middleware only constructs the client and the throw happens at
`db.execute` inside the handler's own `try/catch`.

## 3. Target layout

```
apps/auth/src/
  index.ts                    app assembly, app.use(db), app.onError, /health, route mounting
  factory.ts                  createFactory<AppEnv>()
  errors.ts                   EmailAlreadyExistsError
  middleware/
    db.ts                     c.set("db", ...)
    validate.ts               unchanged
  lib/                        pure — no db, no Context
    jwt.ts                    unchanged
    password.ts               unchanged
    session.ts                createSession() — builds row + signs tokens, does NOT persist
    serialize.ts              toAuthResponse()
    request.ts                requestMeta(c)
  repositories/
    user.repository.ts        findByEmail, insert (throws EmailAlreadyExistsError)
    account.repository.ts     findCredentialByUserId, insert
    session.repository.ts     insert
  modules/
    register/                 register.schema.ts  register.handlers.ts  register.routes.ts
    login/                    login.schema.ts     login.handlers.ts     login.routes.ts
```

`src/routes/auth.ts` is deleted.

## 4. Behavior parity

Paths, status codes, response bodies, and error messages are unchanged. Two deltas:

1. **New:** unhandled throws return a generic 500 via `app.onError` instead of
   Hono's default error response.
2. **Same outcome, different mechanism:** a duplicate email racing past the
   pre-check still returns 409 — via a typed error from the repository rather than
   `/duplicate entry/i` string-matching in the HTTP layer.

## 5. Implementation plan

Baseline commit of the register/login work lands on `main` **first**, so the
restructure is a reviewable second commit with a revert path. No tests are added
(this is a pure refactor); the safety net is the diff plus a manual pass.

1. Commit baseline on `main`
2. `repositories/`, `errors.ts`, `factory.ts`, `middleware/db.ts`
3. `lib/session.ts` split, `lib/serialize.ts`, `lib/request.ts`
4. `modules/register/`, `modules/login/`
5. Rewrite `index.ts`, delete `routes/auth.ts`
6. `pnpm typecheck` && `pnpm lint`
7. Add pointers to this ADR from the two affected PRDs (their file paths go stale)
8. Manual pass against `wrangler dev`:
   - register new email → 201
   - register duplicate → 409
   - login valid → 200
   - login wrong password → 401
   - malformed body → 400
   - `/health` → 200

## 6. Out of scope

- `packages/database` — untouched, including `schema.ts` and `client.ts`
- Tests — deliberately deferred; the repository seam makes them cheap later
  (`app.request()` + `vi.mock` on repository modules, plus pure unit tests for
  `lib/password.ts` and `lib/jwt.ts`)
- Any behavior change to logout, refresh, auth middleware, or `emailVerified`,
  all still deferred by the PRDs
- Promoting repositories into `packages/database` — revisit when a second app
  needs them
