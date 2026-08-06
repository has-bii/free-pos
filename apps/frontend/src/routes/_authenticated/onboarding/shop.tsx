import ShopOnboardingForm from "@repo/frontend/modules/shop/components/ShopOnboardingForm"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/onboarding/shop")({
	component: ShopOnboardingForm,
})
