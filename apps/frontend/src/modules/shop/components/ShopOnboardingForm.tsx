import SubmitButton from "@repo/frontend/components/forms/SubmitButton"
import { useCreateShopForm } from "@repo/frontend/modules/shop/hooks/useCreateShopForm"
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field"
import { Input } from "@repo/ui/components/ui/input"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { Link } from "@tanstack/react-router"
import { AlertCircleIcon, ArrowRightIcon } from "lucide-react"
import OnboardingPage from "./OnboardingPage"

export default function ShopOnboardingForm() {
	const form = useCreateShopForm()

	return (
		<OnboardingPage step="shop">
			<form
				onSubmit={(event) => {
					event.preventDefault()
					event.stopPropagation()
					form.handleSubmit()
				}}
			>
				<Card className="w-full">
					<CardHeader className="border-b bg-background/80 sm:px-8">
						<CardTitle className="text-2xl">Tell us about your shop</CardTitle>
						<CardDescription>Add a few details now. You can update them later from your dashboard.</CardDescription>
					</CardHeader>
					<CardContent className="py-8 sm:px-8">
						<FieldGroup>
							<form.Subscribe
								selector={(state) => [state.errorMap]}
								children={([errorMap]) =>
									errorMap?.onSubmit?.form ? (
										<Alert variant="destructive" aria-live="polite">
											<AlertCircleIcon />
											<AlertTitle>{errorMap.onSubmit.form}</AlertTitle>
											<AlertDescription>
												Review the form and try again. Your entered details are still here.
											</AlertDescription>
										</Alert>
									) : null
								}
							/>

							<form.Field
								name="name"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
									const errorId = `${field.name}-error`

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Shop name</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												aria-invalid={isInvalid}
												aria-describedby={isInvalid ? errorId : undefined}
												autoComplete="organization"
												placeholder="e.g. North Star Market"
											/>
											<FieldDescription>Use the name your customers know you by.</FieldDescription>
											{isInvalid && <FieldError id={errorId} errors={field.state.meta.errors} />}
										</Field>
									)
								}}
							/>

							<form.Field
								name="description"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
									const errorId = `${field.name}-error`

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												Description <span className="font-normal text-muted-foreground">(optional)</span>
											</FieldLabel>
											<Textarea
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												aria-invalid={isInvalid}
												aria-describedby={isInvalid ? errorId : undefined}
												placeholder="What makes your shop special?"
												rows={4}
											/>
											{isInvalid && <FieldError id={errorId} errors={field.state.meta.errors} />}
										</Field>
									)
								}}
							/>

							<form.Field
								name="address"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
									const errorId = `${field.name}-error`

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												Address <span className="font-normal text-muted-foreground">(optional)</span>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												aria-invalid={isInvalid}
												aria-describedby={isInvalid ? errorId : undefined}
												placeholder="e.g. 123 Main Street"
												autoComplete="street-address"
											/>
											{isInvalid && <FieldError id={errorId} errors={field.state.meta.errors} />}
										</Field>
									)
								}}
							/>
						</FieldGroup>
					</CardContent>
					<CardFooter className="flex-col-reverse justify-between gap-3 border-t py-6 sm:flex-row sm:px-8">
						<Button asChild type="button" variant="outline">
							<Link to="/onboarding/welcome">Back</Link>
						</Button>
						<form.Subscribe
							selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
							children={([canSubmit, isSubmitting, isDirty]) => (
								<SubmitButton type="submit" disabled={!canSubmit || !isDirty} isLoading={isSubmitting}>
									Create shop
									<ArrowRightIcon data-icon="inline-end" />
								</SubmitButton>
							)}
						/>
					</CardFooter>
				</Card>
			</form>
		</OnboardingPage>
	)
}
