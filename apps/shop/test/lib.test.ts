import { InvalidCursorError, InvalidShopNameError } from "@repo/shop/errors"
import { decodeCursor, encodeCursor } from "@repo/shop/lib/cursor"
import { deriveSlug } from "@repo/shop/lib/slug"
import { describe, expect, it } from "vitest"

describe("deriveSlug", () => {
	it("normalizes names to lowercase ASCII slugs", () => {
		expect(deriveSlug("  Café & Co.  ")).toBe("caf-co")
	})

	it("rejects names without an ASCII letter or number", () => {
		expect(() => deriveSlug("🏪✨")).toThrowError(InvalidShopNameError)
	})

	it("does not cut a token when truncating", () => {
		expect(() => deriveSlug(`${"a".repeat(65)}-shop`)).toThrowError(InvalidShopNameError)
		expect(deriveSlug(`${"a".repeat(60)}-shop-name`)).toBe("a".repeat(60))
		expect(deriveSlug(`${"a".repeat(64)}-shop`)).toBe("a".repeat(64))
	})
})

describe("cursor encoding", () => {
	it("round-trips a shop id", () => {
		const id = "0192abcd-ef12-3456-7890-abcdef123456"
		expect(decodeCursor(encodeCursor(id))).toBe(id)
	})

	it("rejects malformed cursors", () => {
		expect(() => decodeCursor("not-a-cursor")).toThrowError(InvalidCursorError)
	})
})
