import { ACCESS_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { JWT } from "@repo/auth-kit/jwt"
import { requireAuth } from "@repo/auth-kit/middleware/auth"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

const SECRET = "test-secret"

type Env = {
	Variables: { userId: string; sessionId: string }
}

const buildApp = () => {
	const app = new Hono<Env>()
	app.get(
		"/protected",
		requireAuth<Env>(() => SECRET),
		(c) => c.json({ userId: c.var.userId, sessionId: c.var.sessionId }),
	)
	return app
}

const withCookie = (token: string) => ({ Cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${token}` })

describe("requireAuth", () => {
	it("sets userId/sessionId and calls next for a valid access token cookie", async () => {
		const token = await JWT.signAccessToken({ sub: "user-1", sid: "session-1" }, SECRET)

		const res = await buildApp().request("/protected", { headers: withCookie(token) })
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ userId: "user-1", sessionId: "session-1" })
	})

	it("rejects a request with no cookie at all", async () => {
		const res = await buildApp().request("/protected")
		expect(res.status).toBe(401)
		expect(await res.json()).toEqual({ success: false, message: "Unauthorized." })
	})

	it("rejects a garbage cookie value", async () => {
		const res = await buildApp().request("/protected", { headers: withCookie("not-a-real-token") })
		expect(res.status).toBe(401)
	})

	it("rejects a token signed with the wrong secret", async () => {
		const token = await JWT.signAccessToken({ sub: "user-1", sid: "session-1" }, "wrong-secret")
		const res = await buildApp().request("/protected", { headers: withCookie(token) })
		expect(res.status).toBe(401)
	})

	it("rejects a refresh token used as an access token", async () => {
		const token = await JWT.signRefreshToken({ sub: "user-1", sid: "session-1", jti: "token-1" }, SECRET)
		const res = await buildApp().request("/protected", { headers: withCookie(token) })
		expect(res.status).toBe(401)
	})

	it("rejects an expired access token", async () => {
		const jwtLib = (await import("@tsndr/cloudflare-worker-jwt")).default
		const expired = await jwtLib.sign(
			{ sub: "user-1", sid: "session-1", type: "access", exp: Math.floor(Date.now() / 1000) - 60 },
			SECRET,
			"HS256",
		)
		const res = await buildApp().request("/protected", { headers: withCookie(expired) })
		expect(res.status).toBe(401)
	})
})
