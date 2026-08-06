import "@repo/ui/styles/globals.css"

import { AuthProvider, useAuth } from "@repo/frontend/modules/auth/context/AuthContext"
import { routeTree } from "@repo/frontend/routeTree.gen"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 0,
		},
		mutations: {
			retry: 0,
		},
	},
})

const router = createRouter({
	routeTree,
	// biome-ignore lint/style/noNonNullAssertion: router context.auth automatically defined, check AppRouter below
	context: { queryClient, auth: undefined! },
})

function AppRouter() {
	const auth = useAuth()

	return <RouterProvider router={router} context={{ queryClient, auth }} />
}

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router
	}
}

const rootElement = document.getElementById("root")
if (!rootElement) {
	throw new Error("Root element not found")
}

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<AppRouter />
			</AuthProvider>
		</QueryClientProvider>
	</StrictMode>,
)
