import { APP_NAME } from "@repo/frontend/lib/config"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Link } from "@tanstack/react-router"
import { ArrowRightIcon, StoreIcon } from "lucide-react"
import OnboardingPage from "./OnboardingPage"

export default function Welcome() {
	return (
		<OnboardingPage step="welcome">
			<Card className="w-full overflow-hidden">
				<CardHeader className="gap-5 border-b bg-background/80 py-8 sm:px-8">
					<div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<StoreIcon className="size-6" aria-hidden="true" />
					</div>
					<div className="grid gap-2">
						<CardTitle className="text-2xl sm:text-3xl">Welcome to {APP_NAME}</CardTitle>
						<CardDescription className="max-w-xl text-base leading-relaxed">
							Before you can use the POS, create the shop that your team will work from. It only takes a minute to get
							set up.
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="grid gap-6 py-8 sm:px-8">
					<div className="grid gap-4 sm:grid-cols-3">
						{[
							["One workspace", "Keep your shop details together."],
							["Simple setup", "Add the details your POS needs."],
							["Ready to sell", "Jump into your dashboard when done."],
						].map(([title, description]) => (
							<div key={title} className="rounded-lg border bg-muted/30 p-4">
								<p className="font-medium">{title}</p>
								<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
							</div>
						))}
					</div>
					<div className="flex justify-end">
						<Button asChild size="lg">
							<Link to="/onboarding/shop">
								Continue
								<ArrowRightIcon data-icon="inline-end" />
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</OnboardingPage>
	)
}
