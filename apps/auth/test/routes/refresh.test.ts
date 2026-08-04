import { env } from "cloudflare:workers"
import jwt from "@tsndr/cloudflare-worker-jwt"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail, findSessionsByUserId } from "../helpers/db"
import {
	bearer,
	get,
	type MeSuccessBody,
	type MessageBody,
	postJson,
	postRaw,
	type RefreshSuccessBody,
	readJson,
	registerUser,
	uniqueEmail,
	type ValidationFailureBody,
} from "../helpers/http"

const createdEmails: string[] = []
const track = (email: string) => {
	createdEmails.push(email)
	return email
}

afterAll(async () => {
	await deleteTestUsersByEmail(createdEmails)
})

const PATH = "/auth/refresh"

// One shared fixture for most cases; a fresh user is only needed where the
// user itself must be deleted (case 36).
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
}

describe("POST /auth/refresh", () => {
	// Case 27
	it("rotates a valid refresh token", async () => {
		await sleep(1100)
		const res = await postJson(PATH, {
			refreshToken: fixture.token.refreshToken,
		})
		expect(res.status).toBe(200)

		const body = await readJson<RefreshSuccessBody>(res)
		expect(body.data.token.accessToken).toEqual(expect.any(String))
		expect(body.data.token.refreshToken).toEqual(expect.any(String))
		expect(body.data.token.expiresIn).toBe(900)
		expect(body.data.token.accessToken).not.toBe(fixture.token.accessToken)
		expect(body.data.token.refreshToken).not.toBe(fixture.token.refreshToken)

		// Case 28 — the new access token authenticates.
		const me = await get("/auth/me", bearer(body.data.token.accessToken))
		expect(me.status).toBe(200)
		const meBody = await readJson<MeSuccessBody>(me)
		expect(meBody.data.user.id).toBe(fixture.user.id)

		// Case 29 — the presented refresh token is dead after rotation.
		const replay = await postJson(PATH, {
			refreshToken: fixture.token.refreshToken,
		})
		await expectInvalidToken(replay)

		// Case 31 — the new refresh token continues the chain.
		const second = await postJson(PATH, {
			refreshToken: body.data.token.refreshToken,
		})
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
		const res = await postJson(PATH, {
			refreshToken: seeded.token.refreshToken,
		})
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
		await expectInvalidToken(await postJson(PATH, { refreshToken: "not-a-real-token" }))
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
		await expectInvalidToken(await postJson(PATH, { refreshToken: expired }))
	})

	// Case 34
	it("rejects an access token used as a refresh token", async () => {
		await expectInvalidToken(await postJson(PATH, { refreshToken: fixture.token.accessToken }))
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
		await expectInvalidToken(await postJson(PATH, { refreshToken: forged }))
	})

	// Case 36
	it("rejects a refresh token for a deleted user", async () => {
		const deleted = await registerUser({ email: track(uniqueEmail()) })
		await deleteTestUsersByEmail([deleted.email])

		await expectInvalidToken(await postJson(PATH, { refreshToken: deleted.token.refreshToken }))
	})

	// Case 37
	it("rejects a missing or empty refreshToken field", async () => {
		const empty = await postJson(PATH, { refreshToken: "" })
		expect(empty.status).toBe(400)
		const emptyBody = await readJson<ValidationFailureBody>(empty)
		expect(emptyBody.message).toBe("Validation failed.")
		expect(emptyBody.error.refreshToken).toBe("Refresh token is required.")

		const missing = await postJson(PATH, {})
		expect(missing.status).toBe(400)
		const missingBody = await readJson<ValidationFailureBody>(missing)
		expect(missingBody.message).toBe("Validation failed.")
		expect(missingBody.error.refreshToken).toEqual(expect.any(String))
	})

	// Case 38
	it("rejects a malformed JSON body", async () => {
		const res = await postRaw(PATH, "{ not json", "application/json")
		expect(res.status).toBe(400)

		const body = await readJson<MessageBody>(res)
		expect(body.message).toBe("Malformed JSON in request body")
	})

	// Case 39 — the only test that distinguishes the CAS from a read-then-write.
	it("admits exactly one winner for two concurrent refreshes of the same token", async () => {
		const seeded = await registerUser({ email: track(uniqueEmail()) })

		const [a, b] = await Promise.all([
			postJson(PATH, { refreshToken: seeded.token.refreshToken }),
			postJson(PATH, { refreshToken: seeded.token.refreshToken }),
		])

		const statuses = [a.status, b.status].sort()
		expect(statuses).toEqual([200, 401])
	})
})
