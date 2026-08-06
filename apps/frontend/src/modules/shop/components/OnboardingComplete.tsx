import { APP_NAME } from "@repo/frontend/lib/config"
import OnboardingPage from "@repo/frontend/modules/shop/components/OnboardingPage"
import OnboardingPending from "@repo/frontend/modules/shop/components/OnboardingPending"
import { getMyShopQueryOptions } from "@repo/frontend/modules/shop/queries/get-my-shop.query"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { ArrowRightIcon, CheckCircle2Icon, StoreIcon } from "lucide-react"

export default function OnboardingComplete() {
	const { data: shop, isPending } = useQuery(getMyShopQueryOptions())
	const router = useRouter()

	if (isPending) return <OnboardingPending />

	return (
		<OnboardingPage step="complete">
			<Card className="w-full overflow-hidden">
				<CardHeader className="items-center gap-4 border-b bg-background/80 py-10 text-center sm:px-8">
					<div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
						<CheckCircle2Icon className="size-9" aria-hidden="true" />
					</div>
					<div className="grid gap-2">
						<CardTitle className="text-2xl sm:text-3xl">Your shop is ready</CardTitle>
						<CardDescription className="text-base">You&apos;re all set to start using {APP_NAME}.</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="grid gap-4 py-8 text-center sm:px-8">
					<div className="mx-auto flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-left">
						<StoreIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
						<div>
							<p className="text-sm text-muted-foreground">Your shop</p>
							<p className="font-semibold">{shop?.name ?? "Your new shop"}</p>
						</div>
					</div>
					<p className="text-sm leading-relaxed text-muted-foreground">
						Your dashboard is ready. Continue whenever you&apos;re ready to manage your POS.
					</p>
				</CardContent>
				<CardFooter className="justify-center border-t py-6 sm:px-8">
					<Button type="button" size="lg" onClick={() => void router.navigate({ to: "/", replace: true })}>
						Go to dashboard
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
				</CardFooter>
			</Card>
		</OnboardingPage>
	)
}
