import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
	component: HomeComponent,
})

function HomeComponent() {
	return (
		<div className="flex min-h-svh items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Sero POS</CardTitle>
					<CardDescription>Frontend scaffold is wired up.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button>It works</Button>
				</CardContent>
			</Card>
		</div>
	)
}
