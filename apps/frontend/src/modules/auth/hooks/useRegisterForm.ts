import { GET_ME_QUERY_KEY } from "@repo/frontend/modules/auth/queries/get-me.query"
import { registerSchema } from "@repo/frontend/modules/auth/schemas/register.schema"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { authApi } from "../lib/api"

export function useRegisterForm(redirect = "/") {
	const queryClient = useQueryClient()
	const router = useRouter()

	return useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		validators: {
			onChange: registerSchema,
			onSubmitAsync: async ({ value, formApi }) => {
				try {
					const { name, email, password } = value
					const res = await authApi.register.email.$post({ json: { name, email, password } })

					if (res.ok) {
						await res.json()
						formApi.reset()
						await queryClient.refetchQueries({ queryKey: GET_ME_QUERY_KEY })
						await router.navigate({ to: redirect })
						return
					}

					const data = await res.json()

					if ("error" in data) return { fields: data.error }

					return { form: data.message }
				} catch {
					return { form: "Unexpected error has occurred" }
				}
			},
		},
	})
}
