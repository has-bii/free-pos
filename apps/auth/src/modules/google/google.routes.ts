import { factory } from "@repo/auth/factory"
import { googleCallbackHandlers, googleInitiationHandlers } from "./google.handlers"

export const googleRoutes = factory
	.createApp()
	.get("/login/google", ...googleInitiationHandlers)
	.get("/login/google/callback", ...googleCallbackHandlers)
