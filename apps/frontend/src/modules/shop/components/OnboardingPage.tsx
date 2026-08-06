import { APP_NAME } from "@repo/frontend/lib/config"
import { useAuth } from "@repo/frontend/modules/auth/context/AuthContext"
import OnboardingStepIndicator, {
	type OnboardingStep,
} from "@repo/frontend/modules/shop/components/OnboardingStepIndicator"
import { Button } from "@repo/ui/components/ui/button"
import { useRouter } from "@tanstack/react-router"
import { LogOutIcon } from "lucide-react"
import type { PropsWithChildren } from "react"
import { useTransition } from "react"

interface Props extends PropsWithChildren {
	step: OnboardingStep
}

export default function OnboardingPage({ step, children }: Props) {
	return (
		<main className="min-h-svh bg-muted/30 px-4 py-8 sm:px-6 sm:py-12">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
				<header className="flex items-start justify-between gap-4">
					<div>
						<p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
						<p className="text-sm text-muted-foreground">Set up your shop to get started.</p>
					</div>
					<SignOutButton />
				</header>
				<OnboardingStepIndicator currentStep={step} />
				{children}
			</div>
		</main>
	)
}

function SignOutButton() {
	const { logout } = useAuth()
	const router = useRouter()
	const [isPending, startTransition] = useTransition()

	return (
		<Button
			variant="ghost"
			type="button"
			disabled={isPending}
			onClick={() =>
				startTransition(async () => {
					try {
						await logout()
					} finally {
						await router.navigate({ to: "/auth/login", replace: true })
					}
				})
			}
		>
			<LogOutIcon />
			<span>{isPending ? "Signing out..." : "Sign out"}</span>
		</Button>
	)
}
