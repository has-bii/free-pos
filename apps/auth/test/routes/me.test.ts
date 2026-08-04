import { env } from "cloudflare:workers"
import { ACCESS_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { JWT } from "@repo/auth-kit/jwt"
import jwt from "@tsndr/cloudflare-worker-jwt"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail } from "../helpers/db"
import {
	cookieHeader,
	get,
	type MeSuccessBody,
	type MessageBody,
	readJson,
	registerUser,
	uniqueEmail,
} from "../helpers/http"

const createdEmails: string[] = []
const track = (email: string) => {
	createdEmails.push(email)
	return email
}

afterAll(async () => {
	await deleteTestUsersByEmail(createdEmails)
})

const PATH = "/auth/me"

let fixture: Awaited<ReturnType<typeof registerUser>>
let accessToken: string

beforeAll(async () => {
	fixture = await registerUser({ email: track(uniqueEmail()) })
	const token = fixture.client.jar.get(ACCESS_TOKEN_COOKIE_NAME)
	if (!token) throw new Error("expected register to set an access token cookie")
	accessToken = token
})

const expectUnauthorized = async (res: Response) => {
	expect(res.status).toBe(401)
	expect((await readJson<MessageBody>(res)).message).toBe("Unauthorized.")
}

describe("GET /auth/me", () => {
	// Case 17
	it("returns the current user for a valid access token cookie", async () => {
		const res = await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, accessToken))
		expect(res.status).toBe(200)

		const body = await readJson<MeSuccessBody>(res)
		expect(body.data.user.id).toBe(fixture.user.id)
		expect(body.data.user.email).toBe(fixture.email)
	})

	// Case 18
	it("rejects a request with no access token cookie", async () => {
		await expectUnauthorized(await get(PATH))
	})

	// Case 19
	it("rejects an empty cookie value", async () => {
		await expectUnauthorized(await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, "")))
	})

	// Case 20
	it("rejects a garbage token", async () => {
		await expectUnauthorized(await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, "not-a-real-token")))
	})

	// Case 21 — well-formed but signed with the wrong key.
	it("rejects a token with a bad signature", async () => {
		const forged = await jwt.sign({ sub: fixture.user.id, type: "access" }, "not-the-real-signing-secret", "HS256")
		await expectUnauthorized(await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, forged)))
	})

	// Case 22 — refresh tokens live 30 days against the access token's 15
	// minutes, so accepting one here would be a real privilege escalation.
	it("rejects a refresh token used as an access token", async () => {
		const refreshToken = await JWT.signRefreshToken(
			{ sub: fixture.user.id, sid: fixture.user.id, jti: "irrelevant" },
			env.SERO_POS_JWT_SECRET,
		)
		await expectUnauthorized(await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, refreshToken)))
	})

	// Case 23 — the secret comes from the binding rather than a second copy of
	// the literal in vitest.config.ts, so the two cannot drift.
	it("rejects an expired access token", async () => {
		const expired = await jwt.sign(
			{
				sub: fixture.user.id,
				type: "access",
				exp: Math.floor(Date.now() / 1000) - 60,
			},
			env.SERO_POS_JWT_SECRET,
			"HS256",
		)
		await expectUnauthorized(await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, expired)))
	})

	// Case 24 — covers `!foundUser` in me.handlers.ts, which is otherwise dead
	// code: requireAuth never touches the DB, so the token stays valid.
	it("rejects a valid token whose user has been deleted", async () => {
		const deleted = await registerUser({ email: track(uniqueEmail()) })
		const deletedAccessToken = deleted.client.jar.get(ACCESS_TOKEN_COOKIE_NAME)
		if (!deletedAccessToken) throw new Error("expected register to set an access token cookie")

		const before = await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, deletedAccessToken))
		expect(before.status).toBe(200)

		await deleteTestUsersByEmail([deleted.email])

		await expectUnauthorized(await get(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, deletedAccessToken)))
	})
})
