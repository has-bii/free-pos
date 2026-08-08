import { ACCESS_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { JWT } from "@repo/auth-kit/jwt"
import { errorResponse } from "@repo/hono-utils/response"
import type { Context, Env } from "hono"
import { getCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"

type RequireAuthEnv = Env & {
	Variables: {
		userId: string
		sessionId: string
	}
}

/**
 * Factory rather than a fixed middleware: each service supplies its own
 * secret however it's bound (Cloudflare binding name, KV, etc.), so this
 * package never has to assume a cross-service binding-name convention.
 */
export const requireAuth = <E extends RequireAuthEnv>(getSecret: (c: Context<E>) => string) => {
	return createMiddleware<E>(async (c, next) => {
		const unauthorized = () => c.json(errorResponse({ message: "Unauthorized." }), 401)

		const token = getCookie(c, ACCESS_TOKEN_COOKIE_NAME)
		if (!token) return unauthorized()

		const payload = await JWT.verifyAccessToken(token, getSecret(c))
		if (!payload) return unauthorized()

		c.set("userId", payload.sub)
		c.set("sessionId", payload.sid)
		await next()
	})
}
