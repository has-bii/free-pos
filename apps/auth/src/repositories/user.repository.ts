import { user } from "@repo/database"
import { eq } from "drizzle-orm"
import { EmailAlreadyExistsError } from "../errors"
import type { DatabaseExecutor } from "../factory"

function isDuplicateEntryError(err: unknown): boolean {
	if (!(err instanceof Error)) return false
	if ("code" in err && err.code === "ER_DUP_ENTRY") return true
	return /duplicate entry/i.test(err.message)
}

export async function findUserByEmail(db: DatabaseExecutor, email: string) {
	const [foundUser] = await db
		.select()
		.from(user)
		.where(eq(user.email, email))
		.limit(1)
	return foundUser ?? null
}

export async function insertUser(
	db: DatabaseExecutor,
	newUser: typeof user.$inferInsert,
): Promise<void> {
	try {
		await db.insert(user).values(newUser)
	} catch (err) {
		if (isDuplicateEntryError(err)) {
			throw new EmailAlreadyExistsError(newUser.email)
		}
		throw err
	}
}
