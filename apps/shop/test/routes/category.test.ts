import { env, exports } from "cloudflare:workers"
import { ACCESS_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { category as categoryTable, createDatabaseClient, shop as shopTable, user } from "@repo/database"
import jwt from "@tsndr/cloudflare-worker-jwt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const worker = exports.default
const db = createDatabaseClient(env.FREE_POS_DATABASE_URL)
const userId = crypto.randomUUID()
const otherUserId = crypto.randomUUID()
const email = `t-${crypto.randomUUID()}@test.invalid`
const otherEmail = `t-${crypto.randomUUID()}@test.invalid`
const token = await jwt.sign({ sub: userId, sid: userId, type: "access" }, env.FREE_POS_JWT_SECRET, "HS256")

const request = (path: string, init: RequestInit = {}) => {
	const headers = new Headers(init.headers)
	headers.set("Cookie", `${ACCESS_TOKEN_COOKIE_NAME}=${token}`)
	return worker.fetch(`https://shop.test.invalid${path}`, { ...init, headers })
}

type CategoryShape = {
	id: string
	shopId: string
	name: string
	slug: string
	createdAt: string
	updatedAt: string
}
type CategoryResponse = { message: string; data: CategoryShape }
type CategoryListResponse = { message: string; data: CategoryShape[] }
type ProductResponse = { message: string; data: { product: { id: string; categoryId: string | null } } }
type MessageResponse = { message: string }
const json = <T>(res: Response) => res.json() as Promise<T>

beforeAll(async () => {
	await db.insert(user).values([
		{
			id: userId,
			name: "Category Test User",
			email,
			emailVerified: true,
			image: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: otherUserId,
			name: "Other Category User",
			email: otherEmail,
			emailVerified: true,
			image: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	])
})

afterAll(async () => {
	await db.delete(user).where(eq(user.id, userId))
	await db.delete(user).where(eq(user.id, otherUserId))
})

describe("category routes", () => {
	it("requires authentication for every category route", async () => {
		const routes: Array<[string, RequestInit?]> = [
			["/shops/me/categories"],
			["/shops/me/categories/00000000-0000-0000-0000-000000000000"],
			[
				"/shops/me/categories",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "Beverages" }),
				},
			],
			[
				"/shops/me/categories/00000000-0000-0000-0000-000000000000",
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "Beverages" }),
				},
			],
			["/shops/me/categories/00000000-0000-0000-0000-000000000000", { method: "DELETE" }],
		]

		for (const [path, init] of routes) {
			const res = await worker.fetch(`https://shop.test.invalid${path}`, init)
			expect(res.status).toBe(401)
		}
	})

	it("rejects category operations when the owner has no shop", async () => {
		const list = await request("/shops/me/categories")
		expect(list.status).toBe(404)
		expect((await json<MessageResponse>(list)).message).toBe("Shop not found.")

		const create = await request("/shops/me/categories", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Beverages" }),
		})
		expect(create.status).toBe(404)
	})

	it("creates, lists, updates, assigns, and deletes categories", async () => {
		const shopResponse = await request("/shops", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Category Test Shop", description: null, address: null }),
		})
		expect(shopResponse.status).toBe(201)
		const shop = (await json<{ message: string; data: { shop: { id: string } } }>(shopResponse)).data.shop

		for (const name of ["", "   ", "x".repeat(256)]) {
			const invalid = await request("/shops/me/categories", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name }),
			})
			expect(invalid.status).toBe(400)
		}

		const unusable = await request("/shops/me/categories", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "🏪✨" }),
		})
		expect(unusable.status).toBe(422)
		expect((await json<MessageResponse>(unusable)).message).toBe(
			"Category name must contain at least one letter or number.",
		)

		const unknownField = await request("/shops/me/categories", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Ignored", slug: "client-slug" }),
		})
		expect(unknownField.status).toBe(400)

		const create = await request("/shops/me/categories", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "  Beverages  " }),
		})
		expect(create.status).toBe(201)
		const created = (await json<CategoryResponse>(create)).data
		expect(created).toMatchObject({ shopId: shop.id, name: "Beverages", slug: "beverages" })
		expect(created.id).toMatch(/[0-9a-f-]{36}/i)
		expect(created.createdAt).toBeTruthy()
		expect(created.updatedAt).toBeTruthy()

		const duplicate = await request("/shops/me/categories", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: " beverages " }),
		})
		expect(duplicate.status).toBe(409)

		for (const name of ["Zebra", "Bakery"]) {
			const response = await request("/shops/me/categories", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name }),
			})
			expect(response.status).toBe(201)
		}

		const list = await request("/shops/me/categories")
		expect(list.status).toBe(200)
		const listed = (await json<CategoryListResponse>(list)).data
		expect(Array.isArray(listed)).toBe(true)
		expect(listed.map((category) => category.name)).toEqual(["Bakery", "Beverages", "Zebra"])

		const malformed = await request("/shops/me/categories/not-a-uuid")
		expect(malformed.status).toBe(400)

		const missing = await request("/shops/me/categories/00000000-0000-0000-0000-000000000000")
		expect(missing.status).toBe(404)

		const otherShopId = crypto.randomUUID()
		const otherCategoryId = crypto.randomUUID()
		await db.insert(shopTable).values({
			id: otherShopId,
			ownerUserId: otherUserId,
			name: "Other Category Shop",
			slug: `other-category-shop-${otherShopId.slice(0, 8)}`,
			description: null,
			address: null,
		})
		await db.insert(categoryTable).values({
			id: otherCategoryId,
			shopId: otherShopId,
			name: "Other",
			slug: "other",
		})

		const crossShopDetail = await request(`/shops/me/categories/${otherCategoryId}`)
		expect(crossShopDetail.status).toBe(404)
		const crossShopUpdate = await request(`/shops/me/categories/${otherCategoryId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Changed" }),
		})
		expect(crossShopUpdate.status).toBe(404)
		const crossShopDelete = await request(`/shops/me/categories/${otherCategoryId}`, { method: "DELETE" })
		expect(crossShopDelete.status).toBe(404)

		const conflict = await request(`/shops/me/categories/${created.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: " Bakery " }),
		})
		expect(conflict.status).toBe(409)
		const unchanged = await request(`/shops/me/categories/${created.id}`)
		expect((await json<CategoryResponse>(unchanged)).data).toMatchObject({
			name: "Beverages",
			slug: "beverages",
		})

		const update = await request(`/shops/me/categories/${created.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: " Cold Beverages " }),
		})
		expect(update.status).toBe(200)
		expect((await json<CategoryResponse>(update)).data).toMatchObject({
			id: created.id,
			name: "Cold Beverages",
			slug: "cold-beverages",
		})

		const productCreate = await request("/shops/me/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Category Product",
				description: null,
				priceMinor: 100,
				isActive: true,
				categoryId: created.id,
			}),
		})
		expect(productCreate.status).toBe(201)
		const product = (await json<ProductResponse>(productCreate)).data.product
		expect(product.categoryId).toBe(created.id)

		const crossShopProduct = await request("/shops/me/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Cross Shop Product",
				description: null,
				priceMinor: 100,
				isActive: true,
				categoryId: otherCategoryId,
			}),
		})
		expect(crossShopProduct.status).toBe(422)
		expect(
			(await json<{ error: { categoryId: { message: string } } }>(crossShopProduct)).error.categoryId.message,
		).toBe("Category not found.")

		const productUpdate = await request(`/shops/me/products/${product.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Category Product",
				description: null,
				priceMinor: 101,
				isActive: true,
				categoryId: null,
			}),
		})
		expect(productUpdate.status).toBe(200)
		expect((await json<ProductResponse>(productUpdate)).data.product.categoryId).toBeNull()

		const productReassign = await request(`/shops/me/products/${product.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Category Product Reassigned",
				description: null,
				priceMinor: 101,
				isActive: true,
				categoryId: created.id,
			}),
		})
		expect(productReassign.status).toBe(200)

		const remove = await request(`/shops/me/categories/${created.id}`, { method: "DELETE" })
		expect(remove.status).toBe(200)
		expect((await json<MessageResponse>(remove)).message).toBe("Category deleted.")
		expect((await request(`/shops/me/categories/${created.id}`)).status).toBe(404)

		const productAfterCategoryDelete = await request(`/shops/me/products/${product.id}`)
		expect(productAfterCategoryDelete.status).toBe(200)
		expect((await json<ProductResponse>(productAfterCategoryDelete)).data.product.categoryId).toBeNull()

		const deleteShop = await request("/shops/me", { method: "DELETE" })
		expect(deleteShop.status).toBe(200)
		expect((await request("/shops/me/categories")).status).toBe(404)
		expect((await request(`/shops/me/products/${product.id}`)).status).toBe(404)
	})
})
