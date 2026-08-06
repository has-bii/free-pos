import RegisterForm from "@repo/frontend/modules/auth/components/RegisterForm"
import { authRedirectSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/_unauthenticated/auth/register")({
	validateSearch: v.parser(authRedirectSearchSchema),
	component: RegisterForm,
})
