import type { DatabaseExecutor } from "@repo/auth/factory"
import { session } from "@repo/database"

export abstract class SessionRepository {
	static async insert(
		db: DatabaseExecutor,
		newSession: typeof session.$inferInsert,
	): Promise<void> {
		await db.insert(session).values(newSession)
	}
}
