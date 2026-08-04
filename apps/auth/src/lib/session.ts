import { JWT } from "@repo/auth-kit/jwt"
import { uuidv7 } from "uuidv7"

type IssuedTokens = {
	accessToken: string
	refreshToken: string
	expiresIn: number
}

/**
 * The single place either token is signed. Login-issued and refresh-issued
 * tokens must carry identical claims forever; two call sites would let them
 * drift in a way nothing currently detects, since `sid` is write-only.
 */
const issueTokens = async (
	userId: string,
	sessionId: string,
	tokenValue: string,
	secret: string,
): Promise<IssuedTokens> => {
	const [accessToken, refreshToken] = await Promise.all([
		JWT.signAccessToken({ sub: userId, sid: sessionId }, secret),
		JWT.signRefreshToken({ sub: userId, sid: sessionId, jti: tokenValue }, secret),
	])
	return { accessToken, refreshToken, expiresIn: JWT.ACCESS_TOKEN_TTL_SECONDS }
}

const createSession = async (
	userId: string,
	secret: string,
	meta: { ipAddress: string | null; userAgent: string | null },
) => {
	// Deliberately two distinct ids: `id` is the stable session identity,
	// `token` is the rotating credential. They are never equal.
	const sessionId = uuidv7()
	const tokenValue = uuidv7()

	const tokens = await issueTokens(userId, sessionId, tokenValue, secret)

	return {
		session: {
			id: sessionId,
			userId,
			token: tokenValue,
			expiresAt: new Date(Date.now() + JWT.REFRESH_TOKEN_TTL_SECONDS * 1000),
			ipAddress: meta.ipAddress,
			userAgent: meta.userAgent,
		},
		...tokens,
	}
}

const rotateSession = async (
	userId: string,
	sessionId: string,
	secret: string,
): Promise<{ token: string; expiresAt: Date } & IssuedTokens> => {
	const tokenValue = uuidv7()
	const tokens = await issueTokens(userId, sessionId, tokenValue, secret)

	return {
		token: tokenValue,
		// Sliding expiry: every redemption extends the session.
		expiresAt: new Date(Date.now() + JWT.REFRESH_TOKEN_TTL_SECONDS * 1000),
		...tokens,
	}
}

export const Session = {
	createSession,
	rotateSession,
}
