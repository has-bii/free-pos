import { factory } from "@repo/auth/factory"
import { requireAuth } from "@repo/auth/middleware/auth"
import { SessionRepository } from "@repo/auth/repositories/session.repository"

export const logoutHandlers = factory.createHandlers(requireAuth, async (c) => {
	await SessionRepository.deleteById(c.var.db, c.var.sessionId, c.var.userId)
	return c.json({ message: "Logged out." })
})
