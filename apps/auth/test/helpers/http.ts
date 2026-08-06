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
	data: { user: UserBody }
}

export type MeSuccessBody = { message: string; data: { user: UserBody } }

export type ValidationFailureBody = {
	message: string
	error: Record<string, { message: string }>
}

export type MessageBody = { message: string }

export const readJson = async <T>(res: Response): Promise<T> => {
	return (await res.json()) as T
}

export const get = (path: string, headers?: HeadersInit) => {
	return worker.fetch(`${ORIGIN}${path}`, headers ? { headers } : undefined)
}

export const post = (path: string, headers?: HeadersInit) => {
	return worker.fetch(`${ORIGIN}${path}`, headers ? { method: "POST", headers } : { method: "POST" })
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

/** A one-off `Cookie` header, for tests that hand-craft a raw cookie value. */
export const cookieHeader = (name: string, value: string): HeadersInit => ({ Cookie: `${name}=${value}` })

type StoredCookie = { value: string; path: string }

/**
 * Enough of RFC 6265 to stand in for a browser across a test: absorbs
 * `Set-Cookie` from responses, tracks each cookie's `Path`, and only replays a
 * cookie on requests its path covers (so the refresh cookie's `Path=/refresh`
 * scoping is actually exercised rather than papered over).
 */
export class CookieJar {
	private cookies = new Map<string, StoredCookie>()

	absorb(res: Response): void {
		for (const line of res.headers.getSetCookie()) {
			const [nameValue, ...attrs] = line.split(";").map((part) => part.trim())
			const eq = nameValue?.indexOf("=") ?? -1
			if (!nameValue || eq === -1) continue
			const name = nameValue.slice(0, eq)
			const value = nameValue.slice(eq + 1)

			let path = "/"
			let maxAge: number | null = null
			for (const attr of attrs) {
				const attrEq = attr.indexOf("=")
				const key = (attrEq === -1 ? attr : attr.slice(0, attrEq)).toLowerCase()
				const val = attrEq === -1 ? "" : attr.slice(attrEq + 1)
				if (key === "path") path = val
				if (key === "max-age") maxAge = Number(val)
			}

			if (maxAge === 0) {
				this.cookies.delete(name)
				continue
			}
			this.cookies.set(name, { value, path })
		}
	}

	private appliesTo(cookiePath: string, requestPath: string): boolean {
		if (requestPath === cookiePath) return true
		if (!requestPath.startsWith(cookiePath)) return false
		return cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/"
	}

	header(requestPath: string): string | undefined {
		const applicable = [...this.cookies.entries()]
			.filter(([, cookie]) => this.appliesTo(cookie.path, requestPath))
			.map(([name, cookie]) => `${name}=${cookie.value}`)
		return applicable.length > 0 ? applicable.join("; ") : undefined
	}

	get(name: string): string | undefined {
		return this.cookies.get(name)?.value
	}

	has(name: string): boolean {
		return this.cookies.has(name)
	}
}

/**
 * A cookie-carrying client standing in for one browser session: every request
 * replays whatever cookies its jar holds and applicable to that path, then
 * absorbs the response's `Set-Cookie` headers before returning.
 */
export class TestClient {
	readonly jar = new CookieJar()

	private async send(path: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers)
		const cookie = this.jar.header(path)
		if (cookie) headers.set("Cookie", cookie)

		const res = await worker.fetch(`${ORIGIN}${path}`, { ...init, headers })
		this.jar.absorb(res)
		return res
	}

	request(path: string, init: RequestInit = {}): Promise<Response> {
		return this.send(path, init)
	}

	get(path: string, headers?: HeadersInit): Promise<Response> {
		return this.send(path, headers ? { headers } : {})
	}

	post(path: string, headers?: HeadersInit): Promise<Response> {
		return this.send(path, headers ? { method: "POST", headers } : { method: "POST" })
	}

	postJson(path: string, body: unknown): Promise<Response> {
		return this.send(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	}
}

/**
 * Seeds a user through the real register endpoint (never through the teardown
 * DB client), so fixtures match production writes exactly. Returns a
 * `TestClient` already carrying the cookies `Set-Cookie` put on the response,
 * for tests that continue the session (e.g. calling `/me`).
 */
export const registerUser = async (overrides: { name?: string; email?: string; password?: string } = {}) => {
	const name = overrides.name ?? "Test User"
	const email = overrides.email ?? uniqueEmail()
	const password = overrides.password ?? DEFAULT_PASSWORD

	const client = new TestClient()
	const res = await client.postJson("/register/email", { name, email, password })
	if (res.status !== 201) {
		throw new Error(`Fixture registration failed: ${res.status} ${await res.text()}`)
	}

	const body = await readJson<AuthSuccessBody>(res)
	return { name, email, password, user: body.data.user, client }
}
