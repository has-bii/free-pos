import * as v from "valibot"

// Mirrors apps/auth's resetPasswordSchema plus the client-only confirm field —
// the same shape as the register schema's password/confirm pair.
export const resetPasswordSchema = v.pipe(
	v.object({
		token: v.pipe(v.string(), v.nonEmpty("Reset token is required.")),
		password: v.pipe(v.string(), v.minLength(8, "Password must be at least 8 characters.")),
		confirmPassword: v.string(),
	}),
	v.forward(
		v.partialCheck(
			[["password"], ["confirmPassword"]],
			(input) => input.password === input.confirmPassword,
			"Passwords do not match.",
		),
		["confirmPassword"],
	),
)
