import InputPassword from "@repo/frontend/components/forms/InputPassword"
import SubmitButton from "@repo/frontend/components/forms/SubmitButton"
import { APP_NAME } from "@repo/frontend/lib/config"
import { useResetPasswordForm } from "@repo/frontend/modules/auth/hooks/useResetPasswordForm"
import { Alert, AlertTitle } from "@repo/ui/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field"
import { Link, useSearch } from "@tanstack/react-router"
import { AlertCircleIcon, ShieldCheckIcon } from "lucide-react"

export default function ResetPasswordForm() {
	const { token } = useSearch({ from: "/auth/reset-password" })

	// No token in the URL — the link is incomplete or was stripped of its query.
	if (!token) return <InvalidLinkCard />

	return <ResetForm token={token} />
}

function ResetForm({ token }: { token: string }) {
	const { form, tokenInvalid } = useResetPasswordForm(token)

	// The submitted token turned out to be invalid/expired/consumed — the link
	// is dead either way, so show the same dead-end-free state as a missing token.
	if (tokenInvalid) return <InvalidLinkCard />

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{APP_NAME}</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<form
						onSubmit={(e) => {
							e.preventDefault()
							e.stopPropagation()
							form.handleSubmit()
						}}
					>
						<FieldGroup>
							<form.Subscribe
								selector={(state) => [state.errorMap]}
								children={([errorMap]) =>
									errorMap?.onSubmit?.form ? (
										<Alert variant="destructive" className="max-w-md">
											<AlertCircleIcon />
											<AlertTitle>{errorMap.onSubmit.form}</AlertTitle>
										</Alert>
									) : null
								}
							/>

							<form.Field
								name="password"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>New password</FieldLabel>
											<InputPassword
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="new-password"
											/>
											{isInvalid && <FieldError errors={field.state.meta.errors} />}
										</Field>
									)
								}}
							/>

							<form.Field
								name="confirmPassword"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Confirm new password</FieldLabel>
											<InputPassword
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="new-password"
											/>
											{isInvalid && <FieldError errors={field.state.meta.errors} />}
										</Field>
									)
								}}
							/>

							<form.Subscribe
								selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
								children={([canSubmit, isSubmitting, isDirty]) => (
									<SubmitButton
										type="submit"
										className="w-full"
										disabled={!canSubmit || !isDirty}
										isLoading={isSubmitting}
									>
										Reset password
										<ShieldCheckIcon data-icon="inline-end" />
									</SubmitButton>
								)}
							/>
						</FieldGroup>
					</form>
				</FieldGroup>
			</CardContent>
		</Card>
	)
}

function InvalidLinkCard() {
	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{APP_NAME}</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<p className="text-sm text-muted-foreground">This reset link is invalid or incomplete.</p>
					<p className="text-center text-sm">
						<Link to="/auth/forgot-password" className="underline underline-offset-4">
							Request a new reset link
						</Link>
					</p>
				</FieldGroup>
			</CardContent>
		</Card>
	)
}
