import * as v from "valibot"

export const loginEmailSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.nonEmpty("Email is required."),
		v.email("Enter a valid email address."),
	),
	password: v.pipe(v.string(), v.nonEmpty("Password is required.")),
})
