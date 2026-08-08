import * as v from "valibot"

const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const productBodySchema = v.strictObject({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Name is required."),
		v.maxLength(255, "Name must be at most 255 characters."),
	),
	description: v.nullable(v.pipe(v.string(), v.maxLength(200, "Description must be at most 200 characters."))),
	priceMinor: v.pipe(v.number(), v.integer(), v.minValue(0)),
	isActive: v.boolean(),
	categoryId: v.nullable(v.pipe(v.string(), v.regex(PRODUCT_ID_PATTERN, "Invalid category ID."))),
})

export const productListQuerySchema = v.strictObject({
	cursor: v.optional(v.string()),
})

export const productIdParamSchema = v.strictObject({
	id: v.pipe(v.string(), v.regex(PRODUCT_ID_PATTERN, "Invalid product ID.")),
})

export type ProductBody = v.InferOutput<typeof productBodySchema>
