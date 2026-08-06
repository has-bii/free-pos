import type { DatabaseExecutor } from "@repo/auth/factory"
import { account } from "@repo/database"
import { and, eq } from "drizzle-orm"

const isDuplicateEntryError = (err: unknown): boolean => {
	if (!(err instanceof Error)) return false
	if ("code" in err && err.code === "ER_DUP_ENTRY") return true
	return /duplicate entry/i.test(err.message)
}

export const AccountRepository = {
	findCredentialByUserId: async (db: DatabaseExecutor, userId: string) => {
		const [credentialAccount] = await db
			.select()
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
			.limit(1)
		return credentialAccount ?? null
	},

	findByProviderAccount: async (db: DatabaseExecutor, providerId: string, accountId: string) => {
		const [foundAccount] = await db
			.select()
			.from(account)
			.where(and(eq(account.providerId, providerId), eq(account.accountId, accountId)))
			.limit(1)
		return foundAccount ?? null
	},

	/**
	 * Link an OAuth identity while normalizing the provider/account unique
	 * constraint into a false result. The service can then re-read the row and
	 * safely handle two callbacks racing to create the same link.
	 */
	linkGoogle: async (db: DatabaseExecutor, userId: string, accountId: string) => {
		try {
			await db.insert(account).values({ userId, accountId, providerId: "google", password: null })
		} catch (err) {
			if (isDuplicateEntryError(err)) return false
			throw err
		}
		return true
	},

	insert: async (db: DatabaseExecutor, payload: typeof account.$inferInsert) => {
		await db.insert(account).values(payload)
	},

	updatePasswordByUserId: async (db: DatabaseExecutor, userId: string, passwordHash: string) => {
		await db
			.update(account)
			.set({ password: passwordHash })
			.where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
	},
}
