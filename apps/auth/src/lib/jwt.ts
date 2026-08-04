import jwt from "@tsndr/cloudflare-worker-jwt"

const ACCESS_TOKEN_TTL_SECONDS = 900
const REFRESH_TOKEN_TTL_SECONDS = 2_592_000

export type AccessTokenPayload = { sub: string; sid: string }
export type RefreshTokenPayload = { sub: string; sid: string; jti: string }

type TokenType = "access" | "refresh"

const signToken = async <T extends object>(
	payload: T,
	secret: string,
	type: TokenType,
	ttlSeconds: number,
): Promise<string> => {
	return jwt.sign({ ...payload, type, exp: Math.floor(Date.now() / 1000) + ttlSeconds }, secret, "HS256")
}

const isAccessTokenPayload = (payload: unknown): payload is AccessTokenPayload => {
	const p = payload as Record<string, unknown>
	return typeof p?.sub === "string" && typeof p?.sid === "string"
}

const isRefreshTokenPayload = (payload: unknown): payload is RefreshTokenPayload => {
	const p = payload as Record<string, unknown>
	return typeof p?.sub === "string" && typeof p?.sid === "string" && typeof p?.jti === "string"
}

// A token predating a payload field, or a hand-crafted one, verifies fine
// (the signature is still valid) but fails `isValid` here rather than
// handing callers an `unknown`-shaped payload cast to `T`.
const verifyToken = async <T>(
	token: string,
	secret: string,
	type: TokenType,
	isValid: (payload: unknown) => payload is T,
): Promise<T | null> => {
	try {
		const verified = await jwt.verify<{ type: TokenType }>(token, secret, "HS256")
		if (!verified?.payload || verified.payload.type !== type) return null
		return isValid(verified.payload) ? verified.payload : null
	} catch {
		return null
	}
}

const signAccessToken = (payload: AccessTokenPayload, secret: string): Promise<string> => {
	return signToken(payload, secret, "access", ACCESS_TOKEN_TTL_SECONDS)
}

const signRefreshToken = (payload: RefreshTokenPayload, secret: string): Promise<string> => {
	return signToken(payload, secret, "refresh", REFRESH_TOKEN_TTL_SECONDS)
}

const verifyAccessToken = (token: string, secret: string): Promise<AccessTokenPayload | null> => {
	return verifyToken(token, secret, "access", isAccessTokenPayload)
}

const verifyRefreshToken = (token: string, secret: string): Promise<RefreshTokenPayload | null> => {
	return verifyToken(token, secret, "refresh", isRefreshTokenPayload)
}

export const JWT = {
	ACCESS_TOKEN_TTL_SECONDS,
	REFRESH_TOKEN_TTL_SECONDS,
	signAccessToken,
	signRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
}
