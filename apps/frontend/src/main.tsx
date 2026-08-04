import "@repo/ui/styles/globals.css"

import { routeTree } from "@repo/frontend/routeTree.gen"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const queryClient = new QueryClient()

const router = createRouter({ routeTree, context: { queryClient } })

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
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
)
