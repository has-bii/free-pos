import { JWT } from "@repo/auth-kit/jwt"
import { describe, expect, it } from "vitest"

const SECRET = "test-secret"

describe("JWT.signAccessToken / verifyAccessToken", () => {
	it("round-trips a valid access token", async () => {
		const token = await JWT.signAccessToken({ sub: "user-1", sid: "session-1" }, SECRET)
		const payload = await JWT.verifyAccessToken(token, SECRET)
		expect(payload).toMatchObject({ sub: "user-1", sid: "session-1" })
	})

	it("rejects a token signed with a different secret", async () => {
		const token = await JWT.signAccessToken({ sub: "user-1", sid: "session-1" }, SECRET)
		expect(await JWT.verifyAccessToken(token, "wrong-secret")).toBeNull()
	})

	it("rejects an expired access token", async () => {
		const jwtLib = (await import("@tsndr/cloudflare-worker-jwt")).default
		const expired = await jwtLib.sign(
			{ sub: "user-1", sid: "session-1", type: "access", exp: Math.floor(Date.now() / 1000) - 60 },
			SECRET,
			"HS256",
		)
		expect(await JWT.verifyAccessToken(expired, SECRET)).toBeNull()
	})

	it("rejects a refresh token presented as an access token", async () => {
		const refresh = await JWT.signRefreshToken({ sub: "user-1", sid: "session-1", jti: "token-1" }, SECRET)
		expect(await JWT.verifyAccessToken(refresh, SECRET)).toBeNull()
	})

	it("rejects garbage input", async () => {
		expect(await JWT.verifyAccessToken("not-a-real-token", SECRET)).toBeNull()
	})
})

describe("JWT.signRefreshToken / verifyRefreshToken", () => {
	it("round-trips a valid refresh token", async () => {
		const token = await JWT.signRefreshToken({ sub: "user-1", sid: "session-1", jti: "token-1" }, SECRET)
		const payload = await JWT.verifyRefreshToken(token, SECRET)
		expect(payload).toMatchObject({ sub: "user-1", sid: "session-1", jti: "token-1" })
	})

	it("rejects an access token presented as a refresh token", async () => {
		const access = await JWT.signAccessToken({ sub: "user-1", sid: "session-1" }, SECRET)
		expect(await JWT.verifyRefreshToken(access, SECRET)).toBeNull()
	})
})

describe("TTL constants", () => {
	it("matches the PRD-specified lifetimes", () => {
		expect(JWT.ACCESS_TOKEN_TTL_SECONDS).toBe(900)
		expect(JWT.REFRESH_TOKEN_TTL_SECONDS).toBe(2_592_000)
	})
})
