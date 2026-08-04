import * as v from "valibot"

export const loginSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.nonEmpty("Email is required."),
		v.email("Enter a valid email address."),
	),
	password: v.pipe(
		v.string(),
		v.nonEmpty("Password is required."),
		v.minLength(8, "Password must be at least 8 characters."),
	),
})

export type LoginValues = v.InferOutput<typeof loginSchema>
