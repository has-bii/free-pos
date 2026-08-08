import { requireAuth } from "@repo/auth-kit/middleware/auth"
import { errorResponse, successResponse } from "@repo/hono-utils/response"
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
	if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

	let slug: string
	try {
		slug = deriveCategorySlug(body.name)
	} catch (err) {
		if (err instanceof InvalidCategoryNameError) return c.json(errorResponse({ message: err.message }), 422)
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
		if (err instanceof CategorySlugExistsError) {
			return c.json(errorResponse({ message: "Category slug is already taken." }), 409)
		}
		throw err
	}

	const createdCategory = await CategoryRepository.findById(db, categoryId, foundShop.id)
	if (!createdCategory) throw new Error("Category was inserted but could not be read back")
	return c.json(successResponse("Category created successfully.", createdCategory), 201)
})

export const listCategoryHandlers = factory.createHandlers(auth, async (c) => {
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

	const categories = await CategoryRepository.list(c.var.db, foundShop.id)
	return c.json(successResponse("Categories fetched successfully.", { data: categories, pagination: null }))
})

export const getCategoryHandlers = factory.createHandlers(auth, validate("param", categoryIdParamSchema), async (c) => {
	const { id } = c.req.valid("param")
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

	const foundCategory = await CategoryRepository.findById(c.var.db, id, foundShop.id)
	if (!foundCategory) return c.json(errorResponse({ message: "Category not found." }), 404)
	return c.json(successResponse("Category fetched successfully.", foundCategory))
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
		if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

		const foundCategory = await CategoryRepository.findById(db, id, foundShop.id)
		if (!foundCategory) return c.json(errorResponse({ message: "Category not found." }), 404)

		let slug: string
		try {
			slug = deriveCategorySlug(body.name)
		} catch (err) {
			if (err instanceof InvalidCategoryNameError) return c.json(errorResponse({ message: err.message }), 422)
			throw err
		}

		if (
			slug !== foundCategory.slug &&
			(await CategoryRepository.slugExistsForOther(db, slug, foundShop.id, foundCategory.id))
		) {
			return c.json(errorResponse({ message: "Category slug is already taken." }), 409)
		}

		try {
			await CategoryRepository.update(db, id, foundShop.id, { name: body.name, slug })
		} catch (err) {
			if (err instanceof CategorySlugExistsError) {
				return c.json(errorResponse({ message: "Category slug is already taken." }), 409)
			}
			throw err
		}

		const updatedCategory = await CategoryRepository.findById(db, id, foundShop.id)
		if (!updatedCategory) throw new Error("Category was updated but could not be read back")
		return c.json(successResponse("Category updated successfully.", updatedCategory))
	},
)

export const deleteCategoryHandlers = factory.createHandlers(
	auth,
	validate("param", categoryIdParamSchema),
	async (c) => {
		const { id } = c.req.valid("param")
		const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
		if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

		const foundCategory = await CategoryRepository.findById(c.var.db, id, foundShop.id)
		if (!foundCategory) return c.json(errorResponse({ message: "Category not found." }), 404)

		await CategoryRepository.delete(c.var.db, id, foundShop.id)
		return c.json(successResponse("Category deleted successfully.", null))
	},
)
