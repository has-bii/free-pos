import { resetPasswordSchema } from "@repo/frontend/modules/auth/schemas/reset-password.schema"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { authApi } from "../lib/api"

const INVALID_TOKEN_MESSAGE = "Invalid or expired reset token."

export function useResetPasswordForm(token: string, redirect = "/") {
	const router = useRouter()
	const [tokenInvalid, setTokenInvalid] = useState(false)

	const form = useForm({
		defaultValues: {
			token,
			password: "",
			confirmPassword: "",
		},
		validators: {
			onChange: resetPasswordSchema,
			onSubmitAsync: async ({ value }) => {
				try {
					// `confirmPassword` is client-only — the wire payload stays
					// honest to the backend contract (same as register).
					const { token, password } = value
					const res = await authApi.recovery["reset-password"].$post({ json: { token, password } })

					if (res.ok) {
						router.navigate({
							to: "/auth/login",
							search: { reset: "success", redirect },
						})
						return
					}

					const data = await res.json()

					if ("error" in data) return { fields: data.error }

					// The link is dead either way — swap to the "invalid link"
					// state rather than leaving a form that can never succeed.
					if (data.message === INVALID_TOKEN_MESSAGE) {
						setTokenInvalid(true)
						return
					}

					return { form: data.message }
				} catch {
					return { form: "Unexpected error has occurred" }
				}
			},
		},
	})

	return { form, tokenInvalid }
}
