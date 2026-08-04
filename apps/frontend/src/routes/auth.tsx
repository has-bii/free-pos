import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/auth")({
	component: AuthLayout,
})

function AuthLayout() {
	return (
		<div className="flex min-h-svh items-center justify-center p-6">
			<Outlet />
		</div>
	)
}
