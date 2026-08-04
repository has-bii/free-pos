import { factory } from "@repo/auth/factory"
import { Session } from "@repo/auth/lib/session"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { clearAuthCookies, REFRESH_TOKEN_COOKIE_NAME, setAuthCookies } from "@repo/auth-kit/cookies"
import { JWT } from "@repo/auth-kit/jwt"
import { getCookie } from "hono/cookie"

export const refreshHandlers = factory.createHandlers(async (c) => {
	const db = c.var.db
	const cookieDomain = c.env.SERO_POS_COOKIE_DOMAIN

	// One message for every cause: the client's action is always the same,
	// and distinguishing them would leak whether a session exists. A dead
	// refresh token must not linger in the browser for up to 30 days, so every
	// failure clears both cookies too.
	const invalidToken = () => {
		clearAuthCookies(c, { cookieDomain })
		return c.json({ message: "Invalid or expired refresh token." }, 401)
	}

	const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE_NAME)
	if (!refreshToken) return invalidToken()

	const payload = await JWT.verifyRefreshToken(refreshToken, c.env.SERO_POS_JWT_SECRET)
	if (!payload) return invalidToken()

	const rotated = await Session.rotateSession(payload.sub, payload.sid, c.env.SERO_POS_JWT_SECRET)

	// The `userId` predicate is the `sub === session.user_id` invariant
	// folded into the CAS, so it costs no extra query.
	const swapped = await SessionRepository.rotateToken(db, {
		currentToken: payload.jti,
		userId: payload.sub,
		nextToken: rotated.token,
		expiresAt: rotated.expiresAt,
	})
	if (!swapped) return invalidToken()

	setAuthCookies(c, { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken }, { cookieDomain })

	return c.json({ message: "ok" })
})
