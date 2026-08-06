import { googleProvider } from "@repo/auth/lib/google"
import { TestClient } from "./http"

/**
 * Creates a user through the real Google callback flow, leaving the user with
 * an OAuth account but no credential account. The provider boundary is
 * replaced only for the duration of the fixture so no network request is made.
 */
export const registerGoogleUser = async (email: string) => {
	const originalExchangeCode = googleProvider.exchangeCode
	const originalGetUserInfo = googleProvider.getUserInfo

	googleProvider.exchangeCode = async () => "test-google-access-token"
	googleProvider.getUserInfo = async () => ({
		sub: `test-google-${crypto.randomUUID()}`,
		email,
		email_verified: true,
		name: "Google Test User",
	})

	try {
		const client = new TestClient()
		const initiation = await client.request("/login/google?returnTo=/", { redirect: "manual" })
		if (initiation.status !== 302) throw new Error(`Google initiation failed: ${initiation.status}`)

		const state = client.jar.get("free_pos_google_oauth_state")
		if (!state) throw new Error("Google initiation did not set an OAuth state")

		const callback = await client.request(`/login/google/callback?code=test-code&state=${encodeURIComponent(state)}`, {
			redirect: "manual",
		})
		if (callback.status !== 302) throw new Error(`Google callback failed: ${callback.status}`)

		return client
	} finally {
		googleProvider.exchangeCode = originalExchangeCode
		googleProvider.getUserInfo = originalGetUserInfo
	}
}
