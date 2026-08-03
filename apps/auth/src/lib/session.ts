import { uuidv7 } from "uuidv7"
import { signAccessToken, signRefreshToken } from "./jwt"

// Matches REFRESH_TOKEN_TTL_SECONDS in jwt.ts — the two must stay equal.
const SESSION_TTL_SECONDS = 2_592_000

export const createSession = async (
	userId: string,
	secret: string,
	meta: { ipAddress: string | null; userAgent: string | null },
): Promise<{
	session: {
		id: string
		userId: string
		expiresAt: Date
		ipAddress: string | null
		userAgent: string | null
	}
	accessToken: string
	refreshToken: string
}> => {
	const sessionId = uuidv7()

	const [accessToken, refreshToken] = await Promise.all([
		signAccessToken({ sub: userId }, secret),
		signRefreshToken({ sub: userId, jti: sessionId }, secret),
	])

	return {
		session: {
			id: sessionId,
			userId,
			expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
			ipAddress: meta.ipAddress,
			userAgent: meta.userAgent,
		},
		accessToken,
		refreshToken,
	}
}
