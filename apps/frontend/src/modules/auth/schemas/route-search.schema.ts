import { safeReturnLocation } from "@repo/frontend/utils/safe-return-location"
import * as v from "valibot"

const redirectSearchSchema = v.optional(
	v.pipe(
		v.string(),
		v.transform((value) => safeReturnLocation(value)),
	),
)

export const authRedirectSearchSchema = v.object({
	redirect: redirectSearchSchema,
})

export const loginSearchSchema = v.object({
	reset: v.optional(v.literal("success")),
	redirect: redirectSearchSchema,
})

export const resetPasswordSearchSchema = v.object({
	token: v.optional(v.string()),
	redirect: redirectSearchSchema,
})
