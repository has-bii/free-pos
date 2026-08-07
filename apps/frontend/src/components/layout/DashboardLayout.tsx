import { AppSidebar } from "@repo/frontend/components/sidebar/AppSidebar"
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar"
import { Outlet } from "@tanstack/react-router"

export default function DashboardLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	)
}
