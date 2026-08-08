import * as v from "valibot"

const CATEGORY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const categoryBodySchema = v.strictObject({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty("Name is required."),
		v.maxLength(255, "Name must be at most 255 characters."),
	),
})

export const categoryIdParamSchema = v.strictObject({
	id: v.pipe(v.string(), v.regex(CATEGORY_ID_PATTERN, "Invalid category ID.")),
})

export type CategoryBody = v.InferOutput<typeof categoryBodySchema>
