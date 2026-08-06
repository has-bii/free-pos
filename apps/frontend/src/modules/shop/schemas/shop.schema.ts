import * as v from "valibot"

export const shopSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Shop name is required."),
		v.maxLength(255, "Shop name must be at most 255 characters."),
	),
	description: v.string(),
	address: v.string(),
})

export type ShopFormValues = v.InferOutput<typeof shopSchema>
