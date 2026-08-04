import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { afterAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail, findSessionsByUserId } from "../helpers/db"
import {
	cookieHeader,
	get,
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

const PATH = "/auth/logout"

const expectUnauthorized = async (res: Response) => {
	expect(res.status).toBe(401)
	expect((await readJson<MessageBody>(res)).message).toBe("Unauthorized.")
}

const accessTokenOf = (fixture: Awaited<ReturnType<typeof registerUser>>): string => {
	const token = fixture.client.jar.get(ACCESS_TOKEN_COOKIE_NAME)
	if (!token) throw new Error("expected register to set an access token cookie")
	return token
}

describe("POST /auth/logout", () => {
	// Case 1
	it("deletes the session backing the caller's access token, and clears both cookies", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })

		const res = await post(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, accessTokenOf(fixture)))
		expect(res.status).toBe(200)
		expect((await readJson<MessageBody>(res)).message).toBe("Logged out.")

		const cookies = res.headers.getSetCookie()
		expect(cookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`) && c.includes("Max-Age=0"))).toBe(true)
		expect(cookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`) && c.includes("Max-Age=0"))).toBe(true)

		const sessions = await findSessionsByUserId(fixture.user.id)
		expect(sessions).toHaveLength(0)
	})

	// Case 2
	it("invalidates the session's refresh token end-to-end", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })
		const refreshToken = fixture.client.jar.get(REFRESH_TOKEN_COOKIE_NAME)
		if (!refreshToken) throw new Error("expected register to set a refresh token cookie")

		await post(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, accessTokenOf(fixture)))

		const refreshRes = await post("/auth/refresh", cookieHeader(REFRESH_TOKEN_COOKIE_NAME, refreshToken))
		expect(refreshRes.status).toBe(401)
		expect((await readJson<MessageBody>(refreshRes)).message).toBe("Invalid or expired refresh token.")
	})

	// Case 3 — the cookie itself would be gone from a real browser after the
	// first logout, but the underlying access token remains valid until its own
	// TTL; repeating the call with the same raw token must still succeed.
	it("is idempotent — repeat logout with the same access token still returns 200", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })
		const token = accessTokenOf(fixture)

		const first = await post(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, token))
		expect(first.status).toBe(200)

		const second = await post(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, token))
		expect(second.status).toBe(200)
		expect((await readJson<MessageBody>(second)).message).toBe("Logged out.")
	})

	// Case 4
	it("rejects a request with no access token cookie", async () => {
		await expectUnauthorized(await post(PATH))
	})

	// Case 5 — pins the Non-goal: the access token survives logout until its
	// own TTL expiry, mirroring how refresh.test.ts pins rotation's equivalent
	// behavior.
	it("does not revoke the still-live access token", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })
		const token = accessTokenOf(fixture)

		await post(PATH, cookieHeader(ACCESS_TOKEN_COOKIE_NAME, token))

		const me = await get("/auth/me", cookieHeader(ACCESS_TOKEN_COOKIE_NAME, token))
		expect(me.status).toBe(200)
		const meBody = await readJson<MeSuccessBody>(me)
		expect(meBody.data.user.id).toBe(fixture.user.id)
	})
})
