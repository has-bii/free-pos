import { requireAuth } from "@repo/auth-kit/middleware/auth"
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
import { shopBodySchema } from "@repo/shop/modules/shop/shop.schema"
import { ShopRepository } from "@repo/shop/repositories/shop.repository"

const auth = requireAuth<AppEnv>((c) => c.env.FREE_POS_JWT_SECRET)
const LIMIT = 10

export const listShopHandlers = factory.createHandlers(async (c) => {
	const rawCursor = c.req.query("cursor")
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

	const result = await ShopRepository.list(c.var.db, { limit: LIMIT, cursor })
	return c.json({
		message: "ok",
		data: {
			data: result.rows,
			pagination: { nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null },
		},
	})
})

export const getMyShopHandlers = factory.createHandlers(auth, async (c) => {
	const foundShop = await ShopRepository.findByOwnerUserId(c.var.db, c.var.userId)
	return c.json({ message: "ok", data: { shop: foundShop } })
})

export const getShopBySlugHandlers = factory.createHandlers(async (c) => {
	const slug = c.req.param("slug")
	if (!slug) return c.json({ message: "Shop not found." }, 404)
	const foundShop = await ShopRepository.findBySlug(c.var.db, slug)
	if (!foundShop) return c.json({ message: "Shop not found." }, 404)
	return c.json({ message: "ok", data: { shop: foundShop } })
})

export const createShopHandlers = factory.createHandlers(auth, validate("json", shopBodySchema), async (c) => {
	const body = c.req.valid("json")
	const db = c.var.db

	if (await ShopRepository.findByOwnerUserId(db, c.var.userId)) {
		return c.json({ message: "You already have a shop." }, 409)
	}

	let slug: string
	try {
		slug = deriveSlug(body.name)
	} catch (err) {
		if (err instanceof InvalidShopNameError) return c.json({ message: err.message }, 422)
		throw err
	}

	if (await ShopRepository.findBySlug(db, slug)) {
		return c.json({ message: "Shop slug is already taken." }, 409)
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
		if (err instanceof ShopAlreadyExistsError) return c.json({ message: "You already have a shop." }, 409)
		if (err instanceof ShopSlugExistsError) return c.json({ message: "Shop slug is already taken." }, 409)
		throw err
	}

	const createdShop = await ShopRepository.findByOwnerUserId(db, c.var.userId)
	if (!createdShop) throw new Error("Shop was inserted but could not be read back")
	return c.json({ message: "Shop created.", data: { shop: createdShop } }, 201)
})

export const updateShopHandlers = factory.createHandlers(auth, validate("json", shopBodySchema), async (c) => {
	const body = c.req.valid("json")
	const db = c.var.db
	const id = c.req.param("id")
	if (!id) return c.json({ message: "Shop not found." }, 404)
	const foundShop = await ShopRepository.findById(db, id)
	if (!foundShop || foundShop.ownerUserId !== c.var.userId) return c.json({ message: "Shop not found." }, 404)

	let slug: string
	try {
		slug = deriveSlug(body.name)
	} catch (err) {
		if (err instanceof InvalidShopNameError) return c.json({ message: err.message }, 422)
		throw err
	}

	if (slug !== foundShop.slug && (await ShopRepository.slugExistsForOther(db, slug, id))) {
		return c.json({ message: "Shop slug is already taken." }, 409)
	}

	try {
		await ShopRepository.update(db, id, { name: body.name, slug, description: body.description, address: body.address })
	} catch (err) {
		if (err instanceof ShopSlugExistsError) return c.json({ message: "Shop slug is already taken." }, 409)
		throw err
	}

	const updatedShop = await ShopRepository.findById(db, id)
	if (!updatedShop) throw new Error("Shop was updated but could not be read back")
	return c.json({ message: "Shop updated.", data: { shop: updatedShop } })
})

export const deleteShopHandlers = factory.createHandlers(auth, async (c) => {
	const db = c.var.db
	const id = c.req.param("id")
	if (!id) return c.json({ message: "Shop not found." }, 404)
	const foundShop = await ShopRepository.findById(db, id)
	if (!foundShop || foundShop.ownerUserId !== c.var.userId) return c.json({ message: "Shop not found." }, 404)

	await ShopRepository.delete(db, id)
	return c.json({ message: "Shop deleted." })
})
