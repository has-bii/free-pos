import { Password } from "@repo/auth/lib/password"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import {
	deleteTestUsersByEmail,
	deleteVerificationsByIdentifiers,
	expireVerification,
	findAccountsByUserId,
	findSessionsByUserId,
	findUserByEmail,
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
	await deleteVerificationsByIdentifiers(createdEmails)
	await deleteTestUsersByEmail(createdEmails)
})

beforeEach(() => {
	resetEmailCapture()
	installEmailCapture()
})

const PATH = "/recovery/reset-password"
const INVALID_TOKEN_MESSAGE = "Invalid or expired reset token."
const NEW_PASSWORD = "brand-new-password"

/** Plays the mailbox holder: requests a real link and returns its raw token. */
const requestResetToken = async (email: string): Promise<string> => {
	const res = await postJson("/recovery/forgot-password", { email })
	if (res.status !== 200) throw new Error(`requesting a reset link failed: ${res.status}`)

	const sent = capturedEmails.find((e) => e.to === email)
	const token = sent?.resetUrl.split("token=")[1]
	if (!token) throw new Error("no reset email with a token was captured")
	return token
}

describe("POST /recovery/reset-password", () => {
	// Case 1
	it("resets the password, marks the email verified, and kills the old password", async () => {
		const user = await registerUser({ email: track(uniqueEmail()) })
		const token = await requestResetToken(user.email)

		const res = await postJson(PATH, { token, password: NEW_PASSWORD })
		expect(res.status).toBe(200)
		const body = await readJson<MessageBody>(res)
		expect(body.success).toBe(true)
		expect(body.message).toBe("Password reset successfully.")
		expect(body.data).toBeNull()
		// No session, no cookies — the user must log in again.
		expect(res.headers.getSetCookie()).toHaveLength(0)

		const storedUser = await findUserByEmail(user.email)
		expect(storedUser).not.toBeNull()
		// Possession of the mailbox is proof enough.
		expect(storedUser?.emailVerified).toBe(true)

		const accounts = await findAccountsByUserId(storedUser?.id as string)
		expect(accounts).toHaveLength(1)
		const storedPassword = accounts[0]?.password
		expect(storedPassword).toEqual(expect.any(String))
		expect(await Password.verifyPassword(NEW_PASSWORD, storedPassword as string)).toBe(true)

		// Old password is dead, new one logs in.
		const oldLogin = await postJson("/login/email", { email: user.email, password: user.password })
		expect(oldLogin.status).toBe(401)
		const newLogin = await postJson("/login/email", { email: user.email, password: NEW_PASSWORD })
		expect(newLogin.status).toBe(200)

		// Single-use: the row was consumed.
		expect(await findVerificationsByIdentifier(user.email)).toHaveLength(0)
	})

	// Case 2 — OAuth-only users receive a credential account on reset.
	it("creates a credential account when the user has no password account", async () => {
		const email = track(uniqueEmail())
		await registerGoogleUser(email)
		const token = await requestResetToken(email)

		const res = await postJson(PATH, { token, password: NEW_PASSWORD })
		expect(res.status).toBe(200)

		const user = await findUserByEmail(email)
		expect(user).not.toBeNull()
		if (!user) throw new Error("expected the Google user to exist")

		const accounts = await findAccountsByUserId(user.id)
		expect(accounts).toHaveLength(2)
		const credential = accounts.find((account) => account.providerId === "credential")
		expect(credential?.accountId).toBe(user.id)
		expect(credential?.password).toEqual(expect.any(String))
		expect(await Password.verifyPassword(NEW_PASSWORD, credential?.password as string)).toBe(true)

		expect((await postJson("/login/email", { email, password: NEW_PASSWORD })).status).toBe(200)
	})

	// Case 3
	it("rejects a replay of the same token", async () => {
		const user = await registerUser({ email: track(uniqueEmail()) })
		const token = await requestResetToken(user.email)

		expect((await postJson(PATH, { token, password: "first-new-password" })).status).toBe(200)

		const replay = await postJson(PATH, { token, password: "second-new-password" })
		expect(replay.status).toBe(400)
		const replayBody = await readJson<MessageBody>(replay)
		expect(replayBody.success).toBe(false)
		expect(replayBody.message).toBe(INVALID_TOKEN_MESSAGE)
	})

	// Case 3
	it("rejects an expired token", async () => {
		const user = await registerUser({ email: track(uniqueEmail()) })
		const token = await requestResetToken(user.email)

		const rows = await findVerificationsByIdentifier(user.email)
		expect(rows).toHaveLength(1)
		const row = rows[0]
		if (!row) throw new Error("expected a verification row")

		await expireVerification(row.id)

		const res = await postJson(PATH, { token, password: NEW_PASSWORD })
		expect(res.status).toBe(400)
		const body = await readJson<MessageBody>(res)
		expect(body.success).toBe(false)
		expect(body.message).toBe(INVALID_TOKEN_MESSAGE)
	})

	// Case 4 — one message for every failure mode, no oracle.
	it("rejects a garbage token with the same message", async () => {
		const res = await postJson(PATH, { token: "not-a-real-token", password: NEW_PASSWORD })
		expect(res.status).toBe(400)
		const body = await readJson<MessageBody>(res)
		expect(body.success).toBe(false)
		expect(body.message).toBe(INVALID_TOKEN_MESSAGE)
	})

	// Case 5a — validation rejects before the handler runs, so a real token
	// (from its own fresh user, playing the mailbox holder) must survive.
	it("rejects a password shorter than 8 characters", async () => {
		const user = await registerUser({ email: track(uniqueEmail()) })
		const token = await requestResetToken(user.email)

		const res = await postJson(PATH, { token, password: "short" })
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.success).toBe(false)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.password).toEqual({ message: "Password must be at least 8 characters." })

		// The token was not consumed: validation short-circuited the handler.
		expect(await findVerificationsByIdentifier(user.email)).toHaveLength(1)
	})

	// Case 5b
	it("rejects a missing token", async () => {
		const res = await postJson(PATH, { password: NEW_PASSWORD })
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.success).toBe(false)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.token).toBeDefined()
	})

	// Case 6 — reset creates no session and sets no cookies.
	it("creates no session and sets no cookies", async () => {
		const user = await registerUser({ email: track(uniqueEmail()) })
		const token = await requestResetToken(user.email)

		// The registration session is the only one that exists.
		expect(await findSessionsByUserId(user.user.id)).toHaveLength(1)

		const res = await postJson(PATH, { token, password: NEW_PASSWORD })
		expect(res.status).toBe(200)
		expect(res.headers.getSetCookie()).toHaveLength(0)

		expect(await findSessionsByUserId(user.user.id)).toHaveLength(1)
	})

	// Case 7 — approved decision: existing sessions are not revoked on reset.
	it("leaves existing sessions untouched and their refresh tokens working", async () => {
		const user = await registerUser({ email: track(uniqueEmail()) })
		const token = await requestResetToken(user.email)

		const sessionsBefore = await findSessionsByUserId(user.user.id)
		expect(sessionsBefore).toHaveLength(1)
		const beforeRow = sessionsBefore[0]
		if (!beforeRow) throw new Error("expected a session row")

		const res = await postJson(PATH, { token, password: NEW_PASSWORD })
		expect(res.status).toBe(200)

		const sessionsAfter = await findSessionsByUserId(user.user.id)
		expect(sessionsAfter).toHaveLength(1)
		const afterRow = sessionsAfter[0]
		expect(afterRow?.id).toBe(beforeRow.id)
		expect(afterRow?.token).toBe(beforeRow.token)
		expect(afterRow?.expiresAt.getTime()).toBe(beforeRow.expiresAt.getTime())

		// The pre-reset refresh token still rotates: the session was untouched.
		const refresh = await user.client.post("/refresh")
		expect(refresh.status).toBe(200)
	})
})
