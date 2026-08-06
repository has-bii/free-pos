import { useAuth } from "@repo/frontend/modules/auth/context/AuthContext"
import {
	cacheCreatedShop,
	isShopUnauthorizedError,
	refetchMyShop,
	type Shop,
} from "@repo/frontend/modules/shop/queries/get-my-shop.query"
import { shopSchema } from "@repo/frontend/modules/shop/schemas/shop.schema"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { shopApi } from "../lib/api"

const navigateToLogin = async (logout: () => Promise<void>, router: ReturnType<typeof useRouter>) => {
	try {
		await logout()
	} catch {
		// The login redirect is still the correct outcome if logout cannot reach the API.
	} finally {
		await router.navigate({ to: "/auth/login", replace: true })
	}
}

const retryableFormError = "We couldn't create your shop right now. Check your connection and try again."

export function useCreateShopForm() {
	const queryClient = useQueryClient()
	const router = useRouter()
	const { logout } = useAuth()

	return useForm({
		defaultValues: {
			name: "",
			description: "",
			address: "",
		},
		validators: {
			onChange: shopSchema,
			onSubmitAsync: async ({ value, formApi }) => {
				const payload = {
					name: value.name.trim(),
					description: value.description.trim() || null,
					address: value.address.trim() || null,
				}

				try {
					const response = await shopApi.shops.$post({ json: payload })
					const data = await response.json()

					if (response.ok && "data" in data) {
						const createdShop = (data as { data: { shop: Shop } }).data.shop
						cacheCreatedShop(queryClient, createdShop)
						formApi.reset()
						await router.navigate({ to: "/onboarding/complete", replace: true })
						return
					}

					const status = response.status as number

					if (status === 401) {
						await navigateToLogin(logout, router)
						return
					}

					if (status === 409 && data.message.toLowerCase().includes("already have a shop")) {
						try {
							const existingShop = await refetchMyShop(queryClient)
							if (existingShop) {
								cacheCreatedShop(queryClient, existingShop)
								formApi.reset()
								await router.navigate({ to: "/onboarding/complete", replace: true })
								return
							}
						} catch (error) {
							if (isShopUnauthorizedError(error)) {
								await navigateToLogin(logout, router)
								return
							}

							return { form: retryableFormError }
						}

						return { form: "A shop already exists for your account. Please try again." }
					}

					if (status === 409 && data.message.toLowerCase().includes("slug")) {
						return { fields: { name: { message: "That shop name is already in use. Choose another name." } } }
					}

					if (status === 422) {
						return { fields: { name: { message: data.message } } }
					}

					if (status >= 500) return { form: retryableFormError }

					if ("error" in data) return { fields: data.error }

					return { form: data.message }
				} catch (error) {
					if (isShopUnauthorizedError(error)) {
						await navigateToLogin(logout, router)
						return
					}

					return { form: retryableFormError }
				}
			},
		},
	})
}
