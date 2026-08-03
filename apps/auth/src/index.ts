import { factory } from "@repo/auth/factory"
import { dbMiddleware } from "@repo/auth/middleware/db"
import { loginRoutes } from "@repo/auth/modules/login/login.routes"
import { registerRoutes } from "@repo/auth/modules/register/register.routes"
import { sql } from "drizzle-orm"

const app = factory
	.createApp()
	.use(dbMiddleware)
	.onError((err, c) => {
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

export default app
