import { factory } from "../../factory"
import { loginEmailHandlers } from "./login.handlers"

export const loginRoutes = factory
	.createApp()
	.post("/login/email", ...loginEmailHandlers)
