import { EmailAlreadyExistsError } from "@repo/auth/errors"
import { type GoogleUserInfo, googleProvider } from "@repo/auth/lib/google"
import { Session } from "@repo/auth/lib/session"
import { AccountRepository } from "@repo/auth/repositories/account.repository"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import type { Database, user } from "@repo/database"
import { uuidv7 } from "uuidv7"

export class GoogleAccountConflictError extends Error {
	constructor() {
		super("Google account is already linked to another user")
		this.name = "GoogleAccountConflictError"
	}
}

export class GoogleIdentityError extends Error {
	constructor() {
		super("Google identity did not contain a verified email")
		this.name = "GoogleIdentityError"
	}
}

type GoogleIdentity = {
	sub: string
	email: string
	name: string
	image: string | null
}

type SessionMeta = {
	ipAddress: string | null
	userAgent: string | null
}

const identityFrom = (info: GoogleUserInfo): GoogleIdentity => {
	const sub = typeof info.sub === "string" ? info.sub.trim() : ""
	const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : ""
	if (!sub || !email || info.email_verified !== true) throw new GoogleIdentityError()

	const name = typeof info.name === "string" && info.name.trim() ? info.name.trim() : email.split("@")[0] || email
	const image = typeof info.picture === "string" && info.picture.trim() ? info.picture : null
	return { sub, email, name, image }
}

const findUserForGoogleAccount = async (db: Database, accountId: string) => {
	const linkedAccount = await AccountRepository.findByProviderAccount(db, "google", accountId)
	if (!linkedAccount) return null
	const linkedUser = await UserRepository.findById(db, linkedAccount.userId)
	if (!linkedUser) throw new GoogleAccountConflictError()
	return linkedUser
}

/**
 * Link in its own transaction and recover from the provider/account unique
 * constraint. A repeated callback is therefore idempotent for the same user,
 * while a link claimed by another user fails closed.
 */
const linkGoogleAccount = async (db: Database, userId: string, accountId: string) => {
	try {
		await db.transaction(async (tx) => {
			const existing = await AccountRepository.findByProviderAccount(tx, "google", accountId)
			if (existing && existing.userId !== userId) throw new GoogleAccountConflictError()
			if (!existing) {
				const linked = await AccountRepository.linkGoogle(tx, userId, accountId)
				if (!linked) throw new GoogleAccountConflictError()
			}
			await UserRepository.markEmailVerified(tx, userId)
		})
	} catch (err) {
		if (!(err instanceof GoogleAccountConflictError)) throw err
		const raced = await AccountRepository.findByProviderAccount(db, "google", accountId)
		if (!raced || raced.userId !== userId) throw err
		await UserRepository.markEmailVerified(db, userId)
	}
}

const resolveGoogleUser = async (db: Database, identity: GoogleIdentity) => {
	const linkedUser = await findUserForGoogleAccount(db, identity.sub)
	if (linkedUser) {
		await UserRepository.markEmailVerified(db, linkedUser.id)
		return linkedUser
	}

	const existingUser = await UserRepository.findByEmail(db, identity.email)
	if (existingUser) {
		// Product policy intentionally links even an unverified local
		// registration. Google verification proves control of the Google
		// identity's mailbox, not ownership of that pre-existing account.
		await linkGoogleAccount(db, existingUser.id, identity.sub)
		return existingUser
	}

	const userId = uuidv7()
	const now = new Date()
	const newUser: typeof user.$inferInsert = {
		id: userId,
		name: identity.name,
		email: identity.email,
		emailVerified: true,
		image: identity.image,
		createdAt: now,
		updatedAt: now,
	}

	try {
		return await db.transaction(async (tx) => {
			// Re-check inside the transaction so a callback that started just after
			// another callback does not create a second link or user.
			const racedAccount = await AccountRepository.findByProviderAccount(tx, "google", identity.sub)
			if (racedAccount) {
				// This callback did not create the user that owns the identity. Do
				// not silently sign in as that user; the unique constraint race is
				// surfaced as a safe public conflict instead.
				throw new GoogleAccountConflictError()
			}

			const racedEmailUser = await UserRepository.findByEmail(tx, identity.email)
			if (racedEmailUser) {
				const linked = await AccountRepository.linkGoogle(tx, racedEmailUser.id, identity.sub)
				if (!linked) throw new GoogleAccountConflictError()
				await UserRepository.markEmailVerified(tx, racedEmailUser.id)
				return racedEmailUser
			}

			await UserRepository.insert(tx, newUser)
			const linked = await AccountRepository.linkGoogle(tx, userId, identity.sub)
			if (!linked) throw new GoogleAccountConflictError()
			return newUser
		})
	} catch (err) {
		if (err instanceof EmailAlreadyExistsError) {
			const racedEmailUser = await UserRepository.findByEmail(db, identity.email)
			if (!racedEmailUser) throw err
			await linkGoogleAccount(db, racedEmailUser.id, identity.sub)
			return racedEmailUser
		}
		throw err
	}
}

type LoginWithGoogleParams = {
	db: Database
	code: string
	verifier: string
	clientId: string
	clientSecret: string
	redirectUri: string
	jwtSecret: string
	sessionMeta: SessionMeta
}

export const loginWithGoogle = async ({
	db,
	code,
	verifier,
	clientId,
	clientSecret,
	redirectUri,
	jwtSecret,
	sessionMeta,
}: LoginWithGoogleParams) => {
	const accessToken = await googleProvider.exchangeCode({
		code,
		verifier,
		clientId,
		clientSecret,
		redirectUri,
	})
	const identity = identityFrom(await googleProvider.getUserInfo(accessToken))
	const user = await resolveGoogleUser(db, identity)
	if (!user.id) throw new GoogleAccountConflictError()
	const {
		session,
		accessToken: localAccessToken,
		refreshToken,
	} = await Session.createSession(user.id, jwtSecret, sessionMeta)
	await SessionRepository.insert(db, session)

	return { user, accessToken: localAccessToken, refreshToken }
}
