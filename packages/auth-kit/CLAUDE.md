# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the root `CLAUDE.md` first for monorepo-wide commands and conventions. This file covers `packages/auth-kit`-specific details.

## What this is

`@repo/auth-kit`: framework for authenticating requests, shared by `apps/auth` (which issues the tokens) and any future `*.sero-pos.com` service (which only needs to verify them). No DB access, no session issuance/rotation logic — those stay in `apps/auth` since only the auth service ever mints or rotates sessions.

## Commands

```
pnpm lint            # biome check .
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest run — plain vitest, no @cloudflare/vitest-pool-workers needed
```

Run these from `packages/auth-kit/`, or from the repo root with `pnpm --filter @repo/auth-kit <script>`.

## Structure

- `src/jwt.ts` — `JWT` namespace: `signAccessToken`/`signRefreshToken`/`verifyAccessToken`/`verifyRefreshToken`, HS256 via `@tsndr/cloudflare-worker-jwt`, plus `ACCESS_TOKEN_TTL_SECONDS` (900) and `REFRESH_TOKEN_TTL_SECONDS` (2,592,000) — the single source of truth for both TTLs, consumed by `setAuthCookies`' `Max-Age` and by `apps/auth`'s `Session.createSession`/`rotateSession` for the `session` row's `expiresAt`.
- `src/cookies.ts` — `ACCESS_TOKEN_COOKIE_NAME`/`REFRESH_TOKEN_COOKIE_NAME` constants and `setAuthCookies`/`clearAuthCookies` helpers built on `hono/cookie`'s `setCookie`/`deleteCookie`. Both cookies are `HttpOnly`, `Secure`, `SameSite=Lax`. The access cookie is `Path=/` and takes an optional `cookieDomain` (unset → host-only, for local dev; `.sero-pos.com` in prod, widening it to every `*.sero-pos.com` service). The refresh cookie is hardcoded `Path=/refresh` and **never** takes a domain, regardless of what's passed — it must only ever be sent to `auth.sero-pos.com`'s own refresh endpoint. `clearAuthCookies` must be called with the same `cookieDomain` used when setting, or the browser treats it as a different cookie and won't actually delete it.
- `src/middleware/auth.ts` — `requireAuth(getSecret)`: a Hono middleware **factory**, not a fixed middleware. It's generic over the consuming app's `Env` (constrained to `{ Variables: { userId; sessionId } }`) and takes a `getSecret: (c: Context<E>) => string` callback, so each service supplies its signing secret however it's bound locally (e.g. `apps/auth` calls `requireAuth<AppEnv>((c) => c.env.SERO_POS_JWT_SECRET)`) without this package needing to assume a cross-service binding-name convention. Reads the access token from `ACCESS_TOKEN_COOKIE_NAME`, never a header; sets `c.var.userId`/`c.var.sessionId` on success; touches no DB.

## Conventions specific to this package

- No `main`/`types` in `package.json` and no barrel/index — consumers import concrete subpaths (`@repo/auth-kit/jwt`, `@repo/auth-kit/cookies`, `@repo/auth-kit/middleware/auth`) resolved via the consumer's own `tsconfig.json` `paths`, the same self-referencing-style mapping `apps/auth` uses for its own `@repo/auth/*` imports. See the root `CLAUDE.md`'s Workspace/versioning conventions section.
- Tests run under plain `vitest` (no `@cloudflare/vitest-pool-workers`): JWT signing/verification is Web Crypto (works fine under Node) and `requireAuth`/the cookie helpers are tested by mounting a plain `Hono` app and calling `.request(...)` — no real Worker or DB needed. `test/cookies.test.ts` and `test/middleware/auth.test.ts` inspect `res.headers.getSetCookie()` directly rather than re-parsing a `Set-Cookie` string by hand.
- Because `exactOptionalPropertyTypes` is on repo-wide, `cookieDomain` is applied via a conditional spread (`...(config.cookieDomain ? { domain: config.cookieDomain } : {})`) rather than ever passing `domain: undefined` — hono's `CookieOptions.domain` is a plain optional `string`, not `string | undefined`.
