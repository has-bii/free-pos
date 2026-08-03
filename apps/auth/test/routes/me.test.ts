import { env } from "cloudflare:workers"
import jwt from "@tsndr/cloudflare-worker-jwt"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail } from "../helpers/db"
import {
	bearer,
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

beforeAll(async () => {
	fixture = await registerUser({ email: track(uniqueEmail()) })
})

const expectUnauthorized = async (res: Response) => {
	expect(res.status).toBe(401)
	expect((await readJson<MessageBody>(res)).message).toBe("Unauthorized.")
}

describe("GET /auth/me", () => {
	// Case 17
	it("returns the current user for a valid access token", async () => {
		const res = await get(PATH, bearer(fixture.token.accessToken))
		expect(res.status).toBe(200)

		const body = await readJson<MeSuccessBody>(res)
		expect(body.data.user.id).toBe(fixture.user.id)
		expect(body.data.user.email).toBe(fixture.email)
	})

	// Case 18
	it("rejects a request with no Authorization header", async () => {
		await expectUnauthorized(await get(PATH))
	})

	// Case 19
	it("rejects a non-bearer scheme", async () => {
		await expectUnauthorized(await get(PATH, { Authorization: "Basic abc123" }))
	})

	// Case 20 — covers the `rest.length > 0` branch in middleware/auth.ts.
	it("rejects a header with extra segments", async () => {
		await expectUnauthorized(
			await get(PATH, {
				Authorization: `Bearer ${fixture.token.accessToken} extra`,
			}),
		)
	})

	// Case 21
	it("rejects an empty bearer token", async () => {
		await expectUnauthorized(await get(PATH, { Authorization: "Bearer " }))
	})

	// Case 22
	it("rejects a garbage token", async () => {
		await expectUnauthorized(await get(PATH, bearer("not-a-real-token")))
	})

	// Case 22b — well-formed but signed with the wrong key.
	it("rejects a token with a bad signature", async () => {
		const forged = await jwt.sign(
			{ sub: fixture.user.id, type: "access" },
			"not-the-real-signing-secret",
			"HS256",
		)
		await expectUnauthorized(await get(PATH, bearer(forged)))
	})

	// Case 23 — refresh tokens live 30 days against the access token's 15
	// minutes, so accepting one here would be a real privilege escalation.
	it("rejects a refresh token used as a bearer token", async () => {
		await expectUnauthorized(
			await get(PATH, bearer(fixture.token.refreshToken)),
		)
	})

	// Case 24 — the secret comes from the binding rather than a second copy of
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
		await expectUnauthorized(await get(PATH, bearer(expired)))
	})

	// Case 25 — covers `!foundUser` in me.handlers.ts, which is otherwise dead
	// code: requireAuth never touches the DB, so the token stays valid.
	it("rejects a valid token whose user has been deleted", async () => {
		const deleted = await registerUser({ email: track(uniqueEmail()) })

		const before = await get(PATH, bearer(deleted.token.accessToken))
		expect(before.status).toBe(200)

		await deleteTestUsersByEmail([deleted.email])

		await expectUnauthorized(await get(PATH, bearer(deleted.token.accessToken)))
	})
})
