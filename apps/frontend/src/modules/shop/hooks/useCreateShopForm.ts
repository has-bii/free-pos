import { cacheCreatedShop, refetchMyShop } from "@repo/frontend/modules/shop/queries/get-my-shop.query"
import { shopSchema } from "@repo/frontend/modules/shop/schemas/shop.schema"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { shopApi } from "../lib/api"

const retryableFormError = "We couldn't create your shop right now. Check your connection and try again."

export function useCreateShopForm() {
	const queryClient = useQueryClient()
	const router = useRouter()

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

					if (response.ok) {
						const data = await response.json()
						const createdShop = data.data
						if (!createdShop) return { form: retryableFormError }
						cacheCreatedShop(queryClient, createdShop)
						formApi.reset()
						await router.navigate({ to: "/onboarding/complete", replace: true })
						return
					}

					const data = await response.json()

					const status = response.status as number

					if (status === 409 && data.message.toLowerCase().includes("already have a shop")) {
						try {
							const existingShop = await refetchMyShop(queryClient)
							if (existingShop) {
								cacheCreatedShop(queryClient, existingShop)
								formApi.reset()
								await router.navigate({ to: "/onboarding/complete", replace: true })
								return
							}
						} catch {
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
				} catch {
					return { form: retryableFormError }
				}
			},
		},
	})
}
