import type { AppEnv } from "@repo/auth/factory"
import { factory } from "@repo/auth/factory"
import { GOOGLE_ERROR_CODES, GoogleProviderError } from "@repo/auth/lib/google"
import { Password } from "@repo/auth/lib/password"
import { requestMeta } from "@repo/auth/lib/request"
import { Session } from "@repo/auth/lib/session"
import { validate } from "@repo/auth/middleware/validate"
import { AccountRepository } from "@repo/auth/repositories/account.repository"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import { setAuthCookies } from "@repo/auth-kit/cookies"
import type { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { loginEmailSchema } from "./login.schema"
import { GoogleAccountConflictError, GoogleIdentityError, loginWithGoogle } from "./services/google.service"

const GOOGLE_OAUTH_STATE_COOKIE = "free_pos_google_oauth_state"
const GOOGLE_OAUTH_VERIFIER_COOKIE = "free_pos_google_oauth_verifier"
const GOOGLE_OAUTH_RETURN_TO_COOKIE = "free_pos_google_oauth_return_to"
const GOOGLE_OAUTH_COOKIE_PATH = "/login/google"
const GOOGLE_OAUTH_COOKIE_MAX_AGE = 10 * 60

type OAuthCookieValues = {
	state: string
	verifier: string
	returnTo: string
}

const setGoogleOAuthCookies = (c: Context, values: OAuthCookieValues): void => {
	const options = {
		httpOnly: true,
		secure: true,
		sameSite: "Lax" as const,
		path: GOOGLE_OAUTH_COOKIE_PATH,
		maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
	}
	setCookie(c, GOOGLE_OAUTH_STATE_COOKIE, values.state, options)
	setCookie(c, GOOGLE_OAUTH_VERIFIER_COOKIE, values.verifier, options)
	setCookie(c, GOOGLE_OAUTH_RETURN_TO_COOKIE, values.returnTo, options)
}

const getGoogleOAuthCookies = (c: Context) => ({
	state: getCookie(c, GOOGLE_OAUTH_STATE_COOKIE),
	verifier: getCookie(c, GOOGLE_OAUTH_VERIFIER_COOKIE),
	returnTo: getCookie(c, GOOGLE_OAUTH_RETURN_TO_COOKIE),
})

const clearGoogleOAuthCookies = (c: Context): void => {
	const options = { path: GOOGLE_OAUTH_COOKIE_PATH }
	deleteCookie(c, GOOGLE_OAUTH_STATE_COOKIE, options)
	deleteCookie(c, GOOGLE_OAUTH_VERIFIER_COOKIE, options)
	deleteCookie(c, GOOGLE_OAUTH_RETURN_TO_COOKIE, options)
}

const base64Url = (bytes: Uint8Array): string => {
	let binary = ""
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

const randomValue = (length = 32): string => {
	const bytes = new Uint8Array(length)
	crypto.getRandomValues(bytes)
	return base64Url(bytes)
}

const pkceChallenge = async (verifier: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
	return base64Url(new Uint8Array(digest))
}

/**
 * Accept only a path on the configured frontend origin. In particular, do not
 * pass a value beginning with `//` or containing backslashes to a redirect:
 * browsers interpret both forms as network-path references in some contexts.
 */
export const safeReturnTo = (value: string | null | undefined): string => {
	if (!value) return "/"
	if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/"
	if (
		[...value].some((character) => {
			const code = character.charCodeAt(0)
			return code <= 31 || code === 127
		})
	)
		return "/"

	try {
		// Inspect the unnormalised input before URL() collapses dot segments.
		// This rejects both literal and percent-encoded traversal.
		const rawPath = value.split(/[?#]/, 1)[0] ?? "/"
		const decodedRawPath = decodeURIComponent(rawPath)
		if (decodedRawPath.includes("\\") || decodedRawPath.split("/").some((segment) => segment === "..")) return "/"

		const parsed = new URL(value, "https://free-pos.invalid")
		return `${parsed.pathname}${parsed.search}${parsed.hash}`
	} catch {
		return "/"
	}
}

const frontendUrl = (origin: string, path: string): string => {
	const base = origin.replace(/\/+$/, "")
	return `${base}${safeReturnTo(path)}`
}

type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[keyof typeof GOOGLE_ERROR_CODES]

const errorRedirect = (c: Context<AppEnv>, code: GoogleErrorCode) => {
	clearGoogleOAuthCookies(c)
	const url = new URL("/auth/error", c.env.FREE_POS_FRONTEND_ORIGIN)
	url.searchParams.set("code", code)
	return c.redirect(url.toString())
}

export const loginEmailHandlers = factory.createHandlers(validate("json", loginEmailSchema), async (c) => {
	const { email, password } = c.req.valid("json")
	const db = c.var.db

	const invalidCredentials = () => c.json({ message: "Invalid email or password." }, 401)

	const foundUser = await UserRepository.findByEmail(db, email)
	if (!foundUser) return invalidCredentials()

	const credentialAccount = await AccountRepository.findCredentialByUserId(db, foundUser.id)
	if (!credentialAccount?.password) return invalidCredentials()

	const passwordValid = await Password.verifyPassword(password, credentialAccount.password)
	if (!passwordValid) return invalidCredentials()

	const { session, accessToken, refreshToken } = await Session.createSession(
		foundUser.id,
		c.env.FREE_POS_JWT_SECRET,
		requestMeta(c),
	)
	await SessionRepository.insert(db, session)

	setAuthCookies(c, { accessToken, refreshToken }, { cookieDomain: c.env.FREE_POS_COOKIE_DOMAIN })

	return c.json({
		message: "ok",
		data: { user: foundUser },
	})
})

export const googleInitiationHandlers = factory.createHandlers(async (c) => {
	const returnTo = safeReturnTo(c.req.query("returnTo"))
	const state = randomValue()
	const verifier = randomValue(32)
	const challenge = await pkceChallenge(verifier)

	setGoogleOAuthCookies(c, { state, verifier, returnTo })

	const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
	authorizationUrl.search = new URLSearchParams({
		client_id: c.env.GOOGLE_CLIENT_ID,
		redirect_uri: c.env.GOOGLE_REDIRECT_URI,
		response_type: "code",
		scope: "openid email profile",
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	}).toString()

	return c.redirect(authorizationUrl.toString())
})

export const googleCallbackHandlers = factory.createHandlers(async (c) => {
	const fail = (code: GoogleErrorCode) => errorRedirect(c, code)
	const query = c.req.query()
	const cookies = getGoogleOAuthCookies(c)
	const code = query.code
	const { state, verifier, returnTo } = cookies

	// Provider errors still have to carry the transaction state. Otherwise a
	// forged cancellation could be used to probe or mix up browser flows.
	if (query.error) {
		if (!state || !verifier || !returnTo || query.state !== state) return fail(GOOGLE_ERROR_CODES.invalidCallback)
		return fail(query.error === "access_denied" ? GOOGLE_ERROR_CODES.cancelled : GOOGLE_ERROR_CODES.failed)
	}

	if (!code || !state || !verifier || !returnTo || query.state !== state) {
		return fail(GOOGLE_ERROR_CODES.invalidCallback)
	}

	try {
		const { accessToken, refreshToken } = await loginWithGoogle({
			db: c.var.db,
			code,
			verifier,
			clientId: c.env.GOOGLE_CLIENT_ID,
			clientSecret: c.env.GOOGLE_CLIENT_SECRET,
			redirectUri: c.env.GOOGLE_REDIRECT_URI,
			jwtSecret: c.env.FREE_POS_JWT_SECRET,
			sessionMeta: requestMeta(c),
		})

		setAuthCookies(c, { accessToken, refreshToken }, { cookieDomain: c.env.FREE_POS_COOKIE_DOMAIN })
		clearGoogleOAuthCookies(c)
		return c.redirect(frontendUrl(c.env.FREE_POS_FRONTEND_ORIGIN, returnTo))
	} catch (err) {
		if (err instanceof GoogleAccountConflictError) return fail(GOOGLE_ERROR_CODES.accountConflict)
		if (err instanceof GoogleIdentityError) return fail(GOOGLE_ERROR_CODES.accountUnverified)
		if (err instanceof GoogleProviderError) return fail(GOOGLE_ERROR_CODES.failed)
		console.error("Google OAuth callback failed")
		return fail(GOOGLE_ERROR_CODES.failed)
	}
})
