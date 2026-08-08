import { requireAuth } from "@repo/auth-kit/middleware/auth"
import { CategorySlugExistsError, InvalidCategoryNameError } from "@repo/shop/errors"
import type { AppEnv } from "@repo/shop/factory"
import { factory } from "@repo/shop/factory"
import { deriveCategorySlug } from "@repo/shop/lib/slug"
import { validate } from "@repo/shop/middleware/validate"
import { categoryBodySchema, categoryIdParamSchema } from "@repo/shop/modules/category/category.schema"
import { CategoryRepository } from "@repo/shop/repositories/category.repository"
import { ShopRepository } from "@repo/shop/repositories/shop.repository"

const auth = requireAuth<AppEnv>((c) => c.env.FREE_POS_JWT_SECRET)

export const createCategoryHandlers = factory.createHandlers(auth, validate("json", categoryBodySchema), async (c) => {
	const body = c.req.valid("json")
	const db = c.var.db
	const foundShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
	if (!foundShop) return c.json({ message: "Shop not found." }, 404)

	let slug: string
	try {
		slug = deriveCategorySlug(body.name)
	} catch (err) {
		if (err instanceof InvalidCategoryNameError) return c.json({ message: err.message }, 422)
		throw err
	}

	let categoryId: string
	try {
		categoryId = await CategoryRepository.insert(db, {
			shopId: foundShop.id,
			name: body.name,
			slug,
		})
	} catch (err) {
		if (err instanceof CategorySlugExistsError) return c.json({ message: "Category slug is already taken." }, 409)
		throw err
	}

	const createdCategory = await CategoryRepository.findById(db, categoryId, foundShop.id)
	if (!createdCategory) throw new Error("Category was inserted but could not be read back")
	return c.json({ message: "Category created.", data: createdCategory }, 201)
})

export const listCategoryHandlers = factory.createHandlers(auth, async (c) => {
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	if (!foundShop) return c.json({ message: "Shop not found." }, 404)

	const categories = await CategoryRepository.list(c.var.db, foundShop.id)
	return c.json({ message: "ok", data: categories })
})

export const getCategoryHandlers = factory.createHandlers(auth, validate("param", categoryIdParamSchema), async (c) => {
	const { id } = c.req.valid("param")
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	if (!foundShop) return c.json({ message: "Shop not found." }, 404)

	const foundCategory = await CategoryRepository.findById(c.var.db, id, foundShop.id)
	if (!foundCategory) return c.json({ message: "Category not found." }, 404)
	return c.json({ message: "ok", data: foundCategory })
})

export const updateCategoryHandlers = factory.createHandlers(
	auth,
	validate("param", categoryIdParamSchema),
	validate("json", categoryBodySchema),
	async (c) => {
		const { id } = c.req.valid("param")
		const body = c.req.valid("json")
		const db = c.var.db
		const foundShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
		if (!foundShop) return c.json({ message: "Shop not found." }, 404)

		const foundCategory = await CategoryRepository.findById(db, id, foundShop.id)
		if (!foundCategory) return c.json({ message: "Category not found." }, 404)

		let slug: string
		try {
			slug = deriveCategorySlug(body.name)
		} catch (err) {
			if (err instanceof InvalidCategoryNameError) return c.json({ message: err.message }, 422)
			throw err
		}

		if (
			slug !== foundCategory.slug &&
			(await CategoryRepository.slugExistsForOther(db, slug, foundShop.id, foundCategory.id))
		) {
			return c.json({ message: "Category slug is already taken." }, 409)
		}

		try {
			await CategoryRepository.update(db, id, foundShop.id, { name: body.name, slug })
		} catch (err) {
			if (err instanceof CategorySlugExistsError) return c.json({ message: "Category slug is already taken." }, 409)
			throw err
		}

		const updatedCategory = await CategoryRepository.findById(db, id, foundShop.id)
		if (!updatedCategory) throw new Error("Category was updated but could not be read back")
		return c.json({ message: "Category updated.", data: updatedCategory })
	},
)

export const deleteCategoryHandlers = factory.createHandlers(
	auth,
	validate("param", categoryIdParamSchema),
	async (c) => {
		const { id } = c.req.valid("param")
		const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
		if (!foundShop) return c.json({ message: "Shop not found." }, 404)

		const foundCategory = await CategoryRepository.findById(c.var.db, id, foundShop.id)
		if (!foundCategory) return c.json({ message: "Category not found." }, 404)

		await CategoryRepository.delete(c.var.db, id, foundShop.id)
		return c.json({ message: "Category deleted." })
	},
)
