import { factory } from "@repo/shop/factory"
import {
	createCategoryHandlers,
	deleteCategoryHandlers,
	getCategoryHandlers,
	listCategoryHandlers,
	updateCategoryHandlers,
} from "@repo/shop/modules/category/category.handlers"

export const categoryRoutes = factory
	.createApp()
	.post("/shops/me/categories", ...createCategoryHandlers)
	.get("/shops/me/categories", ...listCategoryHandlers)
	.get("/shops/me/categories/:id", ...getCategoryHandlers)
	.put("/shops/me/categories/:id", ...updateCategoryHandlers)
	.delete("/shops/me/categories/:id", ...deleteCategoryHandlers)
