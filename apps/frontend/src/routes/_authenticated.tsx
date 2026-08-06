import RouteError from "@repo/frontend/components/RouteError"
import OnboardingPending from "@repo/frontend/modules/shop/components/OnboardingPending"
import {
	consumeOnboardingCompletion,
	getMyShopQueryOptions,
	type Shop,
} from "@repo/frontend/modules/shop/queries/get-my-shop.query"
import { safeReturnLocation } from "@repo/frontend/utils/safe-return-location"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

const isOnboardingPath = (pathname: string) => pathname === "/onboarding" || pathname.startsWith("/onboarding/")

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/auth/login",
				search: { redirect: safeReturnLocation(location.href) },
				replace: true,
			})
		}

		// Auth is shared by the Workers through @repo/auth-kit. The shop query
		// runs only after this auth gate succeeds; a shop 401 is therefore a
		// service/configuration failure and should reach the reusable route error.
		const shop: Shop | null = await context.queryClient.ensureQueryData(getMyShopQueryOptions())

		const onboardingPath = isOnboardingPath(location.pathname)

		if (shop) {
			if (location.pathname === "/onboarding/complete" && consumeOnboardingCompletion(context.queryClient)) return
			if (onboardingPath) throw redirect({ to: "/", replace: true })
			return
		}

		if (location.pathname === "/onboarding/complete") {
			throw redirect({ to: "/onboarding/welcome", replace: true })
		}

		if (!onboardingPath) throw redirect({ to: "/onboarding/welcome", replace: true })
	},
	pendingComponent: OnboardingPending,
	errorComponent: RouteError,
	component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
	return <Outlet />
}
