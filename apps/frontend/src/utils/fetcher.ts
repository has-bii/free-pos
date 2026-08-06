import type { AppWithErrors } from "@repo/auth/index"
import { AUTH_API_URL } from "@repo/frontend/lib/config"
import { hc } from "hono/client"

const refreshExcludedPaths = new Set([
	"/login/email",
	"/login/google",
	"/login/google/callback",
	"/register/email",
	"/recovery/forgot-password",
	"/recovery/reset-password",
	"/refresh",
])

/** A typed client that deliberately uses the browser's native fetch. */
export const bareApiClient = hc<AppWithErrors>(AUTH_API_URL, {
	init: { credentials: "include" },
})

let refreshPromise: Promise<boolean> | null = null

const refreshSession = (): Promise<boolean> => {
	if (!refreshPromise) {
		refreshPromise = (async () => {
			try {
				const response = await bareApiClient.refresh.$post()
				return response.ok
			} catch {
				return false
			} finally {
				refreshPromise = null
			}
		})()
	}

	return refreshPromise
}

const requestUrl = (input: RequestInfo | URL): URL => {
	if (input instanceof Request) return new URL(input.url)
	if (input instanceof URL) return input
	return new URL(input, AUTH_API_URL)
}

/**
 * Retry one eligible 401 response after a shared refresh operation. The
 * original response is returned when refresh fails so callers retain their
 * normal error handling.
 */
export const fetcher: typeof fetch = async (input, init) => {
	const request = new Request(input, init)
	const url = requestUrl(request)

	if (refreshExcludedPaths.has(url.pathname)) return fetch(request)

	const retryRequest = request.clone()
	const response = await fetch(request)
	if (response.status !== 401) return response

	if (!(await refreshSession())) return response
	return fetch(retryRequest as unknown as RequestInfo)
}
