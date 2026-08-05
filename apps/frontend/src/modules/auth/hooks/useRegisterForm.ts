import { registerSchema } from "@repo/frontend/modules/auth/schemas/register.schema"
import { useForm } from "@tanstack/react-form"
import { authApi } from "../lib/api"

export function useRegisterForm() {
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
					formApi.reset()

					if (res.ok) {
						const data = await res.json()
						console.log(data.message)
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
