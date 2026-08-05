import { env } from "cloudflare:workers"
import { account, createDatabaseClient, session, user, verification } from "@repo/database"
import { eq, inArray } from "drizzle-orm"

/**
 * A DB client entirely separate from the per-request one `dbMiddleware`
 * attaches. It exists for teardown and for the DB-state assertions that a
 * response body cannot make (a 201 looks identical whether or not the
 * `account` row was written).
 *
 * It is never used for seeding — fixtures go through the real register
 * endpoint so they match production writes exactly.
 *
 * This is the one place outside `src/repositories/` that touches Drizzle
 * tables directly; that rule is about production code paths.
 */
const db = createDatabaseClient(env.FREE_POS_DATABASE_URL)

export const findUserByEmail = async (email: string) => {
	const [row] = await db.select().from(user).where(eq(user.email, email))
	return row ?? null
}

export const findUserById = async (id: string) => {
	const [row] = await db.select().from(user).where(eq(user.id, id))
	return row ?? null
}

export const findAccountsByUserId = async (userId: string) => {
	return db.select().from(account).where(eq(account.userId, userId))
}

export const findSessionsByUserId = async (userId: string) => {
	return db.select().from(session).where(eq(session.userId, userId))
}

/**
 * Deleting the `user` row is enough: migration `0000_typical_george_stacy.sql`
 * declares `account.user_id` and `session.user_id` as
 * `FOREIGN KEY … ON DELETE cascade`, so the children go with it.
 */
export const deleteTestUsersByEmail = async (emails: string[]) => {
	if (emails.length === 0) return
	await db.delete(user).where(inArray(user.email, emails))
}

/**
 * `verification` has no FK to `user` — rows are keyed by the `identifier`
 * string (the email), so deleting the `user` row does *not* remove them.
 * Clean them up explicitly alongside `deleteTestUsersByEmail`.
 */
export const findVerificationsByIdentifier = async (identifier: string) => {
	return db.select().from(verification).where(eq(verification.identifier, identifier))
}

export const deleteVerificationsByIdentifiers = async (identifiers: string[]) => {
	if (identifiers.length === 0) return
	await db.delete(verification).where(inArray(verification.identifier, identifiers))
}

/** Row-state setup for the expiry tests: push a row's `expiresAt` into the past. */
export const expireVerification = async (id: string) => {
	await db
		.update(verification)
		.set({ expiresAt: new Date(Date.now() - 1000) })
		.where(eq(verification.id, id))
}
