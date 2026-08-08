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

export class ProductSlugExistsError extends Error {
	constructor(slug: string) {
		super(`Product slug already exists: ${slug}`)
		this.name = "ProductSlugExistsError"
	}
}

export class CategorySlugExistsError extends Error {
	constructor(slug: string) {
		super(`Category slug already exists: ${slug}`)
		this.name = "CategorySlugExistsError"
	}
}

export class InvalidCategoryNameError extends Error {
	constructor() {
		super("Category name must contain at least one letter or number.")
		this.name = "InvalidCategoryNameError"
	}
}

export class InvalidProductNameError extends Error {
	constructor() {
		super("Product name must contain at least one letter or number.")
		this.name = "InvalidProductNameError"
	}
}
