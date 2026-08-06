import { APP_NAME } from "@repo/frontend/lib/config"
import { useLogout } from "@repo/frontend/modules/auth/hooks/useLogout"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/")({
	component: HomeComponent,
})

function HomeComponent() {
	const logout = useLogout()

	return (
		<div className="flex min-h-svh items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>{APP_NAME}</CardTitle>
					<CardDescription>Frontend scaffold is wired up.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={logout}>It works</Button>
				</CardContent>
			</Card>
		</div>
	)
}
