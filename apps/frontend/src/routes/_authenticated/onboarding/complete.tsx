import OnboardingComplete from "@repo/frontend/modules/shop/components/OnboardingComplete"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/onboarding/complete")({
	component: OnboardingComplete,
})
