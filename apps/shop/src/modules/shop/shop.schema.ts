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

export type ShopBody = v.InferOutput<typeof shopBodySchema>
