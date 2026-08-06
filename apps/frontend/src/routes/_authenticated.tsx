import { safeReturnLocation } from "@repo/frontend/utils/safe-return-location"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/auth/login",
				search: { redirect: safeReturnLocation(location.href) },
			})
		}
	},
	component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
	return <Outlet />
}
