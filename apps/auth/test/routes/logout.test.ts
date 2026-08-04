import { afterAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail, findSessionsByUserId } from "../helpers/db"
import {
	bearer,
	get,
	type MeSuccessBody,
	type MessageBody,
	post,
	postJson,
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

describe("POST /auth/logout", () => {
	// Case 1
	it("deletes the session backing the caller's access token", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })

		const res = await post(PATH, bearer(fixture.token.accessToken))
		expect(res.status).toBe(200)
		expect((await readJson<MessageBody>(res)).message).toBe("Logged out.")

		const sessions = await findSessionsByUserId(fixture.user.id)
		expect(sessions).toHaveLength(0)
	})

	// Case 2
	it("invalidates the session's refresh token end-to-end", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })

		await post(PATH, bearer(fixture.token.accessToken))

		const refreshRes = await postJson("/auth/refresh", { refreshToken: fixture.token.refreshToken })
		expect(refreshRes.status).toBe(401)
		expect((await readJson<MessageBody>(refreshRes)).message).toBe("Invalid or expired refresh token.")
	})

	// Case 3
	it("is idempotent — repeat logout still returns 200", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })

		const first = await post(PATH, bearer(fixture.token.accessToken))
		expect(first.status).toBe(200)

		const second = await post(PATH, bearer(fixture.token.accessToken))
		expect(second.status).toBe(200)
		expect((await readJson<MessageBody>(second)).message).toBe("Logged out.")
	})

	// Case 4
	it("rejects a request with no Authorization header", async () => {
		await expectUnauthorized(await post(PATH))
	})

	// Case 5 — pins the Non-goal: the access token survives logout until its
	// own TTL expiry, mirroring how refresh.test.ts pins rotation's equivalent
	// behavior.
	it("does not revoke the still-live access token", async () => {
		const fixture = await registerUser({ email: track(uniqueEmail()) })

		await post(PATH, bearer(fixture.token.accessToken))

		const me = await get("/auth/me", bearer(fixture.token.accessToken))
		expect(me.status).toBe(200)
		const meBody = await readJson<MeSuccessBody>(me)
		expect(meBody.data.user.id).toBe(fixture.user.id)
	})
})
