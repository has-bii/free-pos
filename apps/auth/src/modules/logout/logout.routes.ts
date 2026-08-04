import { factory } from "@repo/auth/factory"
import { logoutHandlers } from "./logout.handlers"

export const logoutRoutes = factory.createApp().post("/logout", ...logoutHandlers)
