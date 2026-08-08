import { product } from "@repo/database"
import { ProductSlugExistsError } from "@repo/shop/errors"
import type { DatabaseExecutor } from "@repo/shop/factory"
import { and, desc, eq, lt } from "drizzle-orm"

const isDuplicateEntryError = (err: unknown): boolean => {
	if (!(err instanceof Error)) return false
	if ("code" in err && err.code === "ER_DUP_ENTRY") return true
	if (/duplicate entry|duplicate key|unique constraint/i.test(err.message)) return true
	if ("cause" in err) return isDuplicateEntryError(err.cause)
	return false
}

export const ProductRepository = {
	findById: async (db: DatabaseExecutor, id: string, shopId: string) => {
		const [foundProduct] = await db
			.select()
			.from(product)
			.where(and(eq(product.id, id), eq(product.shopId, shopId)))
			.limit(1)
		return foundProduct ?? null
	},

	insert: async (db: DatabaseExecutor, newProduct: typeof product.$inferInsert) => {
		try {
			const [insertedProduct] = await db.insert(product).values(newProduct).$returningId()
			if (!insertedProduct) throw new Error("Product was inserted but no ID was returned")
			return insertedProduct.id
		} catch (err) {
			if (isDuplicateEntryError(err)) throw new ProductSlugExistsError(newProduct.slug)
			throw err
		}
	},

	update: async (
		db: DatabaseExecutor,
		id: string,
		shopId: string,
		patch: Pick<typeof product.$inferInsert, "name" | "slug" | "description" | "priceMinor" | "isActive">,
	) => {
		try {
			await db
				.update(product)
				.set(patch)
				.where(and(eq(product.id, id), eq(product.shopId, shopId)))
		} catch (err) {
			if (isDuplicateEntryError(err)) throw new ProductSlugExistsError(patch.slug)
			throw err
		}
	},

	delete: async (db: DatabaseExecutor, id: string, shopId: string) => {
		await db.delete(product).where(and(eq(product.id, id), eq(product.shopId, shopId)))
	},

	list: async (db: DatabaseExecutor, shopId: string, opts: { limit: number; cursor: string | null }) => {
		const rows = await db
			.select()
			.from(product)
			.where(opts.cursor ? and(eq(product.shopId, shopId), lt(product.id, opts.cursor)) : eq(product.shopId, shopId))
			.orderBy(desc(product.id))
			.limit(opts.limit + 1)

		const hasMore = rows.length > opts.limit
		const page = hasMore ? rows.slice(0, opts.limit) : rows
		const last = page.at(-1)
		return {
			rows: page,
			nextCursor: hasMore && last ? last.id : null,
		}
	},
}
