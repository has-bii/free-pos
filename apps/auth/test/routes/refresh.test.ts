import { env } from "cloudflare:workers"
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import jwt from "@tsndr/cloudflare-worker-jwt"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail, findSessionsByUserId } from "../helpers/db"
import {
	cookieHeader,
	type MeSuccessBody,
	type MessageBody,
	post,
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

const PATH = "/refresh"

// One shared fixture for most cases; a fresh user is only needed where the
// user itself must be deleted or the session row is asserted on directly.
let fixture: Awaited<ReturnType<typeof registerUser>>

beforeAll(async () => {
	fixture = await registerUser({ email: track(uniqueEmail()) })
})

/**
 * The access token's claims (`sub`, `sid`) are identical across a rotation;
 * only `exp` (second precision) changes them. Without a real gap, a refresh
 * fired immediately after the token it rotates can land in the same second
 * and mint a byte-identical JWT — harmless (nothing denylists old access
 * tokens), but it breaks a same-second "the token changed" assertion.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const expectInvalidToken = async (res: Response) => {
	expect(res.status).toBe(401)
	expect((await readJson<MessageBody>(res)).message).toBe("Invalid or expired refresh token.")

	// A dead refresh token must not linger in the browser, so every failure
	// clears both cookies too.
	const cookies = res.headers.getSetCookie()
	expect(cookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`) && c.includes("Max-Age=0"))).toBe(true)
	expect(cookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`) && c.includes("Max-Age=0"))).toBe(true)
}

describe("POST /refresh", () => {
	// Case 27
	it("rotates a valid refresh token", async () => {
		const oldAccessToken = fixture.client.jar.get(ACCESS_TOKEN_COOKIE_NAME)
		const oldRefreshToken = fixture.client.jar.get(REFRESH_TOKEN_COOKIE_NAME)
		if (!oldAccessToken || !oldRefreshToken) throw new Error("expected register to set both cookies")

		await sleep(1100)
		// The refresh cookie is Path-scoped to /refresh, so the client's
		// jar attaches it automatically here — this exercises that scoping.
		const res = await fixture.client.post(PATH)
		expect(res.status).toBe(200)
		expect((await readJson<MessageBody>(res)).message).toBe("ok")

		const newAccessToken = fixture.client.jar.get(ACCESS_TOKEN_COOKIE_NAME)
		const newRefreshToken = fixture.client.jar.get(REFRESH_TOKEN_COOKIE_NAME)
		expect(newAccessToken).toEqual(expect.any(String))
		expect(newRefreshToken).toEqual(expect.any(String))
		expect(newAccessToken).not.toBe(oldAccessToken)
		expect(newRefreshToken).not.toBe(oldRefreshToken)

		// Case 28 — the new access token authenticates.
		const me = await fixture.client.get("/me")
		expect(me.status).toBe(200)
		const meBody = await readJson<MeSuccessBody>(me)
		expect(meBody.data.user.id).toBe(fixture.user.id)

		// Case 29 — the presented refresh token is dead after rotation.
		const replay = await post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, oldRefreshToken))
		await expectInvalidToken(replay)

		// Case 31 — the new refresh token continues the chain.
		const second = await fixture.client.post(PATH)
		expect(second.status).toBe(200)
	})

	// Case 30
	it("rotates the session row in place", async () => {
		const seeded = await registerUser({ email: track(uniqueEmail()) })
		const before = await findSessionsByUserId(seeded.user.id)
		expect(before).toHaveLength(1)
		const beforeRow = before[0]
		if (!beforeRow) throw new Error("expected a seeded session row")

		await sleep(1100)
		const res = await seeded.client.post(PATH)
		expect(res.status).toBe(200)

		const after = await findSessionsByUserId(seeded.user.id)
		expect(after).toHaveLength(1)
		const afterRow = after[0]
		if (!afterRow) throw new Error("expected the session row to persist")

		expect(afterRow.id).toBe(beforeRow.id)
		expect(afterRow.token).not.toBe(beforeRow.token)
		expect(afterRow.expiresAt.getTime()).toBeGreaterThan(beforeRow.expiresAt.getTime())
	})

	// Case 32
	it("rejects a garbage string", async () => {
		await expectInvalidToken(await post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, "not-a-real-token")))
	})

	// Case 33
	it("rejects an expired refresh token", async () => {
		const expired = await jwt.sign(
			{
				sub: fixture.user.id,
				sid: fixture.user.id,
				jti: fixture.user.id,
				type: "refresh",
				exp: Math.floor(Date.now() / 1000) - 60,
			},
			env.SERO_POS_JWT_SECRET,
			"HS256",
		)
		await expectInvalidToken(await post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, expired)))
	})

	// Case 34
	it("rejects an access token used as a refresh token", async () => {
		const accessToken = fixture.client.jar.get(ACCESS_TOKEN_COOKIE_NAME)
		if (!accessToken) throw new Error("expected register to set an access token cookie")
		await expectInvalidToken(await post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, accessToken)))
	})

	// Case 35
	it("rejects a refresh token signed with the wrong secret", async () => {
		const forged = await jwt.sign(
			{
				sub: fixture.user.id,
				sid: fixture.user.id,
				jti: fixture.user.id,
				type: "refresh",
				exp: Math.floor(Date.now() / 1000) + 60,
			},
			"not-the-real-signing-secret",
			"HS256",
		)
		await expectInvalidToken(await post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, forged)))
	})

	// Case 36
	it("rejects a refresh token for a deleted user", async () => {
		const deleted = await registerUser({ email: track(uniqueEmail()) })
		const refreshToken = deleted.client.jar.get(REFRESH_TOKEN_COOKIE_NAME)
		if (!refreshToken) throw new Error("expected register to set a refresh token cookie")

		await deleteTestUsersByEmail([deleted.email])

		await expectInvalidToken(await post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, refreshToken)))
	})

	// Case 37
	it("rejects a request with no refresh token cookie", async () => {
		await expectInvalidToken(await post(PATH))
	})

	// Case 38 — the only test that distinguishes the CAS from a read-then-write.
	it("admits exactly one winner for two concurrent refreshes of the same token", async () => {
		const seeded = await registerUser({ email: track(uniqueEmail()) })
		const refreshToken = seeded.client.jar.get(REFRESH_TOKEN_COOKIE_NAME)
		if (!refreshToken) throw new Error("expected register to set a refresh token cookie")

		const [a, b] = await Promise.all([
			post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, refreshToken)),
			post(PATH, cookieHeader(REFRESH_TOKEN_COOKIE_NAME, refreshToken)),
		])

		const statuses = [a.status, b.status].sort()
		expect(statuses).toEqual([200, 401])
	})
})
