import { account } from "@repo/database"
import { and, eq } from "drizzle-orm"
import type { DatabaseExecutor } from "../factory"

export abstract class AccountRepository {
	static async findCredentialByUserId(db: DatabaseExecutor, userId: string) {
		const [credentialAccount] = await db
			.select()
			.from(account)
			.where(
				and(eq(account.userId, userId), eq(account.providerId, "credential")),
			)
			.limit(1)
		return credentialAccount ?? null
	}

	static async insert(
		db: DatabaseExecutor,
		payload: typeof account.$inferInsert,
	): Promise<void> {
		await db.insert(account).values(payload)
	}
}
