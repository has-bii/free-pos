import { factory } from "../../factory"
import { verifyPassword } from "../../lib/password"
import { createSession } from "../../lib/session"
import { validate } from "../../middleware/validate"
import { AccountRepository } from "../../repositories/account.repository"
import { SessionRepository } from "../../repositories/session.repository"
import { UserRepository } from "../../repositories/user.repository"
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

		const { session, accessToken, refreshToken } = await createSession(
			foundUser.id,
			c.env.SERO_POS_JWT_SECRET,
			{ ipAddress: null, userAgent: null },
		)
		await SessionRepository.insert(db, { ...session, token: session.id })

		return c.json({
			message: "ok",
			data: {
				user: foundUser,
				token: { accessToken, refreshToken },
			},
		})
	},
)
