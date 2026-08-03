import * as v from "valibot"

export const refreshSchema = v.object({
	refreshToken: v.pipe(v.string(), v.nonEmpty("Refresh token is required.")),
})
