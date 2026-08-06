import type { AppWithErrors } from "@repo/auth/index"
import { AUTH_API_URL } from "@repo/frontend/lib/config"
import { fetcher } from "@repo/frontend/utils/fetcher"
import { hc } from "hono/client"

export const authApi = hc<AppWithErrors>(AUTH_API_URL, {
	init: { credentials: "include" },
	fetch: fetcher as typeof fetch,
})
