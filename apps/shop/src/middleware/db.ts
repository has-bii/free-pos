import { createDatabaseClient } from "@repo/database"
import { factory } from "@repo/shop/factory"

export const dbMiddleware = factory.createMiddleware(async (c, next) => {
	c.set("db", createDatabaseClient(c.env.FREE_POS_DATABASE_URL))
	await next()
})
