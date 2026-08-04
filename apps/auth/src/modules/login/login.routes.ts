import { factory } from "@repo/auth/factory"
import { loginEmailHandlers } from "./login.handlers"

export const loginRoutes = factory.createApp().post("/login/email", ...loginEmailHandlers)
