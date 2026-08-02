import { createDatabaseClient } from "@repo/database"
import { sql } from "drizzle-orm"
import { Hono } from "hono"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get("/health", async (c) => {
	try {
		const db = createDatabaseClient(c.env.DATABASE_URL)
		await db.execute(sql`select 1`)
		return c.json({ status: "ok" })
	} catch {
		return c.json({ status: "error" }, 503)
	}
})

export default app
