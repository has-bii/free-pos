import type { AuthContextType } from "@repo/frontend/modules/auth/context/AuthContext"
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"

interface RouterContext {
	queryClient: QueryClient
	auth: AuthContextType | undefined
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
})

function RootComponent() {
	return <Outlet />
}
