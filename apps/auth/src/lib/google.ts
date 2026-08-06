export const GOOGLE_ERROR_CODES = {
	cancelled: "google_cancelled",
	invalidCallback: "google_invalid_callback",
	failed: "google_failed",
	accountConflict: "google_account_conflict",
	accountUnverified: "google_account_unverified",
	linkRequired: "google_link_required",
} as const

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

export class GoogleProviderError extends Error {
	constructor() {
		super("Google provider request failed")
		this.name = "GoogleProviderError"
	}
}

export type GoogleUserInfo = {
	sub?: unknown
	email?: unknown
	email_verified?: unknown
	name?: unknown
	picture?: unknown
}

type GoogleTokenResponse = {
	access_token?: unknown
}

const parseJson = async (response: Response): Promise<unknown> => {
	try {
		return await response.json()
	} catch {
		throw new GoogleProviderError()
	}
}

const assertResponse = async (response: Response): Promise<unknown> => {
	if (!response.ok) throw new GoogleProviderError()
	return parseJson(response)
}

export type GoogleProvider = {
	exchangeCode: (params: {
		code: string
		verifier: string
		clientId: string
		clientSecret: string
		redirectUri: string
	}) => Promise<string>
	getUserInfo: (accessToken: string) => Promise<GoogleUserInfo>
}

/**
 * The only module that talks to Google. Keeping this boundary small makes the
 * login service deterministic: callers can replace these two methods rather
 * than ever calling Google's network from a Worker test.
 */
export const googleProvider: GoogleProvider = {
	exchangeCode: async ({ code, verifier, clientId, clientSecret, redirectUri }) => {
		const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: redirectUri,
				grant_type: "authorization_code",
				code_verifier: verifier,
			}).toString(),
		})

		const body = (await assertResponse(response)) as GoogleTokenResponse
		if (typeof body.access_token !== "string" || body.access_token.length === 0) {
			throw new GoogleProviderError()
		}
		return body.access_token
	},

	getUserInfo: async (accessToken) => {
		const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		return (await assertResponse(response)) as GoogleUserInfo
	},
}
