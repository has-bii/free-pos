import { factory } from "@repo/auth/factory"
import { requireAuth } from "@repo/auth/middleware/auth"
import { UserRepository } from "@repo/auth/repositories/user.repository"

export const meHandlers = factory.createHandlers(requireAuth, async (c) => {
	const foundUser = await UserRepository.findById(c.var.db, c.var.userId)
	if (!foundUser) return c.json({ message: "Unauthorized." }, 401)

	return c.json({ message: "ok", data: { user: foundUser } })
})
