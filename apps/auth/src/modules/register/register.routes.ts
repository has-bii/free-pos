import { factory } from "../../factory"
import { registerEmailHandlers } from "./register.handlers"

export const registerRoutes = factory
	.createApp()
	.post("/register/email", ...registerEmailHandlers)
