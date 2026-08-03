import { factory } from "@repo/auth/factory"
import { dbMiddleware } from "@repo/auth/middleware/db"
import { loginRoutes } from "@repo/auth/modules/login/login.routes"
import { meRoutes } from "@repo/auth/modules/me/me.routes"
import { registerRoutes } from "@repo/auth/modules/register/register.routes"
import { sql } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"

const app = factory
	.createApp()
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
	.route("/auth", meRoutes)

export default app
