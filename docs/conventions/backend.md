# Backend application convention

This document defines the conventions for backend applications in the Free POS monorepo. It is intended for Cloudflare Workers services built with Hono and TypeScript, but the module and dependency rules also apply to future backend apps that use the same architecture.

## Goals

Backend code should be:

- Organized by the feature or capability exposed by the API.
- Explicit about HTTP, application, persistence, and integration boundaries.
- Easy to test without making external provider calls.
- Safe by default around authentication, cookies, redirects, and secrets.
- Consistent with the monorepo's TypeScript, Biome, pnpm, and Turborepo setup.

## Standard application structure

A backend app should follow this shape:

```text
apps/<app>/
├── src/
│   ├── index.ts
│   ├── factory.ts
│   ├── errors.ts
│   ├── lib/
│   ├── middleware/
│   ├── modules/
│   │   └── <feature>/
│   │       ├── <feature>.routes.ts
│   │       ├── <feature>.handlers.ts
│   │       ├── <feature>.schema.ts       # only when input validation is needed
│   │       └── services/                 # only when orchestration is needed
│   │           └── <use-case>.service.ts
│   └── repositories/
├── test/
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

The exact folders are created only when the app needs them. Do not add empty architectural layers or one-off abstractions solely for symmetry.

## Application entry point

`src/index.ts` is the application composition root. It should contain:

- Global middleware such as CORS and database attachment.
- Global error handling.
- Health or readiness endpoints.
- Mounting of feature route modules.
- The exported RPC type used by typed clients.

Keep feature implementation out of `index.ts`:

```ts
const app = factory
  .createApp()
  .use(cors(...))
  .use(dbMiddleware)
  .onError(...)
  .get("/health", healthHandler)
  .route("/", loginRoutes)
  .route("/", registerRoutes)

export default app
export type AppWithErrors = ApplyGlobalResponse<typeof app, ...>
```

Routes are mounted at the root. A route module defines its complete public path; do not add an implicit feature prefix in `index.ts`.

## Runtime typing and factory

Create one typed Hono factory per backend app:

```ts
export type AppEnv = {
  Bindings: CloudflareBindings
  Variables: {
    db: Database
    userId: string
    sessionId: string
  }
}

export const factory = createFactory<AppEnv>()
```

Use the shared factory in routes, handlers, and middleware. Do not redeclare the app environment generics in individual modules.

Bindings come from Wrangler-generated `worker-configuration.d.ts`. After adding or renaming a Worker binding, run the app's type-generation command and keep the generated type committed when that is the repository convention.

## Feature modules

Organize API code by feature, not by HTTP verb or database table:

```text
modules/login/
  login.routes.ts
  login.handlers.ts
  login.schema.ts
  services/
    google.service.ts
```

The feature name should describe the capability exposed by the API. A provider or mechanism that implements the same capability belongs with that feature. For example, Google OAuth is a login method, so its routes belong in `modules/login`, not in a separate `modules/google` module.

### `*.routes.ts`

Route files are thin route declarations. They should:

- Create the feature sub-application with the shared factory.
- Associate HTTP methods and paths with handlers.
- Avoid database access, business rules, and provider calls.

```ts
export const loginRoutes = factory
  .createApp()
  .post("/login/email", ...loginEmailHandlers)
  .get("/login/google", ...googleInitiationHandlers)
  .get("/login/google/callback", ...googleCallbackHandlers)
