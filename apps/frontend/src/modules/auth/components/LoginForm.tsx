import InputPassword from "@repo/frontend/components/forms/InputPassword"
import SubmitButton from "@repo/frontend/components/forms/SubmitButton"
import { APP_NAME, AUTH_API_URL } from "@repo/frontend/lib/config"
import { GoogleIcon } from "@repo/frontend/modules/auth/components/GoogleIcon"
import { useLoginForm } from "@repo/frontend/modules/auth/hooks/useLoginForm"
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert"
import { Button } from "@repo/ui/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@repo/ui/components/ui/field"
import { Input } from "@repo/ui/components/ui/input"
import { Link, useSearch } from "@tanstack/react-router"
import { AlertCircleIcon, CheckCircle2Icon, LogIn } from "lucide-react"

export default function LoginForm() {
	const form = useLoginForm()
	// Set by the reset-password page after a successful reset
	// (navigate({ to: "/auth/login", search: { reset: "success" } })).
	const { reset } = useSearch({ from: "/auth/login" })

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>{APP_NAME}</CardTitle>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					{reset === "success" && (
						<Alert className="max-w-md">
							<CheckCircle2Icon />
							<AlertTitle>Password updated.</AlertTitle>
							<AlertDescription>Log in with your new password.</AlertDescription>
						</Alert>
					)}
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

							<form.Field
								name="password"
								children={(field) => {
									const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
									return (
										<Field data-invalid={isInvalid}>
											<div className="grid grid-cols-2 gap-2">
												<FieldLabel htmlFor={field.name}>Password</FieldLabel>
												<Link to="/auth/forgot-password" className="underline underline-offset-4 text-right text-sm">
													Forgot password?
												</Link>
											</div>
											<InputPassword
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												autoComplete="current-password"
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
										Log in
										<LogIn data-icon="inline-end" />
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
						onClick={() => window.location.assign(`${AUTH_API_URL}/login/google?returnTo=${encodeURIComponent("/")}`)}
					>
						<GoogleIcon className="size-4" />
						Continue with Google
					</Button>

					<p className="text-center text-sm">
						Don't have an account?{" "}
						<Link to="/auth/register" className="underline underline-offset-4">
							Create account
						</Link>
					</p>
				</FieldGroup>
			</CardContent>
		</Card>
	)
}
