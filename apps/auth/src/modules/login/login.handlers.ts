import { factory } from "../../factory"
import { verifyPassword } from "../../lib/password"
import { requestMeta } from "../../lib/request"
import { createSession } from "../../lib/session"
import { validate } from "../../middleware/validate"
import { findCredentialAccountByUserId } from "../../repositories/account.repository"
import { insertSession } from "../../repositories/session.repository"
import { findUserByEmail } from "../../repositories/user.repository"
import { loginEmailSchema } from "./login.schema"

export const loginEmailHandlers = factory.createHandlers(
	validate("json", loginEmailSchema),
	async (c) => {
		const { email, password } = c.req.valid("json")
		const db = c.var.db

		const invalidCredentials = () =>
			c.json({ message: "Invalid email or password." }, 401)

		const foundUser = await findUserByEmail(db, email)
		if (!foundUser) return invalidCredentials()

		const credentialAccount = await findCredentialAccountByUserId(
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
			requestMeta(c),
		)
		await insertSession(db, session)

		return c.json({
			message: "ok",
			data: {
				user: foundUser,
				token: { accessToken, refreshToken },
			},
		})
	},
)
