import LoginForm from "@repo/frontend/modules/auth/components/LoginForm"
import { loginSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/_unauthenticated/auth/login")({
	// The reset flag drives the success alert, while redirect is normalized to a
	// safe internal location before it reaches the form.
	validateSearch: v.parser(loginSearchSchema),
	component: LoginForm,
})
