import { session } from "@repo/database"
import type { DatabaseExecutor } from "../factory"

export abstract class SessionRepository {
	static async insert(
		db: DatabaseExecutor,
		newSession: typeof session.$inferInsert,
	): Promise<void> {
		await db.insert(session).values(newSession)
	}
}
