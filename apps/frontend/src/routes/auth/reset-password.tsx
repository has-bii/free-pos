import ResetPasswordForm from "@repo/frontend/modules/auth/components/ResetPasswordForm"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/auth/reset-password")({
	// The raw token from the emailed link arrives as a query param; typed so
	// ResetPasswordForm can read it (and detect its absence) via useSearch.
	validateSearch: v.parser(v.object({ token: v.optional(v.string()) })),
	component: ResetPasswordForm,
})
