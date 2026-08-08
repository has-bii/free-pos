import { errorResponse, successResponse } from "@repo/hono-utils/response"
import { describe, expect, it } from "vitest"

describe("successResponse", () => {
	it("builds a success envelope with a payload", () => {
		expect(successResponse("Shop fetched successfully.", { id: "shop-1" })).toEqual({
			success: true,
			message: "Shop fetched successfully.",
			data: { id: "shop-1" },
		})
	})

	it("supports operations without a payload", () => {
		expect(successResponse("Shop deleted successfully.", null)).toEqual({
			success: true,
			message: "Shop deleted successfully.",
			data: null,
		})
	})
})

describe("errorResponse", () => {
	it("adds success false without dropping endpoint-specific fields", () => {
		const payload = {
			message: "Validation failed.",
			error: { name: { message: "Name is required." } },
			status: "error",
		}

		expect(errorResponse(payload)).toEqual({ ...payload, success: false })
		expect(payload).toEqual({
			message: "Validation failed.",
			error: { name: { message: "Name is required." } },
			status: "error",
		})
	})
})
