import { createDatabaseClient } from "@repo/database"
import { factory } from "../factory"

export const dbMiddleware = factory.createMiddleware(async (c, next) => {
	c.set("db", createDatabaseClient(c.env.SERO_POS_DATABASE_URL))
	await next()
})
