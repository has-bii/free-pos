import SubmitButton from "@repo/frontend/components/forms/SubmitButton"
import { APP_NAME } from "@repo/frontend/lib/config"
import { useAuth } from "@repo/frontend/modules/auth/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { createFileRoute } from "@tanstack/react-router"
import { useTransition } from "react"

export const Route = createFileRoute("/_authenticated/")({
	component: HomeComponent,
})

function HomeComponent() {
	const [isPending, startTransition] = useTransition()
	const { logout } = useAuth()

	return (
		<div className="flex min-h-svh items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>{APP_NAME}</CardTitle>
					<CardDescription>Frontend scaffold is wired up.</CardDescription>
				</CardHeader>
				<CardContent>
					<SubmitButton
						onClick={() => {
							startTransition(async () => await logout())
						}}
						isLoading={isPending}
					>
						Log out
					</SubmitButton>
				</CardContent>
			</Card>
		</div>
	)
}
