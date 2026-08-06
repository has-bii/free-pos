/**
 * Return a normalized path that can only point back into this frontend.
 *
 * This value is used in query parameters and OAuth return locations, so it
 * must never be allowed to become an absolute or protocol-relative URL.
 */
export const safeReturnLocation = (value: string | null | undefined): string => {
	if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/"

	if (
		[...value].some((character) => {
			const code = character.charCodeAt(0)
			return code <= 31 || code === 127
		})
	)
		return "/"

	try {
		const rawPath = value.split(/[?#]/)[0] ?? "/"
		const decodedRawPath = decodeURIComponent(rawPath)
		if (decodedRawPath.includes("\\") || decodedRawPath.split("/").some((segment) => segment === "..")) return "/"

		const parsed = new URL(value, "https://free-pos.invalid")
		return `${parsed.pathname}${parsed.search}${parsed.hash}`
	} catch {
		return "/"
	}
}
