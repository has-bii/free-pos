import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_unauthenticated")({
	beforeLoad: ({ context }) => {
		if (context.auth?.isAuthenticated) throw redirect({ to: "/" })
	},
	component: UnauthenticatedLayout,
})

function UnauthenticatedLayout() {
	return <Outlet />
}
