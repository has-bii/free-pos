import type { DatabaseExecutor } from "@repo/auth/factory"
import { verification } from "@repo/database"
import { and, eq, gt } from "drizzle-orm"

/**
 * The `verification` table is keyed by a `identifier` string (the email), not
 * a FK to `user` — rows survive user deletion and must be cleaned up by
 * callers/tests explicitly.
 */
export const VerificationRepository = {
	/**
	 * Cooldown check on the forgot side: a non-expired row means a link is
	 * already live for this identifier — do not re-send or rotate.
	 */
	findLiveByIdentifier: async (db: DatabaseExecutor, identifier: string) => {
		const [row] = await db
			.select()
			.from(verification)
			.where(and(eq(verification.identifier, identifier), gt(verification.expiresAt, new Date())))
			.limit(1)
		return row ?? null
	},

	insert: async (db: DatabaseExecutor, payload: typeof verification.$inferInsert) => {
		await db.insert(verification).values(payload)
	},

	/** Reset-leg lookup by the SHA-256 hash of the presented token. */
	findByValue: async (db: DatabaseExecutor, value: string) => {
		const [row] = await db.select().from(verification).where(eq(verification.value, value)).limit(1)
		return row ?? null
	},

	/** Single-use consume, and delivery-failure un-arm on the forgot side. */
	deleteById: async (db: DatabaseExecutor, id: string) => {
		await db.delete(verification).where(eq(verification.id, id))
	},
}
