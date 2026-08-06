import { GET_ME_QUERY_KEY } from "@repo/frontend/modules/auth/queries/get-me.query"
import { loginSchema } from "@repo/frontend/modules/auth/schemas/login.schema"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { authApi } from "../lib/api"

export function useLoginForm(redirect = "/") {
	const queryClient = useQueryClient()
	const router = useRouter()

	return useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onChange: loginSchema,
			onSubmitAsync: async ({ value, formApi }) => {
				try {
					const res = await authApi.login.email.$post({ json: value })
					formApi.reset()

					if (res.ok) {
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
