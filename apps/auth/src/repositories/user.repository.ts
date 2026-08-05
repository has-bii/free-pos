import { EmailAlreadyExistsError } from "@repo/auth/errors"
import type { DatabaseExecutor } from "@repo/auth/factory"
import { user } from "@repo/database"
import { eq } from "drizzle-orm"

const isDuplicateEntryError = (err: unknown): boolean => {
	if (!(err instanceof Error)) return false
	if ("code" in err && err.code === "ER_DUP_ENTRY") return true
	return /duplicate entry/i.test(err.message)
}

export const UserRepository = {
	findByEmail: async (db: DatabaseExecutor, email: string) => {
		const [foundUser] = await db.select().from(user).where(eq(user.email, email)).limit(1)
		return foundUser ?? null
	},

	findById: async (db: DatabaseExecutor, id: string) => {
		const [foundUser] = await db.select().from(user).where(eq(user.id, id)).limit(1)
		return foundUser ?? null
	},

	insert: async (db: DatabaseExecutor, newUser: typeof user.$inferInsert) => {
		try {
			await db.insert(user).values(newUser)
		} catch (err) {
			if (isDuplicateEntryError(err)) {
				throw new EmailAlreadyExistsError(newUser.email)
			}
			throw err
		}
	},

	markEmailVerified: async (db: DatabaseExecutor, userId: string) => {
		await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId))
	},
}
