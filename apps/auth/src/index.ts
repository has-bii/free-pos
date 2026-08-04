import type { AppEnv } from "@repo/auth/factory"
import { factory } from "@repo/auth/factory"
import { dbMiddleware } from "@repo/auth/middleware/db"
import { loginRoutes } from "@repo/auth/modules/login/login.routes"
import { logoutRoutes } from "@repo/auth/modules/logout/logout.routes"
import { meRoutes } from "@repo/auth/modules/me/me.routes"
import { refreshRoutes } from "@repo/auth/modules/refresh/refresh.routes"
import { registerRoutes } from "@repo/auth/modules/register/register.routes"
import { sql } from "drizzle-orm"
import type { Context } from "hono"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"

const app = factory
	.createApp()
	.use(
		cors({
			// A function rather than the literal string: `credentials: true`
			// forbids a wildcard origin, and the allowed origin is per-request env,
			// not known when this middleware is constructed.
			origin: (origin, c: Context<AppEnv>) => (origin === c.env.SERO_POS_FRONTEND_ORIGIN ? origin : undefined),
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
	.route("/auth", registerRoutes)
	.route("/auth", loginRoutes)
	.route("/auth", refreshRoutes)
	.route("/auth", meRoutes)
	.route("/auth", logoutRoutes)

export default app
