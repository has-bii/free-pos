import { InvalidProductNameError, InvalidShopNameError } from "@repo/shop/errors"

const MAX_SLUG_LENGTH = 64

export const deriveSlug = (name: string): string => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")

	if (slug.length === 0) throw new InvalidShopNameError()
	if (slug.length <= MAX_SLUG_LENGTH) return slug

	const boundary = slug.lastIndexOf("-", MAX_SLUG_LENGTH)
	if (boundary <= 0) throw new InvalidShopNameError()

	return slug.slice(0, boundary)
}

export const deriveProductSlug = (name: string): string => {
	try {
		return deriveSlug(name)
	} catch (err) {
		if (err instanceof InvalidShopNameError) throw new InvalidProductNameError()
		throw err
	}
}
