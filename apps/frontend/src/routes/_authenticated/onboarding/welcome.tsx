import Welcome from "@repo/frontend/modules/shop/components/Welcome"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/onboarding/welcome")({
	component: Welcome,
})
