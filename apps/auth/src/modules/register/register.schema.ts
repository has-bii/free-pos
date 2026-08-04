import * as v from "valibot"

export const registerEmailSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.nonEmpty("Name is required.")),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.nonEmpty("Email is required."),
		v.email("Enter a valid email address."),
	),
	password: v.pipe(v.string(), v.minLength(8, "Password must be at least 8 characters.")),
})
