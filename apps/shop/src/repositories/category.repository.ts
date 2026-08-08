import { category } from "@repo/database"
import { CategorySlugExistsError } from "@repo/shop/errors"
import type { DatabaseExecutor } from "@repo/shop/factory"
import { and, asc, eq, ne } from "drizzle-orm"

const isDuplicateEntryError = (err: unknown): boolean => {
	if (!(err instanceof Error)) return false
	if ("code" in err && err.code === "ER_DUP_ENTRY") return true
	if (/duplicate entry|duplicate key|unique constraint/i.test(err.message)) return true
	if ("cause" in err) return isDuplicateEntryError(err.cause)
	return false
}

export const CategoryRepository = {
	findById: async (db: DatabaseExecutor, id: string, shopId: string) => {
		const [foundCategory] = await db
			.select()
			.from(category)
			.where(and(eq(category.id, id), eq(category.shopId, shopId)))
			.limit(1)
		return foundCategory ?? null
	},

	list: async (db: DatabaseExecutor, shopId: string) =>
		db.select().from(category).where(eq(category.shopId, shopId)).orderBy(asc(category.name), asc(category.id)),

	slugExistsForOther: async (db: DatabaseExecutor, slug: string, shopId: string, excludeId: string) => {
		const [foundCategory] = await db
			.select({ id: category.id })
			.from(category)
			.where(and(eq(category.shopId, shopId), eq(category.slug, slug), ne(category.id, excludeId)))
			.limit(1)
		return Boolean(foundCategory)
	},

	insert: async (db: DatabaseExecutor, newCategory: typeof category.$inferInsert) => {
		try {
			const [insertedCategory] = await db.insert(category).values(newCategory).$returningId()
			if (!insertedCategory) throw new Error("Category was inserted but no ID was returned")
			return insertedCategory.id
		} catch (err) {
			if (isDuplicateEntryError(err)) throw new CategorySlugExistsError(newCategory.slug)
			throw err
		}
	},

	update: async (
		db: DatabaseExecutor,
		id: string,
		shopId: string,
		patch: Pick<typeof category.$inferInsert, "name" | "slug">,
	) => {
		try {
			await db
				.update(category)
				.set(patch)
				.where(and(eq(category.id, id), eq(category.shopId, shopId)))
		} catch (err) {
			if (isDuplicateEntryError(err)) throw new CategorySlugExistsError(patch.slug)
			throw err
		}
	},

	delete: async (db: DatabaseExecutor, id: string, shopId: string) => {
		await db.delete(category).where(and(eq(category.id, id), eq(category.shopId, shopId)))
	},
}
