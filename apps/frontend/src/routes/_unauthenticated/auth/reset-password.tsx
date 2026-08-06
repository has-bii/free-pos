import ResetPasswordForm from "@repo/frontend/modules/auth/components/ResetPasswordForm"
import { resetPasswordSearchSchema } from "@repo/frontend/modules/auth/schemas/route-search.schema"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/_unauthenticated/auth/reset-password")({
	// The raw token comes from the email link; redirect is normalized before it
	// is carried back to login after a successful password reset.
	validateSearch: v.parser(resetPasswordSearchSchema),
	component: ResetPasswordForm,
})
