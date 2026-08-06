import ResetPasswordForm from "@repo/frontend/modules/auth/components/ResetPasswordForm"
import { resetPasswordSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_unauthenticated/auth/reset-password")({
	validateSearch: resetPasswordSearchSchema,
	component: ResetPasswordForm,
})
