import { APP_NAME } from "@repo/frontend/lib/config"
import { LoaderCircleIcon } from "lucide-react"

export default function OnboardingPending() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6" role="status" aria-live="polite">
			<span className="text-lg font-semibold">{APP_NAME}</span>
			<LoaderCircleIcon className="size-6 animate-spin" aria-hidden="true" />
			<span>Loading your shop setup</span>
			<span className="sr-only">Checking whether your account has a shop.</span>
		</div>
	)
}
