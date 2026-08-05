import ForgotPasswordForm from "@repo/frontend/modules/auth/components/ForgotPasswordForm"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth/forgot-password")({
	component: ForgotPasswordForm,
})
