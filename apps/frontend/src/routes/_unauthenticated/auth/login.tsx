import LoginForm from "@repo/frontend/modules/auth/components/LoginForm"
import { loginSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_unauthenticated/auth/login")({
	validateSearch: loginSearchSchema,
	component: LoginForm,
})
