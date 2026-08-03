import type { user } from "@repo/database"
import { uuidv7 } from "uuidv7"
import { EmailAlreadyExistsError } from "../../errors"
import { factory } from "../../factory"
import { hashPassword } from "../../lib/password"
import { createSession } from "../../lib/session"
import { validate } from "../../middleware/validate"
import { AccountRepository } from "../../repositories/account.repository"
import { SessionRepository } from "../../repositories/session.repository"
import { UserRepository } from "../../repositories/user.repository"
import { registerEmailSchema } from "./register.schema"

export const registerEmailHandlers = factory.createHandlers(
	validate("json", registerEmailSchema),
	async (c) => {
		const { name, email, password } = c.req.valid("json")
		const db = c.var.db

		const existing = await UserRepository.findByEmail(db, email)
		if (existing) {
			return c.json({ message: "Email already registered." }, 409)
		}

		const now = new Date()
		const userId = uuidv7()
		const newUser: typeof user.$inferInsert = {
			id: userId,
			name,
			email,
			emailVerified: false,
			image: null,
			createdAt: now,
			updatedAt: now,
		}
		const passwordHash = await hashPassword(password)

		try {
			await db.transaction(async (tx) => {
				await UserRepository.insert(tx, newUser)
				await AccountRepository.insert(tx, {
					userId,
					accountId: userId,
					providerId: "credential",
					password: passwordHash,
				})
			})
		} catch (err) {
			if (err instanceof EmailAlreadyExistsError) {
				return c.json({ message: "Email already registered." }, 409)
			}
			throw err
		}

		const { session, accessToken, refreshToken } = await createSession(
			userId,
			c.env.SERO_POS_JWT_SECRET,
			{ ipAddress: null, userAgent: null },
		)
		await SessionRepository.insert(db, { ...session, token: session.id })

		return c.json(
			{
				message: "New user has been created",
				data: { user: newUser, token: { accessToken, refreshToken } },
			},
			201,
		)
	},
)
