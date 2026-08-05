import { factory } from "@repo/auth/factory"
import { forgotPasswordHandlers, resetPasswordHandlers } from "./recovery.handlers"

export const recoveryRoutes = factory
	.createApp()
	.post("/recovery/forgot-password", ...forgotPasswordHandlers)
	.post("/recovery/reset-password", ...resetPasswordHandlers)
