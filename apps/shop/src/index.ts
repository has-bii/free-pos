import type { AppEnv } from "@repo/shop/factory"
import { factory } from "@repo/shop/factory"
import { dbMiddleware } from "@repo/shop/middleware/db"
import { shopRoutes } from "@repo/shop/modules/shop/shop.routes"
import { sql } from "drizzle-orm"
import type { Context } from "hono"
import type { ApplyGlobalResponse } from "hono/client"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"

const app = factory
	.createApp()
	.use(
		cors({
			origin: (origin, c: Context<AppEnv>) => (origin === c.env.FREE_POS_FRONTEND_ORIGIN ? origin : undefined),
			credentials: true,
		}),
	)
	.use(dbMiddleware)
	.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ message: err.message || "Request failed." }, err.status)
		}
		console.error(err)
		return c.json({ message: "Internal server error." }, 500)
	})
	.get("/health", async (c) => {
		try {
			await c.var.db.execute(sql`select 1`)
			return c.json({ status: "ok" })
		} catch {
			return c.json({ status: "error" }, 503)
		}
	})
	.route("/", shopRoutes)

export default app
export type AppWithErrors = ApplyGlobalResponse<
	typeof app,
	{
		400: { json: { message: string; error: Record<string, unknown> } }
	}
>
