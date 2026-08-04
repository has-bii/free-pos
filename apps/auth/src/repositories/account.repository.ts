import type { DatabaseExecutor } from "@repo/auth/factory"
import { account } from "@repo/database"
import { and, eq } from "drizzle-orm"

export const AccountRepository = {
	findCredentialByUserId: async (db: DatabaseExecutor, userId: string) => {
		const [credentialAccount] = await db
			.select()
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
			.limit(1)
		return credentialAccount ?? null
	},
	insert: async (db: DatabaseExecutor, payload: typeof account.$inferInsert) => {
		await db.insert(account).values(payload)
	},
}
