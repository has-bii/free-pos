import type { AppEnv } from "@repo/auth/factory"
import { factory } from "@repo/auth/factory"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import { requireAuth } from "@repo/auth-kit/middleware/auth"

export const meHandlers = factory.createHandlers(
	requireAuth<AppEnv>((c) => c.env.FREE_POS_JWT_SECRET),
	async (c) => {
		const foundUser = await UserRepository.findById(c.var.db, c.var.userId)
		if (!foundUser) return c.json({ message: "Unauthorized." }, 401)

		return c.json({ message: "ok", data: { user: foundUser } })
	},
)
