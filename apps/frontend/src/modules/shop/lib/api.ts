import { SHOP_API_URL } from "@repo/frontend/lib/config"
import { fetcher } from "@repo/frontend/utils/fetcher"
import type { AppWithErrors } from "@repo/shop/index"
import { hc } from "hono/client"

export const shopApi = hc<AppWithErrors>(SHOP_API_URL, {
	init: { credentials: "include" },
	fetch: fetcher as typeof fetch,
})
