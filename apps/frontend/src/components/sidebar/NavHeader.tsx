"use client"

import { APP_NAME } from "@repo/frontend/lib/config"
import { getMyShopQueryOptions } from "@repo/frontend/modules/shop/queries/get-my-shop.query"

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@repo/ui/components/ui/sidebar"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { StoreIcon } from "lucide-react"

export default function NavHeader() {
	const { data } = useSuspenseQuery(getMyShopQueryOptions())

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					size="lg"
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					asChild
				>
					<Link to="/">
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
							<StoreIcon className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">{APP_NAME}</span>
							<span className="truncate text-xs">{data?.name}</span>
						</div>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
