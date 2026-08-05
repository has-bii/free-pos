import LoginForm from "@repo/frontend/modules/auth/components/LoginForm"
import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

export const Route = createFileRoute("/auth/login")({
	// Typed so the post-reset redirect (?reset=success) drives a success alert
	// on the login card without the search params being an `any` escape hatch.
	validateSearch: v.parser(v.object({ reset: v.optional(v.literal("success")) })),
	component: LoginForm,
})
