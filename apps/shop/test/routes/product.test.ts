import { env, exports } from "cloudflare:workers"
import { ACCESS_TOKEN_COOKIE_NAME } from "@repo/auth-kit/cookies"
import { createDatabaseClient, user } from "@repo/database"
import jwt from "@tsndr/cloudflare-worker-jwt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const worker = exports.default
const db = createDatabaseClient(env.FREE_POS_DATABASE_URL)
const userId = crypto.randomUUID()
const email = `t-${crypto.randomUUID()}@test.invalid`
const token = await jwt.sign({ sub: userId, sid: userId, type: "access" }, env.FREE_POS_JWT_SECRET, "HS256")

const request = (path: string, init: RequestInit = {}) => {
	const headers = new Headers(init.headers)
	headers.set("Cookie", `${ACCESS_TOKEN_COOKIE_NAME}=${token}`)
	return worker.fetch(`https://shop.test.invalid${path}`, { ...init, headers })
}

type ProductShape = {
	id: string
	shopId: string
	name: string
	slug: string
	description: string | null
	priceMinor: number
	isActive: boolean
}
type ProductResponse = { message: string; data: { product: ProductShape } }
type ProductListResponse = {
	message: string
	data: { data: ProductShape[]; pagination: { nextCursor: string | null } }
}
type MessageResponse = { message: string }
const json = <T>(res: Response) => res.json() as Promise<T>

beforeAll(async () => {
	await db.insert(user).values({
		id: userId,
		name: "Product Test User",
		email,
		emailVerified: true,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	})
})

afterAll(async () => {
	await db.delete(user).where(eq(user.id, userId))
})

describe("product routes", () => {
	it("requires authentication for every product route", async () => {
		const routes: Array<[string, RequestInit?]> = [
			["/shops/me/products"],
			["/shops/me/products/00000000-0000-0000-0000-000000000000"],
			[
				"/shops/me/products",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "Coffee", description: null, priceMinor: 100, isActive: true }),
				},
			],
			[
				"/shops/me/products/00000000-0000-0000-0000-000000000000",
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "Coffee", description: null, priceMinor: 100, isActive: true }),
				},
			],
			["/shops/me/products/00000000-0000-0000-0000-000000000000", { method: "DELETE" }],
		]

		for (const [path, init] of routes) {
			const res = await worker.fetch(`https://shop.test.invalid${path}`, init)
			expect(res.status).toBe(401)
		}
	})

	it("creates, lists, replaces, and deletes owned products", async () => {
		const shop = await request("/shops", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Product Test Shop", description: null, address: null }),
		})
		expect(shop.status).toBe(201)

		const missingActive = await request("/shops/me/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Missing Active", description: null, priceMinor: 100 }),
		})
		expect(missingActive.status).toBe(400)

		const create = await request("/shops/me/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Arabica Coffee",
				description: "250g bag",
				priceMinor: 1299,
				isActive: true,
			}),
		})
		expect(create.status).toBe(201)
		const created = (await json<ProductResponse>(create)).data.product
		expect(created).toMatchObject({
			name: "Arabica Coffee",
			slug: "arabica-coffee",
			description: "250g bag",
			priceMinor: 1299,
			isActive: true,
		})

		const inactive = await request("/shops/me/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Inactive Coffee", description: null, priceMinor: 0, isActive: false }),
		})
		expect(inactive.status).toBe(201)

		const list = await request("/shops/me/products")
		expect(list.status).toBe(200)
		const listed = (await json<ProductListResponse>(list)).data.data
		expect(listed).toHaveLength(2)
		expect(listed.map((product) => product.isActive).sort()).toEqual([false, true])

		const detail = await request(`/shops/me/products/${created.id}`)
		expect(detail.status).toBe(200)
		expect((await json<ProductResponse>(detail)).data.product.id).toBe(created.id)

		const update = await request(`/shops/me/products/${created.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "House Blend",
				description: null,
				priceMinor: 1399,
				isActive: false,
			}),
		})
		expect(update.status).toBe(200)
		expect((await json<ProductResponse>(update)).data.product).toMatchObject({
			id: created.id,
			name: "House Blend",
			slug: "house-blend",
			description: null,
			priceMinor: 1399,
			isActive: false,
		})

		const duplicate = await request("/shops/me/products", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "House Blend", description: null, priceMinor: 1, isActive: true }),
		})
		expect(duplicate.status).toBe(409)

		const remove = await request(`/shops/me/products/${created.id}`, { method: "DELETE" })
		expect(remove.status).toBe(200)
		expect((await json<MessageResponse>(remove)).message).toBe("Product deleted.")

		const afterDelete = await request(`/shops/me/products/${created.id}`)
		expect(afterDelete.status).toBe(404)
	})
})
