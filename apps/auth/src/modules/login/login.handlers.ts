import { factory } from "@repo/auth/factory"
import { verifyPassword } from "@repo/auth/lib/password"
import { createSession } from "@repo/auth/lib/session"
import { validate } from "@repo/auth/middleware/validate"
import { AccountRepository } from "@repo/auth/repositories/account.repository"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import { loginEmailSchema } from "./login.schema"

export const loginEmailHandlers = factory.createHandlers(
	validate("json", loginEmailSchema),
	async (c) => {
		const { email, password } = c.req.valid("json")
		const db = c.var.db

		const invalidCredentials = () =>
			c.json({ message: "Invalid email or password." }, 401)

		const foundUser = await UserRepository.findByEmail(db, email)
		if (!foundUser) return invalidCredentials()

		const credentialAccount = await AccountRepository.findCredentialByUserId(
			db,
			foundUser.id,
		)
		if (!credentialAccount?.password) return invalidCredentials()

		const passwordValid = await verifyPassword(
			password,
			credentialAccount.password,
		)
		if (!passwordValid) return invalidCredentials()

		const { session, accessToken, refreshToken, expiresIn } =
			await createSession(foundUser.id, c.env.SERO_POS_JWT_SECRET, {
				ipAddress: null,
				userAgent: null,
			})
		await SessionRepository.insert(db, session)

		return c.json({
			message: "ok",
			data: {
				user: foundUser,
				token: { accessToken, refreshToken, expiresIn },
			},
		})
	},
)
