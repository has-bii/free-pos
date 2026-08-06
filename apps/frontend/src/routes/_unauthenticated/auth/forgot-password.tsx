import ForgotPasswordForm from "@repo/frontend/modules/auth/components/ForgotPasswordForm"
import { authRedirectSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_unauthenticated/auth/forgot-password")({
	validateSearch: authRedirectSearchSchema,
	component: ForgotPasswordForm,
})
