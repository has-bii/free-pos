import { forgotPasswordSchema } from "@repo/frontend/modules/auth/schemas/forgot-password.schema"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { authApi } from "../lib/api"

export function useForgotPasswordForm() {
	const [submitted, setSubmitted] = useState(false)

	const form = useForm({
		defaultValues: {
			email: "",
		},
		validators: {
			onChange: forgotPasswordSchema,
			onSubmitAsync: async ({ value }) => {
				try {
					const res = await authApi.recovery["forgot-password"].$post({ json: value })

					// The server returns 200 for every well-formed request
					// (anti-enumeration), so success here always means "the
					// confirmation state".
					if (res.ok) {
						setSubmitted(true)
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

	return { form, submitted }
}
