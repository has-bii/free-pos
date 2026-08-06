import InputPassword from "@repo/frontend/components/forms/InputPassword"
import SubmitButton from "@repo/frontend/components/forms/SubmitButton"
import { APP_NAME, AUTH_API_URL } from "@repo/frontend/lib/config"
import { GoogleIcon } from "@repo/frontend/modules/auth/components/GoogleIcon"
import { useRegisterForm } from "@repo/frontend/modules/auth/hooks/useRegisterForm"
import { Alert, AlertTitle } from "@repo/ui/components/ui/alert"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@repo/ui/components/ui/field"
import { Input } from "@repo/ui/components/ui/input"
import { Link, useSearch } from "@tanstack/react-router"
import { AlertCircleIcon, UserPlus } from "lucide-react"

export default function RegisterForm() {
	const { redirect } = useSearch({ from: "/_unauthenticated/auth/register" })
	const form = useRegisterForm(redirect)

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
								name="name"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Name</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="name"
											/>
											{isInvalid && <FieldError errors={field.state.meta.errors} />}
										</Field>
									)
								}}
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

							<form.Field
								name="password"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Password</FieldLabel>
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
											<FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
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
										Create account
										<UserPlus data-icon="inline-end" />
									</SubmitButton>
								)}
							/>
						</FieldGroup>
					</form>

					<FieldSeparator>or continue with</FieldSeparator>

					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() =>
							window.location.assign(`${AUTH_API_URL}/login/google?returnTo=${encodeURIComponent(redirect ?? "/")}`)
						}
					>
						<GoogleIcon className="size-4" />
						Continue with Google
					</Button>

					<p className="text-center text-sm">
						Already have an account?{" "}
						<Link to="/auth/login" search={redirect ? { redirect } : {}} className="underline underline-offset-4">
							Log in
						</Link>
					</p>
				</FieldGroup>
			</CardContent>
		</Card>
	)
}
