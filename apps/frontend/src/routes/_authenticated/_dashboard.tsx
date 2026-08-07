import DashboardLayout from "@repo/frontend/components/layout/DashboardLayout"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/_dashboard")({
	component: DashboardLayout,
})
