import { factory } from "@repo/auth/factory"
import { refreshHandlers } from "./refresh.handlers"

export const refreshRoutes = factory
	.createApp()
	.post("/refresh", ...refreshHandlers)
