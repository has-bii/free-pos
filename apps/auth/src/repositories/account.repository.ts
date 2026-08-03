import { account } from "@repo/database"
import { and, eq } from "drizzle-orm"
import type { DatabaseExecutor } from "../factory"

export async function findCredentialAccountByUserId(
	db: DatabaseExecutor,
	userId: string,
) {
	const [credentialAccount] = await db
		.select()
		.from(account)
		.where(
			and(eq(account.userId, userId), eq(account.providerId, "credential")),
		)
		.limit(1)
	return credentialAccount ?? null
}

export async function insertCredentialAccount(
	db: DatabaseExecutor,
	newAccount: typeof account.$inferInsert,
): Promise<void> {
	await db.insert(account).values(newAccount)
}
