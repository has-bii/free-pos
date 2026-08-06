import { APP_NAME } from "@repo/frontend/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Link, useSearch } from "@tanstack/react-router"
import { AlertCircleIcon } from "lucide-react"

const messages: Record<string, string> = {
	google_cancelled: "Google sign-in was cancelled.",
	google_invalid_callback: "The Google sign-in could not be completed. Please try again.",
	google_failed: "Google sign-in is temporarily unavailable. Please try again.",
	google_account_conflict: "That Google account is already linked to another account.",
	google_account_unverified: "Google did not provide a verified email address.",
	google_link_required: "This Google account needs to be linked before you can sign in.",
}

export default function GoogleOAuthError() {
	const { code } = useSearch({ from: "/_unauthenticated/auth/error" })
	const message =
		code && Object.hasOwn(messages, code) ? messages[code] : "Google sign-in could not be completed. Please try again."

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{APP_NAME}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex items-start gap-3" role="alert">
					<AlertCircleIcon className="text-destructive mt-0.5 size-5 shrink-0" />
					<p className="text-sm">{message}</p>
				</div>
				<Link to="/auth/login" className="block text-center text-sm underline underline-offset-4">
					Back to login
				</Link>
			</CardContent>
		</Card>
	)
}
