import { loginSchema } from "@repo/frontend/modules/auth/schemas/login.schema"
import { useForm } from "@tanstack/react-form"
import { authApi } from "../lib/api"

export function useLoginForm() {
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
						const data = await res.json()
						console.log(data.message)
						return
					}

					const data = await res.json()

					console.log(data)

					if ("error" in data) return { fields: data.error }

					return { form: data.message }
				} catch {
					return { form: "Unexpected error has occurred" }
				}
			},
		},
	})
}
