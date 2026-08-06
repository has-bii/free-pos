import { factory } from "@repo/auth/factory"
import { googleCallbackHandlers, googleInitiationHandlers, loginEmailHandlers } from "./login.handlers"

export const loginRoutes = factory
	.createApp()
	.post("/login/email", ...loginEmailHandlers)
	.get("/login/google", ...googleInitiationHandlers)
	.get("/login/google/callback", ...googleCallbackHandlers)
