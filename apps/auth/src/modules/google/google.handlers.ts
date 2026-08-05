import { EmailAlreadyExistsError, GoogleAccountConflictError } from "@repo/auth/errors"
import type { AppEnv } from "@repo/auth/factory"
import { factory } from "@repo/auth/factory"
import { requestMeta } from "@repo/auth/lib/request"
import { Session } from "@repo/auth/lib/session"
import { AccountRepository } from "@repo/auth/repositories/account.repository"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { UserRepository } from "@repo/auth/repositories/user.repository"
import { setAuthCookies } from "@repo/auth-kit/cookies"
import type { Database, user } from "@repo/database"
import type { Context } from "hono"
import { uuidv7 } from "uuidv7"
import { clearGoogleOAuthCookies, getGoogleOAuthCookies, setGoogleOAuthCookies } from "./google.cookies"
import { GoogleProviderError, type GoogleUserInfo, googleProvider } from "./google.provider"

export const GOOGLE_ERROR_CODES = {
	cancelled: "google_cancelled",
	invalidCallback: "google_invalid_callback",
	failed: "google_failed",
	accountConflict: "google_account_conflict",
	accountUnverified: "google_account_unverified",
	linkRequired: "google_link_required",
} as const

type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[keyof typeof GOOGLE_ERROR_CODES]

const base64Url = (bytes: Uint8Array): string => {
	let binary = ""
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

const randomValue = (length = 32): string => {
	const bytes = new Uint8Array(length)
	crypto.getRandomValues(bytes)
	return base64Url(bytes)
}

const pkceChallenge = async (verifier: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
	return base64Url(new Uint8Array(digest))
}

/**
 * Accept only a path on the configured frontend origin. In particular, do not
 * pass a value beginning with `//` or containing backslashes to a redirect:
 * browsers interpret both forms as network-path references in some contexts.
 */
export const safeReturnTo = (value: string | null | undefined): string => {
	if (!value) return "/"
	if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/"
	if (
		[...value].some((character) => {
			const code = character.charCodeAt(0)
			return code <= 31 || code === 127
		})
	)
		return "/"

	try {
		// Inspect the unnormalised input before URL() collapses dot segments.
		// This rejects both literal and percent-encoded traversal.
		const rawPath = value.split(/[?#]/, 1)[0] ?? "/"
		const decodedRawPath = decodeURIComponent(rawPath)
		if (decodedRawPath.includes("\\") || decodedRawPath.split("/").some((segment) => segment === "..")) return "/"

		const parsed = new URL(value, "https://free-pos.invalid")
		return `${parsed.pathname}${parsed.search}${parsed.hash}`
	} catch {
		return "/"
	}
}

const frontendUrl = (origin: string, path: string): string => {
	const base = origin.replace(/\/+$/, "")
	return `${base}${safeReturnTo(path)}`
}

const errorRedirect = (c: Context<AppEnv>, code: GoogleErrorCode) => {
	clearGoogleOAuthCookies(c)
	const url = new URL("/auth/error", c.env.FREE_POS_FRONTEND_ORIGIN)
	url.searchParams.set("code", code)
	return c.redirect(url.toString())
}

export const googleInitiationHandlers = factory.createHandlers(async (c) => {
	const returnTo = safeReturnTo(c.req.query("returnTo"))
	const state = randomValue()
	const verifier = randomValue(32)
	const challenge = await pkceChallenge(verifier)

	setGoogleOAuthCookies(c, { state, verifier, returnTo })

	const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
	authorizationUrl.search = new URLSearchParams({
		client_id: c.env.GOOGLE_CLIENT_ID,
		redirect_uri: c.env.GOOGLE_REDIRECT_URI,
		response_type: "code",
		scope: "openid email profile",
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	}).toString()

	return c.redirect(authorizationUrl.toString())
})

class GoogleIdentityError extends Error {
	constructor() {
		super("Google identity did not contain a verified email")
		this.name = "GoogleIdentityError"
	}
}

const identityFrom = (info: GoogleUserInfo) => {
	const sub = typeof info.sub === "string" ? info.sub.trim() : ""
	const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : ""
	if (!sub || !email || info.email_verified !== true) throw new GoogleIdentityError()

	const name = typeof info.name === "string" && info.name.trim() ? info.name.trim() : email.split("@")[0] || email
	const image = typeof info.picture === "string" && info.picture.trim() ? info.picture : null
	return { sub, email, name, image }
}

type GoogleIdentity = ReturnType<typeof identityFrom>

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
			if (!existing) await AccountRepository.linkGoogle(tx, userId, accountId)
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
				await AccountRepository.linkGoogle(tx, racedEmailUser.id, identity.sub)
				await UserRepository.markEmailVerified(tx, racedEmailUser.id)
				return racedEmailUser
			}

			await UserRepository.insert(tx, newUser)
			await AccountRepository.linkGoogle(tx, userId, identity.sub)
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

export const googleCallbackHandlers = factory.createHandlers(async (c) => {
	const fail = (code: GoogleErrorCode) => errorRedirect(c, code)
	const query = c.req.query()
	const cookies = getGoogleOAuthCookies(c)
	const code = query.code
	const { state, verifier, returnTo } = cookies

	// Provider errors still have to carry the transaction state. Otherwise a
	// forged cancellation could be used to probe or mix up browser flows.
	if (query.error) {
		if (!state || !verifier || !returnTo || query.state !== state) return fail(GOOGLE_ERROR_CODES.invalidCallback)
		return fail(query.error === "access_denied" ? GOOGLE_ERROR_CODES.cancelled : GOOGLE_ERROR_CODES.failed)
	}

	if (!code || !state || !verifier || !returnTo || query.state !== state) {
		return fail(GOOGLE_ERROR_CODES.invalidCallback)
	}

	try {
		const accessToken = await googleProvider.exchangeCode({
			code,
			verifier,
			clientId: c.env.GOOGLE_CLIENT_ID,
			clientSecret: c.env.GOOGLE_CLIENT_SECRET,
			redirectUri: c.env.GOOGLE_REDIRECT_URI,
		})
		const identity = identityFrom(await googleProvider.getUserInfo(accessToken))
		const user = await resolveGoogleUser(c.var.db, identity)
		if (!user.id) throw new GoogleAccountConflictError()
		const {
			session,
			accessToken: localAccessToken,
			refreshToken,
		} = await Session.createSession(user.id, c.env.FREE_POS_JWT_SECRET, requestMeta(c))
		await SessionRepository.insert(c.var.db, session)

		setAuthCookies(c, { accessToken: localAccessToken, refreshToken }, { cookieDomain: c.env.FREE_POS_COOKIE_DOMAIN })
		clearGoogleOAuthCookies(c)
		return c.redirect(frontendUrl(c.env.FREE_POS_FRONTEND_ORIGIN, returnTo))
	} catch (err) {
		if (err instanceof GoogleAccountConflictError) return fail(GOOGLE_ERROR_CODES.accountConflict)
		if (err instanceof GoogleIdentityError) return fail(GOOGLE_ERROR_CODES.accountUnverified)
		if (err instanceof GoogleProviderError) return fail(GOOGLE_ERROR_CODES.failed)
		console.error("Google OAuth callback failed")
		return fail(GOOGLE_ERROR_CODES.failed)
	}
})
