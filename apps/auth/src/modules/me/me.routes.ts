import { factory } from "@repo/auth/factory"
import { meHandlers } from "./me.handlers"

export const meRoutes = factory.createApp().get("/me", ...meHandlers)
