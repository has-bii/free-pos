import {
	ACCESS_TOKEN_COOKIE_NAME,
	clearAuthCookies,
	REFRESH_TOKEN_COOKIE_NAME,
	setAuthCookies,
} from "@repo/auth-kit/cookies"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

const TOKENS = { accessToken: "access-value", refreshToken: "refresh-value" }

const buildApp = () => {
	const app = new Hono()
	app.get("/set", (c) => {
		setAuthCookies(c, TOKENS)
		return c.json({ ok: true })
	})
	app.get("/set-with-domain", (c) => {
		setAuthCookies(c, TOKENS, { cookieDomain: ".yourdomain.com" })
		return c.json({ ok: true })
	})
	app.get("/clear", (c) => {
		clearAuthCookies(c)
		return c.json({ ok: true })
	})
	app.get("/clear-with-domain", (c) => {
		clearAuthCookies(c, { cookieDomain: ".yourdomain.com" })
		return c.json({ ok: true })
	})
	return app
}

const findCookie = (cookies: string[], name: string) => {
	const found = cookies.find((line) => line.startsWith(`${name}=`))
	if (!found) throw new Error(`no Set-Cookie found for ${name}`)
	return found.split("; ")
}

describe("setAuthCookies", () => {
	it("sets both cookies as HttpOnly, Secure, SameSite=Lax", async () => {
		const res = await buildApp().request("/set")
		const cookies = res.headers.getSetCookie()
		expect(cookies).toHaveLength(2)

		const access = findCookie(cookies, ACCESS_TOKEN_COOKIE_NAME)
		expect(access).toEqual(expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=900"]))
		expect(access).not.toEqual(expect.arrayContaining([expect.stringMatching(/^Domain=/)]))

		const refresh = findCookie(cookies, REFRESH_TOKEN_COOKIE_NAME)
		expect(refresh).toEqual(
			expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/refresh", "Max-Age=2592000"]),
		)
		expect(refresh).not.toEqual(expect.arrayContaining([expect.stringMatching(/^Domain=/)]))
	})

	it("applies cookieDomain to the access token cookie only", async () => {
		const res = await buildApp().request("/set-with-domain")
		const cookies = res.headers.getSetCookie()

		const access = findCookie(cookies, ACCESS_TOKEN_COOKIE_NAME)
		expect(access).toContain("Domain=.yourdomain.com")

		const refresh = findCookie(cookies, REFRESH_TOKEN_COOKIE_NAME)
		expect(refresh).not.toEqual(expect.arrayContaining([expect.stringMatching(/^Domain=/)]))
	})
})

describe("clearAuthCookies", () => {
	it("expires both cookies at their original paths", async () => {
		const res = await buildApp().request("/clear")
		const cookies = res.headers.getSetCookie()
		expect(cookies).toHaveLength(2)

		const access = findCookie(cookies, ACCESS_TOKEN_COOKIE_NAME)
		expect(access).toEqual(expect.arrayContaining(["Max-Age=0", "Path=/"]))

		const refresh = findCookie(cookies, REFRESH_TOKEN_COOKIE_NAME)
		expect(refresh).toEqual(expect.arrayContaining(["Max-Age=0", "Path=/refresh"]))
	})

	it("matches the Domain used when setting, so the browser actually deletes it", async () => {
		const res = await buildApp().request("/clear-with-domain")
		const cookies = res.headers.getSetCookie()

		const access = findCookie(cookies, ACCESS_TOKEN_COOKIE_NAME)
		expect(access).toContain("Domain=.yourdomain.com")
	})
})
