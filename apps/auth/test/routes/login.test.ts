import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail, findSessionsByUserId } from "../helpers/db"
import {
	type AuthSuccessBody,
	DEFAULT_PASSWORD,
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
	await deleteTestUsersByEmail(createdEmails)
})

const PATH = "/login/email"

// One shared fixture for the whole file: registering costs a real
// 50,000-iteration PBKDF2 hash plus several TiDB round-trips.
let fixture: Awaited<ReturnType<typeof registerUser>>

beforeAll(async () => {
	fixture = await registerUser({ email: track(uniqueEmail()) })
})

describe("POST /login/email", () => {
	// Case 10
	it("returns the user and sets auth cookies for correct credentials", async () => {
		const res = await postJson(PATH, {
			email: fixture.email,
			password: fixture.password,
		})
		expect(res.status).toBe(200)

		const body = await readJson<AuthSuccessBody>(res)
		expect(body.data.user.id).toBe(fixture.user.id)
		expect(body.data.user.email).toBe(fixture.email)
		expect(body).not.toHaveProperty("data.token")

		const cookies = res.headers.getSetCookie()
		expect(cookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`))).toBe(true)
		expect(cookies.some((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`))).toBe(true)
	})

	// Case 11
	it("creates a new session row on each login", async () => {
		const before = await findSessionsByUserId(fixture.user.id)

		const res = await postJson(PATH, {
			email: fixture.email,
			password: fixture.password,
		})
		expect(res.status).toBe(200)

		const after = await findSessionsByUserId(fixture.user.id)
		expect(after.length).toBe(before.length + 1)

		const added = after.find((s) => !before.some((b) => b.id === s.id))
		expect(added).toBeDefined()
		expect(added?.token).not.toBe(added?.id)
	})

	// Case 12
	it("rejects a wrong password", async () => {
		const res = await postJson(PATH, {
			email: fixture.email,
			password: `${fixture.password}-wrong`,
		})
		expect(res.status).toBe(401)
		expect((await readJson<MessageBody>(res)).message).toBe("Invalid email or password.")
	})

	// Case 13 — identical message to case 12, so the endpoint does not leak
	// which addresses are registered.
	it("rejects an unknown email with the same message", async () => {
		const res = await postJson(PATH, {
			email: uniqueEmail(),
			password: DEFAULT_PASSWORD,
		})
		expect(res.status).toBe(401)
		expect((await readJson<MessageBody>(res)).message).toBe("Invalid email or password.")
	})

	// Case 14
	it("rejects an invalid email format", async () => {
		const res = await postJson(PATH, {
			email: "not-an-email",
			password: DEFAULT_PASSWORD,
		})
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.email).toEqual({ message: "Enter a valid email address." })
	})

	// Case 15
	it("rejects an empty password", async () => {
		const res = await postJson(PATH, { email: fixture.email, password: "" })
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.password).toEqual({ message: "Password is required." })
	})

	// Case 16
	it("matches the email case-insensitively", async () => {
		const email = track(uniqueEmail())
		await registerUser({ email: email.toUpperCase(), password: "another-pw" })

		const lower = await postJson(PATH, { email, password: "another-pw" })
		expect(lower.status).toBe(200)

		const upper = await postJson(PATH, {
			email: `  ${email.toUpperCase()} `,
			password: "another-pw",
		})
		expect(upper.status).toBe(200)
	})
})
