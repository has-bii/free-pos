import { InvalidCursorError } from "@repo/shop/errors"

export const encodeCursor = (id: string): string => {
	return btoa(id).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export const decodeCursor = (cursor: string): string => {
	try {
		const padded = cursor.replace(/-/g, "+").replace(/_/g, "/")
		const decoded = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))
		if (!/^[0-9a-f-]{36}$/.test(decoded)) throw new InvalidCursorError()
		return decoded
	} catch {
		throw new InvalidCursorError()
	}
}
