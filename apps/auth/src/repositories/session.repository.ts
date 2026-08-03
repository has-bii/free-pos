import { session } from "@repo/database"
import type { DatabaseExecutor } from "../factory"

export const insertSession = async (
	db: DatabaseExecutor,
	newSession: typeof session.$inferInsert,
): Promise<void> => {
	await db.insert(session).values(newSession)
}
