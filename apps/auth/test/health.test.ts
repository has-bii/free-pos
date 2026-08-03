import { describe, expect, it } from "vitest"
import { get, readJson } from "./helpers/http"

describe("GET /health", () => {
	// Case 26
	it("returns ok when the database is reachable", async () => {
		const res = await get("/health")

		expect(res.status).toBe(200)
		expect(await readJson<{ status: string }>(res)).toEqual({ status: "ok" })
	})
})
