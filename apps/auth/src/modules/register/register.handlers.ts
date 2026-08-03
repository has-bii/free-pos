import type { user } from "@repo/database"
import { uuidv7 } from "uuidv7"
import { EmailAlreadyExistsError } from "../../errors"
import { factory } from "../../factory"
import { hashPassword } from "../../lib/password"
import { createSession } from "../../lib/session"
import { validate } from "../../middleware/validate"
import { insertCredentialAccount } from "../../repositories/account.repository"
import { insertSession } from "../../repositories/session.repository"
import { findUserByEmail, insertUser } from "../../repositories/user.repository"
import { registerEmailSchema } from "./register.schema"

export const registerEmailHandlers = factory.createHandlers(
	validate("json", registerEmailSchema),
	async (c) => {
		const { name, email, password } = c.req.valid("json")
		const db = c.var.db

		const existing = await findUserByEmail(db, email)
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
				await insertUser(tx, newUser)
				await insertCredentialAccount(tx, {
					id: uuidv7(),
					userId: userId,
					accountId: userId,
					providerId: "credential",
					password: passwordHash,
					createdAt: now,
					updatedAt: now,
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
		await insertSession(db, session)

		return c.json(
			{
				message: "New user has been created",
				data: { user: newUser, token: { accessToken, refreshToken } },
			},
			201,
		)
	},
)
