import type { AppEnv } from "@repo/auth/factory"
import { factory } from "@repo/auth/factory"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { clearAuthCookies } from "@repo/auth-kit/cookies"
import { requireAuth } from "@repo/auth-kit/middleware/auth"

export const logoutHandlers = factory.createHandlers(
	requireAuth<AppEnv>((c) => c.env.FREE_POS_JWT_SECRET),
	async (c) => {
		await SessionRepository.deleteById(c.var.db, c.var.sessionId, c.var.userId)
		clearAuthCookies(c, { cookieDomain: c.env.FREE_POS_COOKIE_DOMAIN })
		return c.json({ message: "Logged out." })
	},
)
