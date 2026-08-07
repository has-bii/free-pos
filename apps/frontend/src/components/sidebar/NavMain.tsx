"use client"

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar"
import { Link } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"

export type NavMainProps = {
	title?: string
	items: {
		title: string
		url: string
		icon: LucideIcon
	}[]
}

export default function NavMain({ title, items }: NavMainProps) {
	return (
		<SidebarGroup>
			{title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem>
						<Link to={item.url}>
							{({ isActive }) => (
								<SidebarMenuButton tooltip={item.title} isActive={isActive}>
									<item.icon />
									<span>{item.title}</span>
								</SidebarMenuButton>
							)}
						</Link>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	)
}