```

### `*.handlers.ts`

Handlers are the HTTP boundary. They may:

- Read path, query, header, cookie, and body values.
- Apply request validation middleware.
- Set or clear cookies.
- Redirect or construct HTTP responses.
- Translate service errors into public HTTP responses.
- Call repositories for simple operations.
- Call services for multi-step workflows.

Handlers must not import Drizzle table definitions or run raw database queries. They should not contain a large, reusable business workflow. Keep private HTTP-specific helpers in the handler when they are only used by that feature; do not create a new file merely for a single cookie or OAuth helper.

A handler can contain simple feature logic. Extract a service when the flow coordinates multiple repositories, transactions, external providers, or security-sensitive business rules.

### `*.schema.ts`

Schema files contain request validation schemas and related inferred types. Use the app's established validation middleware and return the existing validation error shape. Do not duplicate validation manually in handlers when a schema can express the rule.

Only create a schema file for a feature that validates request input. Cookie-only or callback-only endpoints do not need an empty schema file.

### `*.service.ts`

Services represent application use cases and orchestration. A service may:

- Coordinate multiple repositories.
- Open and control database transactions.
- Call a provider or other integration boundary.
- Normalize external data into application data.
- Create sessions or other domain records.
- Return structured results to a handler.

Services must not depend on Hono `Context`, request/response objects, redirects, or cookie APIs. Pass explicit values and configuration instead.

Use descriptive service names under a feature's `services/` directory:

```text
modules/login/services/google.service.ts
```

Do not call a service a `util`. Utilities are stateless helpers; services represent use cases and application behavior.

### Adding a new file role

The standard roles are:

- `*.routes.ts`
- `*.handlers.ts`
- `*.schema.ts`
- `*.service.ts`

Introduce another role only when the responsibility is not correctly owned by one of these files and the role is likely to be useful beyond a single trivial helper. Examples include a dedicated provider adapter or repository, but a provider should normally live in `src/lib/<provider>.ts` when it is a shared external boundary.

## Shared library code

`src/lib/` contains framework-agnostic helpers and integration boundaries that are reusable or need to be isolated from feature code:

```text
lib/password.ts   # password hashing and verification
lib/session.ts    # session creation and rotation
lib/request.ts    # request metadata extraction
lib/email.ts      # email delivery boundary
lib/google.ts     # Google provider boundary and Google protocol definitions
```

A shared library module should not import Hono `Context` unless it is explicitly a framework adapter. Keep external network calls behind a small provider boundary so services and tests do not need to call a real provider.

Use concrete subpath imports. Do not add barrel files unless a package-wide public export is intentionally required.

## Repositories and database access

Repositories are the persistence boundary:

```text
src/repositories/user.repository.ts
src/repositories/session.repository.ts
```

Rules:

- Repositories are the only app code that imports Drizzle table objects from `@repo/database`.
- Repositories expose named methods through plain object literals.
- Methods accept `DatabaseExecutor` so they work with both a database client and a transaction.
- Services decide transaction boundaries for multi-step use cases.
- Handlers do not run raw Drizzle queries.
- Do not leak raw driver errors or driver-specific checks into handlers.
- Normalize persistence constraint failures at the repository boundary into a safe result or typed application error.

The shared `packages/database` package defines tables and the database client. It does not contain backend business logic.

## Errors and responses

Use typed errors for expected application failures when callers need to distinguish them. Keep errors close to their ownership boundary:

- Shared persistence errors used by multiple modules belong in `src/errors.ts`.
- Feature-specific service errors belong with the service.
- Provider/API errors belong with the provider integration.
- Public error codes should be stable, intentional API values; do not expose raw exception messages.

Global error handling belongs in `index.ts` and should provide a safe generic response for unexpected failures. Handlers should map expected errors to the appropriate public response or redirect.

Match the app's existing response conventions. Do not introduce a new response envelope for one endpoint. Authentication tokens must not be returned in JSON bodies when the app uses secure cookies.

## Authentication and security

Backend apps must treat the following as security-sensitive:

- Secrets and environment bindings.
- Cookie names, paths, domains, and attributes.
- Redirect destinations and return URLs.
- OAuth state and PKCE values.
- Session rotation and token replay behavior.
- Account linking and identity verification.

Required practices:

- Never commit secret values or place them in client bundles.
- Use `httpOnly`, `Secure`, and appropriate `SameSite` cookie settings for auth cookies.
- Keep refresh cookies scoped to their refresh endpoint where possible.
- Validate OAuth state before processing provider responses.
- Use PKCE for public OAuth login flows.
- Accept only safe relative return paths unless an explicitly configured allowlist is used.
- Do not trust an external identity until the required identity fields and verification status are validated.
- Keep provider calls behind an injectable or replaceable provider boundary.
- Fail closed on account-linking conflicts and token/session races.

Shared JWT signing, verification, auth middleware, and auth-cookie helpers belong in `packages/auth-kit`; an app must not reimplement them locally.

## Middleware

Use middleware for cross-cutting request concerns:

```text
src/middleware/db.ts        # attaches the database client
src/middleware/validate.ts  # request validation adapter
```

Middleware should set typed request variables or enforce a reusable policy. Endpoint-specific business logic belongs in handlers or services. Use `requireAuth` from `@repo/auth-kit` for authenticated endpoints rather than creating a local duplicate wrapper.

## Testing

Prefer route-level integration tests for backend behavior. Tests should exercise the real Worker entry point and assert both HTTP behavior and relevant database effects when the app has a test database.

Use provider boundaries to control external integrations. Tests must not call Google, email providers, or other external services over the network.

Test at least:

- Successful and invalid request validation.
- Authentication and authorization failures.
- Cookie attributes and token placement.
- Transaction and constraint-race behavior where relevant.
- External provider success, cancellation, malformed responses, and failures.
- Safe redirect and callback handling.

A refactor may intentionally defer tests, but that exception should be explicit in the change description. Do not use a missing test suite as a reason to weaken security checks.

## Environment and dependencies

- Document required bindings and local setup in the app's `CLAUDE.md`.
- Declare Turbo task environment variables in `turbo.json`.
- Keep shared dependency versions in `pnpm-workspace.yaml`'s `catalog`.
- Use `workspace:*` for internal packages.
- Do not hardcode a dependency version in one package when it is shared by the workspace.

## Validation checklist

Before submitting a backend change:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For a scoped change, run the equivalent filtered commands, for example:

```bash
pnpm --filter @repo/auth lint
pnpm turbo run typecheck --filter=@repo/auth
pnpm turbo run build --filter=@repo/auth
```

If tests require unavailable infrastructure, state that clearly and still run formatting, linting, typechecking, and build validation.
