import { uuidv7 } from "uuidv7"
import {
	ACCESS_TOKEN_TTL_SECONDS,
	signAccessToken,
	signRefreshToken,
} from "./jwt"

// Matches REFRESH_TOKEN_TTL_SECONDS in jwt.ts — the two must stay equal.
const SESSION_TTL_SECONDS = 2_592_000

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
		signAccessToken({ sub: userId, sid: sessionId }, secret),
		signRefreshToken({ sub: userId, sid: sessionId, jti: tokenValue }, secret),
	])
	return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS }
}

export const createSession = async (
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
			expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
			ipAddress: meta.ipAddress,
			userAgent: meta.userAgent,
		},
		...tokens,
	}
}

export const rotateSession = async (
	userId: string,
	sessionId: string,
	secret: string,
): Promise<{ token: string; expiresAt: Date } & IssuedTokens> => {
	const tokenValue = uuidv7()
	const tokens = await issueTokens(userId, sessionId, tokenValue, secret)

	return {
		token: tokenValue,
		// Sliding expiry (decision 7): every redemption extends the session.
		expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
		...tokens,
	}
}
