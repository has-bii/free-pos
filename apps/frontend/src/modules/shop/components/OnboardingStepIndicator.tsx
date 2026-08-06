import { CheckIcon } from "lucide-react"

const steps = [
	{ id: "welcome", label: "Welcome" },
	{ id: "shop", label: "Shop" },
	{ id: "complete", label: "Complete" },
] as const

export type OnboardingStep = (typeof steps)[number]["id"]

interface Props {
	currentStep: OnboardingStep
}

export default function OnboardingStepIndicator({ currentStep }: Props) {
	const currentIndex = steps.findIndex((step) => step.id === currentStep)
	const currentLabel = steps[currentIndex]?.label ?? "Welcome"

	return (
		<nav aria-label={`Onboarding progress. Current step: ${currentLabel}`}>
			<p className="sr-only">
				Step {currentIndex + 1} of {steps.length}: {currentLabel}
			</p>
			<ol className="flex items-start justify-between gap-2 sm:gap-4">
				{steps.map((step, index) => {
					const isCurrent = step.id === currentStep
					const isComplete = index < currentIndex

					return (
						<li
							key={step.id}
							aria-current={isCurrent ? "step" : undefined}
							className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
						>
							<span
								aria-hidden="true"
								className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
									isCurrent
										? "border-primary bg-primary text-primary-foreground"
										: isComplete
											? "border-primary/50 bg-primary/10 text-primary"
											: "border-border bg-background text-muted-foreground"
								}`}
							>
								{isComplete ? <CheckIcon className="size-4" /> : index + 1}
							</span>
							<span
								className={`truncate text-sm ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}
							>
								{step.label}
							</span>
							{index < steps.length - 1 && (
								<span className="mx-1 hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />
							)}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}
