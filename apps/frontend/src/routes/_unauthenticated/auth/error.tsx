import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { createFileRoute, Link } from "@tanstack/react-router"
import { AlertCircleIcon } from "lucide-react"
import * as v from "valibot"

const errorContent = {
	google_cancelled: {
		title: "Sign-in cancelled",
		message: "Google sign-in was cancelled.",
	},
	google_invalid_callback: {
		title: "Sign-in failed",
		message: "The Google sign-in could not be completed. Please try again.",
	},
	google_failed: {
		title: "Sign-in unavailable",
		message: "Google sign-in is temporarily unavailable. Please try again.",
	},
	google_account_conflict: {
		title: "Account already linked",
		message: "That Google account is already linked to another account.",
	},
	google_account_unverified: {
		title: "Unverified email",
		message: "Google did not provide a verified email address.",
	},
	google_link_required: {
		title: "Account link required",
		message: "This Google account needs to be linked before you can sign in.",
	},
} as const

type ErrorCode = keyof typeof errorContent

const fallbackContent = {
	title: "Unexpected error",
	message: "An unexpected error occurred while processing the request.",
} as const

const errorSearchSchema = v.object({
	code: v.optional(v.string()),
})

const isErrorCode = (code: string | undefined): code is ErrorCode =>
	code !== undefined && Object.hasOwn(errorContent, code)

export const Route = createFileRoute("/_unauthenticated/auth/error")({
	validateSearch: v.parser(errorSearchSchema),
	component: ErrorPage,
})

function ErrorPage() {
	const { code } = Route.useSearch()
	const { title, message } = isErrorCode(code) ? errorContent[code] : fallbackContent

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex items-start gap-3" role="alert">
					<AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
					<p className="text-sm">{message}</p>
				</div>
				<Link to="/auth/login" className="block text-center text-sm underline underline-offset-4">
					Back to login
				</Link>
			</CardContent>
		</Card>
	)
}
