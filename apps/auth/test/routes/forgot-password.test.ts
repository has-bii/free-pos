import { env } from "cloudflare:workers"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import {
	deleteTestUsersByEmail,
	deleteVerificationsByIdentifiers,
	expireVerification,
	findVerificationsByIdentifier,
} from "../helpers/db"
import { capturedEmails, installEmailCapture, resetEmailCapture } from "../helpers/email"
import { registerGoogleUser } from "../helpers/google"
import {
	type MessageBody,
	postJson,
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
	// `verification` has no FK to `user` — deleting the user does not remove
	// the rows, so clean them up explicitly alongside the users.
	await deleteVerificationsByIdentifiers(createdEmails)
	await deleteTestUsersByEmail(createdEmails)
})

beforeEach(() => {
	resetEmailCapture()
	installEmailCapture()
})

const PATH = "/recovery/forgot-password"
const GENERIC_MESSAGE = "If an account exists for that email, a password reset link has been sent."
const RESET_URL_PREFIX = `${env.FREE_POS_FRONTEND_ORIGIN}/auth/reset-password?token=`

const expectGenericSuccess = async (res: Response) => {
	expect(await readJson<MessageBody>(res)).toEqual({ success: true, message: GENERIC_MESSAGE, data: null })
}

describe("POST /recovery/forgot-password", () => {
	// Case 1
	it("sends a reset link to an existing email and stores a single-use token hash", async () => {
		const { email } = await registerUser({ email: track(uniqueEmail()) })

		const res = await postJson(PATH, { email })
		expect(res.status).toBe(200)
		await expectGenericSuccess(res)
		// No cookies: the request side of recovery creates no session.
		expect(res.headers.getSetCookie()).toHaveLength(0)

		const rows = await findVerificationsByIdentifier(email)
		expect(rows).toHaveLength(1)
		const row = rows[0]
		if (!row) throw new Error("expected a verification row")

		expect(row.identifier).toBe(email)
		// A SHA-256 hash, never the raw token.
		expect(row.value).toMatch(/^[0-9a-f]{64}$/)

		// ~1 hour TTL, forward from insertion.
		const now = Date.now()
		expect(row.expiresAt.getTime()).toBeGreaterThan(now + 30 * 60 * 1000)
		expect(row.expiresAt.getTime()).toBeLessThan(now + 90 * 60 * 1000)

		expect(capturedEmails).toHaveLength(1)
		const sent = capturedEmails[0]
		if (!sent) throw new Error("expected a captured email")
		expect(sent.to).toBe(email)
		expect(sent.resetUrl.startsWith(RESET_URL_PREFIX)).toBe(true)
	})

	// Case 2 — proves the hash the Worker stored matches the link it mailed.
	it("round-trips: the raw token in the emailed link actually resets the password", async () => {
		const { email } = await registerUser({ email: track(uniqueEmail()) })

		const res = await postJson(PATH, { email })
		expect(res.status).toBe(200)

		const token = capturedEmails[0]?.resetUrl.split("token=")[1]
		expect(token).toEqual(expect.any(String))

		const reset = await postJson("/recovery/reset-password", { token, password: "brand-new-password" })
		expect(reset.status).toBe(200)

		const login = await postJson("/login/email", { email, password: "brand-new-password" })
		expect(login.status).toBe(200)
	})

	// Case 3 — OAuth-only users can add a password through recovery.
	it("sends a reset link to a user without a credential account", async () => {
		const email = track(uniqueEmail())
		await registerGoogleUser(email)

		const res = await postJson(PATH, { email })
		expect(res.status).toBe(200)
		await expectGenericSuccess(res)
		expect(await findVerificationsByIdentifier(email)).toHaveLength(1)
		expect(capturedEmails).toHaveLength(1)
		expect(capturedEmails[0]?.to).toBe(email)
	})

	// Case 4 — anti-enumeration: identical 200, no email, no row.
	it("returns the generic message for an unknown email without sending or storing anything", async () => {
		const email = uniqueEmail()

		const res = await postJson(PATH, { email })
		expect(res.status).toBe(200)
		await expectGenericSuccess(res)

		expect(await findVerificationsByIdentifier(email)).toHaveLength(0)
		expect(capturedEmails).toHaveLength(0)
	})

	// Case 4
	it("rejects an invalid email format", async () => {
		const res = await postJson(PATH, { email: "not-an-email" })
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.success).toBe(false)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.email).toEqual({ message: "Enter a valid email address." })
	})

	// Case 5 — cooldown: the existing link stays valid, no re-send, no rotate.
	it("keeps the existing link on a second request while the first is live", async () => {
		const { email } = await registerUser({ email: track(uniqueEmail()) })

		const first = await postJson(PATH, { email })
		expect(first.status).toBe(200)
		const rowsAfterFirst = await findVerificationsByIdentifier(email)
		expect(rowsAfterFirst).toHaveLength(1)

		const second = await postJson(PATH, { email })
		expect(second.status).toBe(200)
		await expectGenericSuccess(second)

		const rowsAfterSecond = await findVerificationsByIdentifier(email)
		expect(rowsAfterSecond).toHaveLength(1)
		expect(rowsAfterSecond[0]?.value).toBe(rowsAfterFirst[0]?.value)
		expect(capturedEmails).toHaveLength(1)
	})

	// Case 6 — once the row has expired, re-requesting rotates it.
	it("rotates the link once the previous one has expired", async () => {
		const { email } = await registerUser({ email: track(uniqueEmail()) })

		expect((await postJson(PATH, { email })).status).toBe(200)
		const rowsBefore = await findVerificationsByIdentifier(email)
		expect(rowsBefore).toHaveLength(1)
		const stale = rowsBefore[0]
		if (!stale) throw new Error("expected a verification row")

		await expireVerification(stale.id)
		// Drop the send recorded for the first request; only the rotation's
		// send may remain by the end of the test.
		resetEmailCapture()

		const res = await postJson(PATH, { email })
		expect(res.status).toBe(200)

		// The expired row is left in place (inert) and a fresh one is added.
		const rowsAfter = await findVerificationsByIdentifier(email)
		expect(rowsAfter).toHaveLength(2)
		const fresh = rowsAfter.find((r) => r.expiresAt.getTime() > Date.now())
		expect(fresh).toBeDefined()
		expect(fresh?.id).not.toBe(stale.id)
		expect(fresh?.value).not.toBe(stale.value)
		expect(capturedEmails).toHaveLength(1)
	})

	// Case 7 — normalization mirrors login/register (trim + lowercase server-side).
	it("trims and lowercases the email before storing the row", async () => {
		const { email } = await registerUser({ email: track(uniqueEmail()) })
		const messy = `  ${email.toUpperCase()} `

		const res = await postJson(PATH, { email: messy })
		expect(res.status).toBe(200)

		const rows = await findVerificationsByIdentifier(email)
		expect(rows).toHaveLength(1)
		expect(rows[0]?.identifier).toBe(email)
	})
})
