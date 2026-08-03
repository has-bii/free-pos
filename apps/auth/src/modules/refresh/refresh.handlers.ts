import { factory } from "@repo/auth/factory"
import { verifyRefreshToken } from "@repo/auth/lib/jwt"
import { rotateSession } from "@repo/auth/lib/session"
import { validate } from "@repo/auth/middleware/validate"
import { SessionRepository } from "@repo/auth/repositories/session.repository"
import { refreshSchema } from "./refresh.schema"

export const refreshHandlers = factory.createHandlers(
	validate("json", refreshSchema),
	async (c) => {
		const { refreshToken } = c.req.valid("json")
		const db = c.var.db

		// One message for every cause (decision 8): the client's action is
		// always the same, and distinguishing them would leak whether a
		// session exists.
		const invalidToken = () =>
			c.json({ message: "Invalid or expired refresh token." }, 401)

		const payload = await verifyRefreshToken(
			refreshToken,
			c.env.SERO_POS_JWT_SECRET,
		)
		if (!payload) return invalidToken()

		// `jti` and `sid` are `unknown` on JwtPayload's index signature. A
		// token lacking either predates this feature or was hand-crafted.
		const { jti, sid } = payload
		if (typeof jti !== "string" || typeof sid !== "string") {
			return invalidToken()
		}

		const rotated = await rotateSession(
			payload.sub,
			sid,
			c.env.SERO_POS_JWT_SECRET,
		)

		// The `userId` predicate is the `sub === session.user_id` invariant
		// (decision 8) folded into the CAS, so it costs no extra query.
		const swapped = await SessionRepository.rotateToken(db, {
			currentToken: jti,
			userId: payload.sub,
			nextToken: rotated.token,
			expiresAt: rotated.expiresAt,
		})
		if (!swapped) return invalidToken()

		return c.json({
			message: "ok",
			data: {
				token: {
					accessToken: rotated.accessToken,
					refreshToken: rotated.refreshToken,
					expiresIn: rotated.expiresIn,
				},
			},
		})
	},
)
