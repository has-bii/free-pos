import type { Context } from "hono"

export const requestMeta = (c: Context) => ({
	ipAddress: c.req.header("CF-Connecting-IP") ?? null,
	userAgent: c.req.header("User-Agent") ?? null,
})
