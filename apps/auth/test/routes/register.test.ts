import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { afterAll, describe, expect, it } from "vitest"
import { deleteTestUsersByEmail, findAccountsByUserId, findSessionsByUserId, findUserByEmail } from "../helpers/db"
import {
	type AuthSuccessBody,
	DEFAULT_PASSWORD,
	type MessageBody,
	postJson,
	postRaw,
	readJson,
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

const PATH = "/auth/register/email"

const validBody = (email: string) => ({
	name: "Test User",
	email,
	password: DEFAULT_PASSWORD,
})

describe("POST /auth/register/email", () => {
	// Case 1
	it("creates a user and sets httpOnly auth cookies, never a token in the body", async () => {
		const email = track(uniqueEmail())

		const res = await postJson(PATH, validBody(email))
		expect(res.status).toBe(201)

		const body = await readJson<AuthSuccessBody>(res)
		expect(body.data.user).toMatchObject({ email, name: "Test User" })
		expect(body.data.user.id).toEqual(expect.any(String))
		expect(body).not.toHaveProperty("data.token")

		const cookies = res.headers.getSetCookie()
		const access = cookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE_NAME}=`))
		const refresh = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`))
		expect(access).toBeDefined()
		expect(refresh).toBeDefined()
		expect(access?.split("; ")).toEqual(
			expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=900"]),
		)
		expect(refresh?.split("; ")).toEqual(
			expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/auth/refresh", "Max-Age=2592000"]),
		)
	})

	// Case 2 — a 201 looks identical whether or not the child rows were written.
	it("writes the user, credential account, and session rows", async () => {
		const email = track(uniqueEmail())

		const res = await postJson(PATH, validBody(email))
		expect(res.status).toBe(201)

		const storedUser = await findUserByEmail(email)
		expect(storedUser).not.toBeNull()
		expect(storedUser?.name).toBe("Test User")
		expect(storedUser?.emailVerified).toBe(false)

		const userId = storedUser?.id as string

		const accounts = await findAccountsByUserId(userId)
		expect(accounts).toHaveLength(1)
		expect(accounts[0]?.providerId).toBe("credential")
		expect(accounts[0]?.accountId).toBe(userId)

		const sessions = await findSessionsByUserId(userId)
		expect(sessions).toHaveLength(1)
		// `id` is the stable session identity; `token` is the rotating credential.
		expect(sessions[0]?.token).not.toBe(sessions[0]?.id)
		expect(sessions[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now())
	})

	// Case 3
	it("stores a pbkdf2 hash, never the plaintext password", async () => {
		const email = track(uniqueEmail())

		const res = await postJson(PATH, validBody(email))
		expect(res.status).toBe(201)

		const storedUser = await findUserByEmail(email)
		expect(storedUser).not.toBeNull()

		const accounts = await findAccountsByUserId(storedUser?.id as string)
		const stored = accounts[0]?.password

		expect(stored).toEqual(expect.any(String))
		expect(stored?.startsWith("pbkdf2-sha256$")).toBe(true)
		expect(stored).not.toBe(DEFAULT_PASSWORD)
		expect(stored).not.toContain(DEFAULT_PASSWORD)
	})

	// Case 4
	it("trims and lowercases the email before storing it", async () => {
		const email = track(uniqueEmail())
		const messy = `  ${email.toUpperCase()} `

		const res = await postJson(PATH, { ...validBody(email), email: messy })
		expect(res.status).toBe(201)

		const body = await readJson<AuthSuccessBody>(res)
		expect(body.data.user.email).toBe(email)
		expect(await findUserByEmail(email)).not.toBeNull()
	})

	// Case 5
	it("rejects a whitespace-only name", async () => {
		const res = await postJson(PATH, {
			...validBody(uniqueEmail()),
			name: "   ",
		})
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.name).toBe("Name is required.")
	})

	// Case 6
	it("rejects an invalid email format", async () => {
		const res = await postJson(PATH, {
			...validBody(uniqueEmail()),
			email: "not-an-email",
		})
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.email).toBe("Enter a valid email address.")
	})

	// Case 7
	it("rejects a password shorter than 8 characters", async () => {
		const res = await postJson(PATH, {
			...validBody(uniqueEmail()),
			password: "short",
		})
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.message).toBe("Validation failed.")
		expect(body.error.password).toBe("Password must be at least 8 characters.")
	})

	// Case 8a — a non-JSON content type makes Hono's validator skip parsing and
	// hand valibot an empty object, so every field fails.
	it("rejects a non-JSON body", async () => {
		const res = await postRaw(PATH, "name=x&email=y", "text/plain")
		expect(res.status).toBe(400)

		const body = await readJson<ValidationFailureBody>(res)
		expect(body.message).toBe("Validation failed.")
		expect(Object.keys(body.error).sort()).toEqual(["email", "name", "password"])
	})

	// Case 8b
	it("rejects malformed JSON", async () => {
		const res = await postRaw(PATH, "{ not json", "application/json")
		expect(res.status).toBe(400)

		const body = await readJson<MessageBody>(res)
		expect(body.message).toBe("Malformed JSON in request body")
	})

	// Case 9
	it("rejects a duplicate email", async () => {
		const email = track(uniqueEmail())

		expect((await postJson(PATH, validBody(email))).status).toBe(201)

		const res = await postJson(PATH, validBody(email))
		expect(res.status).toBe(409)
		expect((await readJson<MessageBody>(res)).message).toBe("Email already registered.")
	})
})
