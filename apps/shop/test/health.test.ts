import { exports } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

const worker = exports.default

describe("GET /health", () => {
	it("returns the success envelope when the database is reachable", async () => {
		const res = await worker.fetch("https://shop.test.invalid/health")

		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({
			success: true,
			message: "Health check passed.",
			data: null,
		})
	})
})
