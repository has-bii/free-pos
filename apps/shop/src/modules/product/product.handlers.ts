import { requireAuth } from "@repo/auth-kit/middleware/auth"
import { InvalidCursorError, InvalidProductNameError, ProductSlugExistsError } from "@repo/shop/errors"
import type { AppEnv } from "@repo/shop/factory"
import { factory } from "@repo/shop/factory"
import { decodeCursor, encodeCursor } from "@repo/shop/lib/cursor"
import { deriveProductSlug } from "@repo/shop/lib/slug"
import { validate } from "@repo/shop/middleware/validate"
import {
	productBodySchema,
	productIdParamSchema,
	productListQuerySchema,
} from "@repo/shop/modules/product/product.schema"
import { CategoryRepository } from "@repo/shop/repositories/category.repository"
import { ProductRepository } from "@repo/shop/repositories/product.repository"
import { ShopRepository } from "@repo/shop/repositories/shop.repository"

const auth = requireAuth<AppEnv>((c) => c.env.FREE_POS_JWT_SECRET)
const LIMIT = 10

export const createProductHandlers = factory.createHandlers(auth, validate("json", productBodySchema), async (c) => {
	const body = c.req.valid("json")
	const db = c.var.db
	const foundShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
	if (!foundShop) return c.json({ message: "Shop not found." }, 404)

	if (body.categoryId !== null && !(await CategoryRepository.findById(db, body.categoryId, foundShop.id))) {
		return c.json({ message: "Validation failed.", error: { categoryId: { message: "Category not found." } } }, 422)
	}

	let slug: string
	try {
		slug = deriveProductSlug(body.name)
	} catch (err) {
		if (err instanceof InvalidProductNameError) return c.json({ message: err.message }, 422)
		throw err
	}

	let productId: string
	try {
		productId = await ProductRepository.insert(db, {
			shopId: foundShop.id,
			name: body.name,
			slug,
			description: body.description,
			priceMinor: body.priceMinor,
			isActive: body.isActive,
			categoryId: body.categoryId,
		})
	} catch (err) {
		if (err instanceof ProductSlugExistsError) return c.json({ message: "Product slug is already taken." }, 409)
		throw err
	}

	const createdProduct = await ProductRepository.findById(db, productId, foundShop.id)
	if (!createdProduct) throw new Error("Product was inserted but could not be read back")
	return c.json({ message: "Product created.", data: { product: createdProduct } }, 201)
})

export const listProductHandlers = factory.createHandlers(
	auth,
	validate("query", productListQuerySchema),
	async (c) => {
		const { cursor: rawCursor } = c.req.valid("query")
		const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
		if (!foundShop) return c.json({ message: "Shop not found." }, 404)

		let cursor: string | null = null
		if (rawCursor !== undefined) {
			try {
				cursor = decodeCursor(rawCursor)
			} catch (err) {
				if (err instanceof InvalidCursorError) {
					return c.json({ message: "Validation failed.", error: { cursor: { message: err.message } } }, 400)
				}
				throw err
			}
		}

		const result = await ProductRepository.list(c.var.db, foundShop.id, { limit: LIMIT, cursor })
		return c.json({
			message: "ok",
			data: {
				data: result.rows,
				pagination: { nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null },
			},
		})
	},
)

export const getProductHandlers = factory.createHandlers(auth, validate("param", productIdParamSchema), async (c) => {
	const { id } = c.req.valid("param")
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	if (!foundShop) return c.json({ message: "Shop not found." }, 404)

	const foundProduct = await ProductRepository.findById(c.var.db, id, foundShop.id)
	if (!foundProduct) return c.json({ message: "Product not found." }, 404)
	return c.json({ message: "ok", data: { product: foundProduct } })
})

export const updateProductHandlers = factory.createHandlers(
	auth,
	validate("param", productIdParamSchema),
	validate("json", productBodySchema),
	async (c) => {
		const { id } = c.req.valid("param")
		const body = c.req.valid("json")
		const db = c.var.db
		const foundShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
		if (!foundShop) return c.json({ message: "Shop not found." }, 404)

		const foundProduct = await ProductRepository.findById(db, id, foundShop.id)
		if (!foundProduct) return c.json({ message: "Product not found." }, 404)

		if (body.categoryId !== null && !(await CategoryRepository.findById(db, body.categoryId, foundShop.id))) {
			return c.json({ message: "Validation failed.", error: { categoryId: { message: "Category not found." } } }, 422)
		}

		let slug: string
		try {
			slug = deriveProductSlug(body.name)
		} catch (err) {
			if (err instanceof InvalidProductNameError) return c.json({ message: err.message }, 422)
			throw err
		}

		try {
			await ProductRepository.update(db, id, foundShop.id, {
				name: body.name,
				slug,
				description: body.description,
				priceMinor: body.priceMinor,
				isActive: body.isActive,
				categoryId: body.categoryId,
			})
		} catch (err) {
			if (err instanceof ProductSlugExistsError) return c.json({ message: "Product slug is already taken." }, 409)
			throw err
		}

		const updatedProduct = await ProductRepository.findById(db, id, foundShop.id)
		if (!updatedProduct) throw new Error("Product was updated but could not be read back")
		return c.json({ message: "Product updated.", data: { product: updatedProduct } })
	},
)

export const deleteProductHandlers = factory.createHandlers(
	auth,
	validate("param", productIdParamSchema),
	async (c) => {
		const { id } = c.req.valid("param")
		const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
		if (!foundShop) return c.json({ message: "Shop not found." }, 404)

		const foundProduct = await ProductRepository.findById(c.var.db, id, foundShop.id)
		if (!foundProduct) return c.json({ message: "Product not found." }, 404)

		await ProductRepository.delete(c.var.db, id, foundShop.id)
		return c.json({ message: "Product deleted." })
	},
)
