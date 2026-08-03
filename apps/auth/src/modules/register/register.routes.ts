import { factory } from "@repo/auth/factory"
import { registerEmailHandlers } from "./register.handlers"

export const registerRoutes = factory
	.createApp()
	.post("/register/email", ...registerEmailHandlers)
