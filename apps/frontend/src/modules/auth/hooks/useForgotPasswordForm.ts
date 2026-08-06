import { forgotPasswordSchema } from "@repo/frontend/modules/auth/schemas/forgot-password.schema"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { authApi } from "../lib/api"

export function useForgotPasswordForm() {
	const router = useRouter()
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
						await router.navigate({
							to: "/auth/success",
							search: { type: "email-sent" },
						})
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
