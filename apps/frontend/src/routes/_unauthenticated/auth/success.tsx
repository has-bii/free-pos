import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { createFileRoute, Link, Navigate } from "@tanstack/react-router"
import { CheckCircle2Icon } from "lucide-react"
import * as v from "valibot"

const successContent = {
	"email-verified": {
		title: "Email verified",
		message: "Your email has been verified successfully.",
	},
	"password-reset": {
		title: "Password reset",
		message: "Your password has been reset successfully.",
	},
	"email-sent": {
		title: "Email sent",
		message: "The email was sent successfully.",
	},
} as const

type SuccessType = keyof typeof successContent

const successSearchSchema = v.object({
	type: v.optional(v.string()),
})

const isSuccessType = (type: string | undefined): type is SuccessType =>
	type !== undefined && Object.hasOwn(successContent, type)

export const Route = createFileRoute("/_unauthenticated/auth/success")({
	validateSearch: v.parser(successSearchSchema),
	component: SuccessPage,
})

function SuccessPage() {
	const { type } = Route.useSearch()
	if (!isSuccessType(type)) return <Navigate to="/auth/login" />

	const { title, message } = successContent[type]

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="flex items-start gap-3" role="status" aria-live="polite">
					<CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
					<p className="text-sm">{message}</p>
				</div>
				<Link to="/auth/login" className="block text-center text-sm underline underline-offset-4">
					Back to login
				</Link>
			</CardContent>
		</Card>
	)
}
