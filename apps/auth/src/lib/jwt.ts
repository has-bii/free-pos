import jwt from "@tsndr/cloudflare-worker-jwt"

const ACCESS_TOKEN_TTL_SECONDS = 900
const REFRESH_TOKEN_TTL_SECONDS = 2_592_000

export type JwtPayload = { sub: string } & Record<string, unknown>

type TokenType = "access" | "refresh"

const signToken = async (
	payload: JwtPayload,
	secret: string,
	type: TokenType,
	ttlSeconds: number,
): Promise<string> => {
	return jwt.sign(
		{ ...payload, type, exp: Math.floor(Date.now() / 1000) + ttlSeconds },
		secret,
		"HS256",
	)
}

const verifyToken = async (
	token: string,
	secret: string,
	type: TokenType,
): Promise<JwtPayload | null> => {
	try {
		const verified = await jwt.verify<{ type: TokenType }>(
			token,
			secret,
			"HS256",
		)
		if (!verified?.payload || verified.payload.type !== type) return null
		return verified.payload as JwtPayload
	} catch {
		return null
	}
}

export const signAccessToken = (
	payload: JwtPayload,
	secret: string,
): Promise<string> => {
	return signToken(payload, secret, "access", ACCESS_TOKEN_TTL_SECONDS)
}

export const signRefreshToken = (
	payload: JwtPayload,
	secret: string,
): Promise<string> => {
	return signToken(payload, secret, "refresh", REFRESH_TOKEN_TTL_SECONDS)
}

export const verifyAccessToken = (
	token: string,
	secret: string,
): Promise<JwtPayload | null> => {
	return verifyToken(token, secret, "access")
}

export const verifyRefreshToken = (
	token: string,
	secret: string,
): Promise<JwtPayload | null> => {
	return verifyToken(token, secret, "refresh")
}
