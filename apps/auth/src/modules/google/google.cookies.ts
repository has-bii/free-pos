import type { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"

export const GOOGLE_OAUTH_STATE_COOKIE = "free_pos_google_oauth_state"
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "free_pos_google_oauth_verifier"
export const GOOGLE_OAUTH_RETURN_TO_COOKIE = "free_pos_google_oauth_return_to"

// The initiation route is the cookie path prefix of the callback route. This
// keeps the transaction cookies away from unrelated auth endpoints.
const GOOGLE_OAUTH_COOKIE_PATH = "/login/google"
const GOOGLE_OAUTH_COOKIE_MAX_AGE = 10 * 60

type OAuthCookieValues = {
	state: string
	verifier: string
	returnTo: string
}

export const setGoogleOAuthCookies = (c: Context, values: OAuthCookieValues): void => {
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

export const getGoogleOAuthCookies = (c: Context) => ({
	state: getCookie(c, GOOGLE_OAUTH_STATE_COOKIE),
	verifier: getCookie(c, GOOGLE_OAUTH_VERIFIER_COOKIE),
	returnTo: getCookie(c, GOOGLE_OAUTH_RETURN_TO_COOKIE),
})

export const clearGoogleOAuthCookies = (c: Context): void => {
	const options = { path: GOOGLE_OAUTH_COOKIE_PATH }
	deleteCookie(c, GOOGLE_OAUTH_STATE_COOKIE, options)
	deleteCookie(c, GOOGLE_OAUTH_VERIFIER_COOKIE, options)
	deleteCookie(c, GOOGLE_OAUTH_RETURN_TO_COOKIE, options)
}
