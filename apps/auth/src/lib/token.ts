const toBase64Url = (bytes: Uint8Array): string => {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "")
}

const toHex = (bytes: Uint8Array): string => {
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Opaque 32-byte random token, base64url without padding. The raw value
 * lives only in the email link; only its SHA-256 hash is ever stored.
 */
const generate = (): string => {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

const hash = async (rawToken: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken))
	return toHex(new Uint8Array(digest))
}

export const ResetToken = {
	generate,
	hash,
}
