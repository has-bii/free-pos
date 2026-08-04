import { factory } from "@repo/auth/factory"
import { JWT } from "@repo/auth/lib/jwt"

export const requireAuth = factory.createMiddleware(async (c, next) => {
	const unauthorized = () => c.json({ message: "Unauthorized." }, 401)

	const header = c.req.header("Authorization")
	const [scheme, token, ...rest] = header?.split(" ") ?? []
	if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
		return unauthorized()
	}

	const payload = await JWT.verifyAccessToken(token, c.env.SERO_POS_JWT_SECRET)
	if (!payload) return unauthorized()

	c.set("userId", payload.sub)
	c.set("sessionId", payload.sid)
	await next()
})
