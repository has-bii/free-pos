import SubmitButton from "@repo/frontend/components/forms/SubmitButton"
import { APP_NAME } from "@repo/frontend/lib/config"
import { useForgotPasswordForm } from "@repo/frontend/modules/auth/hooks/useForgotPasswordForm"
import { Alert, AlertTitle } from "@repo/ui/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field"
import { Input } from "@repo/ui/components/ui/input"
import { Link } from "@tanstack/react-router"
import { AlertCircleIcon, KeyRoundIcon } from "lucide-react"

export default function ForgotPasswordForm() {
	const { form, submitted } = useForgotPasswordForm()

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{APP_NAME}</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					{submitted ? (
						<>
							<p className="text-sm text-muted-foreground">
								If an account exists for that email, we've sent a password reset link. The link expires in 1 hour.
							</p>
							<p className="text-center text-sm">
								<Link to="/auth/login" className="underline underline-offset-4">
									Back to log in
								</Link>
							</p>
						</>
					) : (
						<>
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
										name="email"
										children={(field) => {
											const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

											return (
												<Field data-invalid={isInvalid}>
													<FieldLabel htmlFor={field.name}>Email</FieldLabel>
													<Input
														id={field.name}
														name={field.name}
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														aria-invalid={isInvalid}
														placeholder="e.g. alex@gmail.com"
														autoComplete="email"
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
												Send reset link
												<KeyRoundIcon data-icon="inline-end" />
											</SubmitButton>
										)}
									/>
								</FieldGroup>
							</form>

							<p className="text-center text-sm">
								<Link to="/auth/login" className="underline underline-offset-4">
									Back to log in
								</Link>
							</p>
						</>
					)}
				</FieldGroup>
			</CardContent>
		</Card>
	)
}
