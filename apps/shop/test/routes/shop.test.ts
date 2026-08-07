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

type ShopShape = { id: string; slug: string; ownerUserId: string }
type ShopResponse = { message: string; data: { shop: ShopShape } }
type MessageResponse = { message: string }
const json = <T>(res: Response) => res.json() as Promise<T>

beforeAll(async () => {
	const now = new Date()
	await db.insert(user).values({
		id: userId,
		name: "Shop Test User",
		email,
		emailVerified: true,
		image: null,
		createdAt: now,
		updatedAt: now,
	})
})

afterAll(async () => {
	await db.delete(user).where(eq(user.id, userId))
})

describe("shop routes", () => {
	it("requires auth for the owner endpoint", async () => {
		const res = await worker.fetch("https://shop.test.invalid/shops/me")
		expect(res.status).toBe(401)
		expect((await json<MessageResponse>(res)).message).toBe("Unauthorized.")
	})

	it("creates, reads, updates, and deletes an owned shop", async () => {
		const create = await request("/shops", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Route Test Shop", description: "before", address: null }),
		})
		expect(create.status).toBe(201)
		const created = (await json<ShopResponse>(create)).data.shop
		expect(created.slug).toBe("route-test-shop")
		expect(created.ownerUserId).toBe(userId)

		const publicRead = await worker.fetch(`https://shop.test.invalid/shops/${created.slug}`)
		expect(publicRead.status).toBe(200)
		expect((await json<ShopResponse>(publicRead)).data.shop.id).toBe(created.id)

		const update = await request("/shops/me", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Updated Route Shop", description: null, address: "Main Street" }),
		})
		expect(update.status).toBe(200)
		expect((await json<ShopResponse>(update)).data.shop.slug).toBe("updated-route-shop")

		const remove = await request("/shops/me", { method: "DELETE" })
		expect(remove.status).toBe(200)
		expect((await json<MessageResponse>(remove)).message).toBe("Shop deleted.")
	})
})
