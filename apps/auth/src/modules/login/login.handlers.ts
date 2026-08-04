import { factory } from "@repo/auth/factory"
import { Password } from "@repo/auth/lib/password"
import { Session } from "@repo/auth/lib/session"
import { validate } from "@repo/auth/middleware/validate"
import { AccountRepository } from "@repo/auth/repositories/account.repository"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import { setAuthCookies } from "@repo/auth-kit/cookies"
import { loginEmailSchema } from "./login.schema"

export const loginEmailHandlers = factory.createHandlers(validate("json", loginEmailSchema), async (c) => {
	const { email, password } = c.req.valid("json")
	const db = c.var.db

	const invalidCredentials = () => c.json({ message: "Invalid email or password." }, 401)

	const foundUser = await UserRepository.findByEmail(db, email)
	if (!foundUser) return invalidCredentials()

	const credentialAccount = await AccountRepository.findCredentialByUserId(db, foundUser.id)
	if (!credentialAccount?.password) return invalidCredentials()

	const passwordValid = await Password.verifyPassword(password, credentialAccount.password)
	if (!passwordValid) return invalidCredentials()

	const { session, accessToken, refreshToken } = await Session.createSession(foundUser.id, c.env.FREE_POS_JWT_SECRET, {
		ipAddress: null,
		userAgent: null,
	})
	await SessionRepository.insert(db, session)

	setAuthCookies(c, { accessToken, refreshToken }, { cookieDomain: c.env.FREE_POS_COOKIE_DOMAIN })

	return c.json({
		message: "ok",
		data: { user: foundUser },
	})
})
