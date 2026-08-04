import type { DatabaseExecutor } from "@repo/auth/factory"
import { session } from "@repo/database"
import { and, eq, gt } from "drizzle-orm"

type RotateTokenParams = {
	currentToken: string
	userId: string
	nextToken: string
	expiresAt: Date
}

export const SessionRepository = {
	insert: async (db: DatabaseExecutor, newSession: typeof session.$inferInsert) => {
		await db.insert(session).values(newSession)
	},

	/**
	 * Compare-and-swap. Returns false for every failure — token unknown,
	 * already rotated, wrong user, session expired — because the caller
	 * collapses them all into one 401 anyway (decision 8).
	 *
	 * This depends on the UPDATE always *changing* the row: MySQL's
	 * affectedRows counts changed rows, not matched ones. `nextToken` is a
	 * fresh uuidv7 and `expiresAt` always moves forward, so a match is always
	 * exactly 1. If either write is ever made conditional or idempotent, this
	 * check silently starts rejecting valid tokens.
	 */
	rotateToken: async (db: DatabaseExecutor, params: RotateTokenParams): Promise<boolean> => {
		const result = await db
			.update(session)
			.set({ token: params.nextToken, expiresAt: params.expiresAt })
			.where(
				and(
					eq(session.token, params.currentToken),
					eq(session.userId, params.userId),
					gt(session.expiresAt, new Date()),
				),
			)

		// `rowsAffected` is `number | null` on @tidbcloud/serverless; null fails closed.
		return result.rowsAffected === 1
	},
}
