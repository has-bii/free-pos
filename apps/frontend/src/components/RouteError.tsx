import { APP_NAME } from "@repo/frontend/lib/config"
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useRouter } from "@tanstack/react-router"
import { AlertTriangleIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTransition } from "react"

export interface RouteErrorProps extends ErrorComponentProps {
	description?: ReactNode
	onRetry?: () => Promise<boolean | undefined>
	title?: string
}

export default function RouteError({
	error,
	reset,
	description,
	onRetry,
	title = "Something went wrong",
}: RouteErrorProps) {
	const router = useRouter()
	const [isRetrying, startTransition] = useTransition()
	const message = error instanceof Error ? error.message : "An unexpected error occurred."

	const retry = () =>
		startTransition(async () => {
			try {
				const shouldContinue = await onRetry?.()
				if (shouldContinue === false) return

				await router.invalidate()
				reset()
			} catch {
				// Keep the error page visible so the user can try again.
			}
		})

	return (
		<div
			className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-8 sm:px-6"
			role="alert"
			aria-live="assertive"
		>
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertTriangleIcon className="size-5 text-destructive" aria-hidden="true" />
						{title}
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-5">
					<Alert variant="destructive">
						<AlertTriangleIcon />
						<AlertTitle>We couldn&apos;t load this page.</AlertTitle>
						<AlertDescription>
							<p>{message}</p>
							{description ?? <p>Please retry before continuing.</p>}
						</AlertDescription>
					</Alert>
					<div className="flex items-center justify-between gap-3">
						<span className="text-sm text-muted-foreground">{APP_NAME}</span>
						<Button type="button" onClick={retry} disabled={isRetrying}>
							{isRetrying ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
							{isRetrying ? "Retrying..." : "Retry"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
