"use client"

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@repo/ui/components/ui/sidebar"
import { HomeIcon } from "lucide-react"
import type * as React from "react"
import NavHeader from "./NavHeader"
import NavMain, { type NavMainProps } from "./NavMain"
import NavUser from "./NavUser"

const navMain: NavMainProps = {
	items: [
		{
			title: "Dashboard",
			icon: HomeIcon,
			url: "/",
		},
	],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<NavHeader />
			</SidebarHeader>
			<SidebarContent>
				<NavMain {...navMain} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}
