import RegisterForm from "@repo/frontend/modules/auth/components/RegisterForm"
import { authRedirectSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_unauthenticated/auth/register")({
	validateSearch: authRedirectSearchSchema,
	component: RegisterForm,
})
