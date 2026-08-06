import GoogleOAuthError from "@repo/frontend/modules/auth/components/GoogleOAuthError"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/_unauthenticated/auth/error")({
	validateSearch: v.parser(v.object({ code: v.optional(v.string()) })),
	component: GoogleOAuthError,
})
