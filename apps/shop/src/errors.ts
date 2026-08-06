export class ShopAlreadyExistsError extends Error {
	constructor(userId: string) {
		super(`Shop already exists for user: ${userId}`)
		this.name = "ShopAlreadyExistsError"
	}
}

export class ShopSlugExistsError extends Error {
	constructor(slug: string) {
		super(`Shop slug already exists: ${slug}`)
		this.name = "ShopSlugExistsError"
	}
}

export class InvalidShopNameError extends Error {
	constructor() {
		super("Shop name must contain at least one letter or number.")
		this.name = "InvalidShopNameError"
	}
}

export class InvalidCursorError extends Error {
	constructor() {
		super("Invalid cursor.")
		this.name = "InvalidCursorError"
	}
}
