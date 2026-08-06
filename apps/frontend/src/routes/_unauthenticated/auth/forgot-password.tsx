import ForgotPasswordForm from "@repo/frontend/modules/auth/components/ForgotPasswordForm"
import { authRedirectSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/_unauthenticated/auth/forgot-password")({
	validateSearch: v.parser(authRedirectSearchSchema),
	component: ForgotPasswordForm,
})
