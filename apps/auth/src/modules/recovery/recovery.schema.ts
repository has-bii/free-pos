import * as v from "valibot"

// Mirrors the email pipe from login/register (trim + lowercase, server-side).
export const forgotPasswordSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.nonEmpty("Email is required."),
		v.email("Enter a valid email address."),
	),
})

// `password` named to match the register schema's field.
export const resetPasswordSchema = v.object({
	token: v.pipe(v.string(), v.nonEmpty("Reset token is required.")),
	password: v.pipe(v.string(), v.minLength(8, "Password must be at least 8 characters.")),
})
