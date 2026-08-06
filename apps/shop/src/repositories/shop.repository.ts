import { shop } from "@repo/database"
import { ShopAlreadyExistsError, ShopSlugExistsError } from "@repo/shop/errors"
import type { DatabaseExecutor } from "@repo/shop/factory"
import { and, desc, eq, lt, ne } from "drizzle-orm"

const isDuplicateEntryError = (err: unknown): boolean => {
	if (!(err instanceof Error)) return false
	if ("code" in err && err.code === "ER_DUP_ENTRY") return true
	return /duplicate entry/i.test(err.message)
}

const duplicateKey = (err: unknown): string => (err instanceof Error ? err.message.toLowerCase() : "")

export const ShopRepository = {
	findById: async (db: DatabaseExecutor, id: string) => {
		const [foundShop] = await db.select().from(shop).where(eq(shop.id, id)).limit(1)
		return foundShop ?? null
	},

	findByOwnerUserId: async (db: DatabaseExecutor, ownerUserId: string) => {
		const [foundShop] = await db.select().from(shop).where(eq(shop.ownerUserId, ownerUserId)).limit(1)
		return foundShop ?? null
	},

	findBySlug: async (db: DatabaseExecutor, slug: string) => {
		const [foundShop] = await db.select().from(shop).where(eq(shop.slug, slug)).limit(1)
		return foundShop ?? null
	},

	slugExistsForOther: async (db: DatabaseExecutor, slug: string, excludeId: string) => {
		const [foundShop] = await db
			.select({ id: shop.id })
			.from(shop)
			.where(and(eq(shop.slug, slug), ne(shop.id, excludeId)))
			.limit(1)
		return Boolean(foundShop)
	},

	insert: async (db: DatabaseExecutor, newShop: typeof shop.$inferInsert) => {
		try {
			await db.insert(shop).values({ ...newShop, slug: newShop.slug.toLowerCase() })
		} catch (err) {
			if (!isDuplicateEntryError(err)) throw err
			const key = duplicateKey(err)
			if (key.includes("slug")) throw new ShopSlugExistsError(newShop.slug)
			throw new ShopAlreadyExistsError(newShop.ownerUserId)
		}
	},

	update: async (
		db: DatabaseExecutor,
		id: string,
		patch: Pick<typeof shop.$inferInsert, "name" | "slug" | "description" | "address">,
	) => {
		try {
			await db
				.update(shop)
				.set({ ...patch, slug: patch.slug.toLowerCase() })
				.where(eq(shop.id, id))
		} catch (err) {
			if (isDuplicateEntryError(err)) throw new ShopSlugExistsError(patch.slug)
			throw err
		}
	},

	delete: async (db: DatabaseExecutor, id: string) => {
		await db.delete(shop).where(eq(shop.id, id))
	},

	list: async (db: DatabaseExecutor, opts: { limit: number; cursor: string | null }) => {
		const rows = await db
			.select()
			.from(shop)
			.where(opts.cursor ? lt(shop.id, opts.cursor) : undefined)
			.orderBy(desc(shop.id))
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
