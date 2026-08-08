import { factory } from "@repo/shop/factory"
import {
	createProductHandlers,
	deleteProductHandlers,
	getProductHandlers,
	listProductHandlers,
	updateProductHandlers,
} from "@repo/shop/modules/product/product.handlers"

export const productRoutes = factory
	.createApp()
	.post("/shops/me/products", ...createProductHandlers)
	.get("/shops/me/products", ...listProductHandlers)
	.get("/shops/me/products/:id", ...getProductHandlers)
	.put("/shops/me/products/:id", ...updateProductHandlers)
	.delete("/shops/me/products/:id", ...deleteProductHandlers)
