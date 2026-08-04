import type { AppWithErrors } from "@repo/auth/index"
import { hc } from "hono/client"

const baseUrl = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:8787"

export const authApi = hc<AppWithErrors>(baseUrl, {
	init: { credentials: "include" },
})
