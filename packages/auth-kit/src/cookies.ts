import { JWT } from "@repo/auth-kit/jwt"
import type { Context } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"

export const ACCESS_TOKEN_COOKIE_NAME = "free_pos_access_token"
export const REFRESH_TOKEN_COOKIE_NAME = "free_pos_refresh_token"

// The refresh cookie is deliberately scoped to this single path — it must
// never be sent to any other route, on any service, regardless of
// `cookieDomain`.
const REFRESH_TOKEN_PATH = "/refresh"

type AuthCookieConfig = {
	/** Unset for a host-only cookie (local dev). Never applied to the refresh cookie. */
	cookieDomain?: string
}

export const setAuthCookies = (
	c: Context,
	tokens: { accessToken: string; refreshToken: string },
	config: AuthCookieConfig = {},
): void => {
	setCookie(c, ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: JWT.ACCESS_TOKEN_TTL_SECONDS,
		...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
	})
	setCookie(c, REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: REFRESH_TOKEN_PATH,
		maxAge: JWT.REFRESH_TOKEN_TTL_SECONDS,
	})
}

export const clearAuthCookies = (c: Context, config: AuthCookieConfig = {}): void => {
	deleteCookie(c, ACCESS_TOKEN_COOKIE_NAME, {
		path: "/",
		...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
	})
	deleteCookie(c, REFRESH_TOKEN_COOKIE_NAME, { path: REFRESH_TOKEN_PATH })
}
