import { factory } from "@repo/auth/factory"
import { buildResetUrl, emailSender, RESET_TOKEN_TTL_MS } from "@repo/auth/lib/email"
import { Password } from "@repo/auth/lib/password"
import { ResetToken } from "@repo/auth/lib/token"
import { validate } from "@repo/auth/middleware/validate"
import { AccountRepository } from "@repo/auth/repositories/account.repository"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import { VerificationRepository } from "@repo/auth/repositories/verification.repository"
import { uuidv7 } from "uuidv7"
import { forgotPasswordSchema, resetPasswordSchema } from "./recovery.schema"

// Every well-formed request gets this, whether or not the user exists,
// whether or not they have a password, whether or not the email was sent.
const GENERIC_MESSAGE = "If an account exists for that email, a password reset link has been sent."

export const forgotPasswordHandlers = factory.createHandlers(validate("json", forgotPasswordSchema), async (c) => {
	const { email } = c.req.valid("json")
	const db = c.var.db

	// Unknown user: no email, no row. The outcome is logged server-side only —
	// the response is identical to the success path (anti-enumeration).
	const foundUser = await UserRepository.findByEmail(db, email)
	if (!foundUser) {
		console.log(`reset requested for unknown email: ${email}`)
		return c.json({ message: GENERIC_MESSAGE })
	}

	// No credential account (e.g. a future OAuth-only user): nothing to reset,
	// sending a link would be noise. Same silent 200.
	const credentialAccount = await AccountRepository.findCredentialByUserId(db, foundUser.id)
	if (!credentialAccount?.password) {
		console.log(`reset requested for user without a password: ${email}`)
		return c.json({ message: GENERIC_MESSAGE })
	}

	// Cooldown: a live link is still valid — no re-send, no rotate.
	const existing = await VerificationRepository.findLiveByIdentifier(db, email)
	if (existing) {
		return c.json({ message: GENERIC_MESSAGE })
	}

	const rawToken = ResetToken.generate()
	const value = await ResetToken.hash(rawToken)
	// Explicit id (like register does for the user) so the delivery-failure
	// un-arm below can reference the row without a second query.
	const id = uuidv7()
	await VerificationRepository.insert(db, {
		id,
		identifier: email,
		value,
		expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
	})

	const resetUrl = buildResetUrl(c.env.FREE_POS_FRONTEND_ORIGIN, rawToken)
	try {
		await emailSender.current({ to: email, resetUrl }, c.env)
	} catch (err) {
		console.error(`failed to send password reset email to ${email}`, err)
		// Un-arm the cooldown so a retry isn't blocked by a row whose link
		// never reached the user. And don't claim success — 200 would be a lie.
		await VerificationRepository.deleteById(db, id)
		return c.json({ message: "Failed to send password reset email. Please try again." }, 500)
	}

	return c.json({ message: GENERIC_MESSAGE })
})

export const resetPasswordHandlers = factory.createHandlers(validate("json", resetPasswordSchema), async (c) => {
	const { token, password } = c.req.valid("json")
	const db = c.var.db

	// One message for every failure mode — no oracle distinguishing "wrong
	// token" from "expired" from "already used".
	const invalidToken = () => c.json({ message: "Invalid or expired reset token." }, 400)

	const value = await ResetToken.hash(token)

	const result = await db.transaction(async (tx) => {
		const row = await VerificationRepository.findByValue(tx, value)
		if (!row) return { ok: false } as const

		// The row is left in place on expiry — a stale row is inert; the
		// cooldown check on the forgot side only ever sees live rows.
		if (row.expiresAt.getTime() <= Date.now()) return { ok: false } as const

		// userId is resolved from the row's identifier string. If the user row
		// is somehow gone, fail closed.
		const foundUser = await UserRepository.findByEmail(tx, row.identifier)
		if (!foundUser) return { ok: false } as const

		const passwordHash = await Password.hashPassword(password)
		await AccountRepository.updatePasswordByUserId(tx, foundUser.id, passwordHash)
		// Possession of the mailbox is proof enough: a successful reset
		// verifies the email.
		await UserRepository.markEmailVerified(tx, foundUser.id)
		// Single-use: the same token can never be replayed.
		await VerificationRepository.deleteById(tx, row.id)

		return { ok: true } as const
	})

	if (!result.ok) return invalidToken()

	// No session, no cookies — the user must log in again with the new password.
	return c.json({ message: "Password has been reset." })
})
