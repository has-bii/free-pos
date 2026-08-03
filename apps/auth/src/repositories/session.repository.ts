import { session } from "@repo/database"
import type { DatabaseExecutor } from "../factory"

export async function insertSession(
	db: DatabaseExecutor,
	newSession: {
		id: string
		userId: string
		expiresAt: Date
		ipAddress: string | null
		userAgent: string | null
	},
): Promise<void> {
	const now = new Date()
	await db.insert(session).values({
		id: newSession.id,
		token: newSession.id,
		userId: newSession.userId,
		expiresAt: newSession.expiresAt,
		ipAddress: newSession.ipAddress,
		userAgent: newSession.userAgent,
		createdAt: now,
		updatedAt: now,
	})
}
