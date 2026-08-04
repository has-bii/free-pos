import { exports } from "cloudflare:workers"

const ORIGIN = "https://example.com"

/**
 * Loopback binding to the Worker's default export — the replacement for the
 * deprecated `SELF` from `cloudflare:test`. Requests go through the real entry
 * point and the whole middleware chain.
 */
const worker = exports.default

/**
 * Every test mints its own address. Hardcoding an email is a latent flake —
 * the suite never truncates, and files run in parallel.
 */
export const uniqueEmail = () => `t-${crypto.randomUUID()}@test.invalid`

export const DEFAULT_PASSWORD = "correct-horse-battery"

export type UserBody = {
	id: string
	name: string
	email: string
	emailVerified: boolean
	image: string | null
}

export type AuthSuccessBody = {
	message: string
	data: {
		user: UserBody
		token: { accessToken: string; refreshToken: string; expiresIn: number }
	}
}

export type RefreshSuccessBody = {
	message: string
	data: {
		token: { accessToken: string; refreshToken: string; expiresIn: number }
	}
}

export type MeSuccessBody = { message: string; data: { user: UserBody } }

export type ValidationFailureBody = {
	message: string
	error: Record<string, string>
}

export type MessageBody = { message: string }

export const readJson = async <T>(res: Response): Promise<T> => {
	return (await res.json()) as T
}

export const get = (path: string, headers?: HeadersInit) => {
	return worker.fetch(`${ORIGIN}${path}`, headers ? { headers } : undefined)
}

export const postJson = (path: string, body: unknown) => {
	return worker.fetch(`${ORIGIN}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
}

/** For bodies `JSON.stringify` cannot produce — malformed or non-JSON. */
export const postRaw = (path: string, body: string, contentType: string) => {
	return worker.fetch(`${ORIGIN}${path}`, {
		method: "POST",
		headers: { "Content-Type": contentType },
		body,
	})
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

/**
 * Seeds a user through the real register endpoint (never through the teardown
 * DB client), so fixtures match production writes exactly.
 */
export const registerUser = async (overrides: { name?: string; email?: string; password?: string } = {}) => {
	const name = overrides.name ?? "Test User"
	const email = overrides.email ?? uniqueEmail()
	const password = overrides.password ?? DEFAULT_PASSWORD

	const res = await postJson("/auth/register/email", { name, email, password })
	if (res.status !== 201) {
		throw new Error(`Fixture registration failed: ${res.status} ${await res.text()}`)
	}

	const body = await readJson<AuthSuccessBody>(res)
	return { name, email, password, ...body.data }
}
