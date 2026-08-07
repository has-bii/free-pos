import * as v from "valibot"

export const shopBodySchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Name is required."),
		v.maxLength(255, "Name must be at most 255 characters."),
	),
	description: v.nullable(v.string()),
	address: v.nullable(v.string()),
})

export const shopListQuerySchema = v.object({
	cursor: v.optional(v.string()),
})

export const shopSlugParamSchema = v.object({
	slug: v.pipe(
		v.string(),
		v.nonEmpty("Slug is required."),
		v.maxLength(64, "Slug must be at most 64 characters."),
		v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid shop slug."),
	),
})

export type ShopBody = v.InferOutput<typeof shopBodySchema>
