import * as v from "valibot"

// Mirrors apps/auth's forgotPasswordSchema exactly (email pipe).
export const forgotPasswordSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.toLowerCase(),
		v.nonEmpty("Email is required."),
		v.email("Enter a valid email address."),
	),
})
