import { factory } from "@repo/shop/factory"
import { categoryRoutes } from "@repo/shop/modules/category/category.routes"
import { productRoutes } from "@repo/shop/modules/product/product.routes"
import {
	createShopHandlers,
	deleteShopHandlers,
	getMyShopHandlers,
	getShopBySlugHandlers,
	listShopHandlers,
	updateShopHandlers,
} from "@repo/shop/modules/shop/shop.handlers"

export const shopRoutes = factory
	.createApp()
	.get("/shops", ...listShopHandlers)
	.get("/shops/me", ...getMyShopHandlers)
	.get("/shops/:slug", ...getShopBySlugHandlers)
	.post("/shops", ...createShopHandlers)
	.put("/shops/me", ...updateShopHandlers)
	.delete("/shops/me", ...deleteShopHandlers)
	.route("/", categoryRoutes)
	.route("/", productRoutes)
