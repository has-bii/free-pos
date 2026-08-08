import { requireAuth } from "@repo/auth-kit/middleware/auth"
import { errorResponse, successResponse } from "@repo/hono-utils/response"
import {
	InvalidCursorError,
	InvalidShopNameError,
	ShopAlreadyExistsError,
	ShopSlugExistsError,
} from "@repo/shop/errors"
import type { AppEnv } from "@repo/shop/factory"
import { factory } from "@repo/shop/factory"
import { decodeCursor, encodeCursor } from "@repo/shop/lib/cursor"
import { deriveSlug } from "@repo/shop/lib/slug"
import { validate } from "@repo/shop/middleware/validate"
import { shopBodySchema, shopListQuerySchema, shopSlugParamSchema } from "@repo/shop/modules/shop/shop.schema"
import { ShopRepository } from "@repo/shop/repositories/shop.repository"

const auth = requireAuth<AppEnv>((c) => c.env.FREE_POS_JWT_SECRET)
const LIMIT = 10

export const listShopHandlers = factory.createHandlers(validate("query", shopListQuerySchema), async (c) => {
	const { cursor: rawCursor } = c.req.valid("query")
	let cursor: string | null = null
	if (rawCursor !== undefined) {
		try {
			cursor = decodeCursor(rawCursor)
		} catch (err) {
			if (err instanceof InvalidCursorError) {
				return c.json(
					errorResponse({ message: "Validation failed.", error: { cursor: { message: err.message } } }),
					400,
				)
			}
			throw err
		}
	}

	const result = await ShopRepository.list(c.var.db, { limit: LIMIT, cursor })
	return c.json(
		successResponse("Shops fetched successfully.", {
			data: result.rows,
			pagination: { nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null },
		}),
	)
})

export const getMyShopHandlers = factory.createHandlers(auth, async (c) => {
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	return c.json(successResponse("Shop fetched successfully.", foundShop))
})

export const getShopBySlugHandlers = factory.createHandlers(validate("param", shopSlugParamSchema), async (c) => {
	const { slug } = c.req.valid("param")
	const foundShop = await ShopRepository.findBySlug(c.var.db, slug)
	if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)
	return c.json(successResponse("Shop fetched successfully.", foundShop))
})

export const createShopHandlers = factory.createHandlers(auth, validate("json", shopBodySchema), async (c) => {
	const body = c.req.valid("json")
	const db = c.var.db

	if (await ShopRepository.findByOwnerUserId(db, c.var.userId)) {
		return c.json(errorResponse({ message: "You already have a shop." }), 409)
	}

	let slug: string
	try {
		slug = deriveSlug(body.name)
	} catch (err) {
		if (err instanceof InvalidShopNameError) return c.json(errorResponse({ message: err.message }), 422)
		throw err
	}

	if (await ShopRepository.findBySlug(db, slug)) {
		return c.json(errorResponse({ message: "Shop slug is already taken." }), 409)
	}

	try {
		await ShopRepository.insert(db, {
			ownerUserId: c.var.userId,
			name: body.name,
			slug,
			description: body.description,
			address: body.address,
		})
	} catch (err) {
		if (err instanceof ShopAlreadyExistsError)
			return c.json(errorResponse({ message: "You already have a shop." }), 409)
		if (err instanceof ShopSlugExistsError)
			return c.json(errorResponse({ message: "Shop slug is already taken." }), 409)
		throw err
	}

	const createdShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
	if (!createdShop) throw new Error("Shop was inserted but could not be read back")
	return c.json(successResponse("Shop created successfully.", createdShop), 201)
})

export const updateShopHandlers = factory.createHandlers(auth, validate("json", shopBodySchema), async (c) => {
	const body = c.req.valid("json")
	const db = c.var.db
	const foundShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
	if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

	const { id } = foundShop
	let slug: string
	try {
		slug = deriveSlug(body.name)
	} catch (err) {
		if (err instanceof InvalidShopNameError) return c.json(errorResponse({ message: err.message }), 422)
		throw err
	}

	if (slug !== foundShop.slug && (await ShopRepository.slugExistsForOther(db, slug, id))) {
		return c.json(errorResponse({ message: "Shop slug is already taken." }), 409)
	}

	try {
		await ShopRepository.update(db, id, {
			name: body.name,
			slug,
			description: body.description,
			address: body.address,
		})
	} catch (err) {
		if (err instanceof ShopSlugExistsError)
			return c.json(errorResponse({ message: "Shop slug is already taken." }), 409)
		throw err
	}

	const updatedShop = await ShopRepository.findById(db, id)
	if (!updatedShop) throw new Error("Shop was updated but could not be read back")
	return c.json(successResponse("Shop updated successfully.", updatedShop))
})

export const deleteShopHandlers = factory.createHandlers(auth, async (c) => {
	const db = c.var.db
	const foundShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
	if (!foundShop) return c.json(errorResponse({ message: "Shop not found." }), 404)

	await ShopRepository.delete(db, foundShop.id)
	return c.json(successResponse("Shop deleted successfully.", null))
})
