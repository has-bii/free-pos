export function toAuthResponse(
	user: { id: string; name: string; email: string; createdAt: Date },
	tokens: { accessToken: string; refreshToken: string },
) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		createdAt: user.createdAt.toISOString(),
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
	}
}
