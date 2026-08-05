/**
 * Email delivery for account-recovery links. Resend in production (keyed by
 * FREE_POS_EMAIL_API_KEY), a console-log fallback for local dev without a key
 * (wrangler dev prints the clickable link), and a swappable sender for tests.
 */

export type EmailEnv = Pick<CloudflareBindings, "FREE_POS_EMAIL_API_KEY" | "FREE_POS_EMAIL_FROM">

export type SendResetEmail = (params: { to: string; resetUrl: string }, env: EmailEnv) => Promise<void>

const DEFAULT_FROM = "Free POS <no-reply@yourdomain.com>"

// Single source of truth for the link lifetime, shared by the forgot handler
// (sets expiresAt) and the email body ("expires in 1 hour").
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/** Pure, unit-friendly: normalizes a trailing slash so concatenation is safe. */
export const buildResetUrl = (frontendOrigin: string, rawToken: string): string =>
	`${frontendOrigin.replace(/\/$/, "")}/auth/reset-password?token=${rawToken}`

const resetEmailContent = (resetUrl: string) => {
	const text = [
		"We received a request to reset the password for your account.",
		"",
		"Reset your password:",
		resetUrl,
		"",
		"This link expires in 1 hour.",
		"If you didn't request this, you can safely ignore this email — your password won't change.",
	].join("\n")

	const html = [
		'<p style="margin: 0 0 16px;">We received a request to reset the password for your account.</p>',
		`<p style="margin: 0 0 16px;"><a href="${resetUrl}" style="color: #1d4ed8;">Reset your password</a></p>`,
		'<p style="margin: 0 0 16px;">This link expires in 1 hour.</p>',
		"<p style=\"margin: 0;\">If you didn't request this, you can safely ignore this email — your password won't change.</p>",
	].join("")

	return { subject: "Reset your password", text, html }
}

const resendSender: SendResetEmail = async ({ to, resetUrl }, env) => {
	const { subject, text, html } = resetEmailContent(resetUrl)

	if (!env.FREE_POS_EMAIL_API_KEY) {
		// Dev fallback: no key configured (wrangler dev / local tests without
		// the capture sender) — print the would-be email instead of failing.
		console.log(`[email] To: ${to}`)
		console.log(`[email] Subject: ${subject}`)
		console.log(`[email] Reset link: ${resetUrl}`)
		return
	}

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.FREE_POS_EMAIL_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: env.FREE_POS_EMAIL_FROM || DEFAULT_FROM,
			to,
			subject,
			text,
			html,
		}),
	})

	if (!res.ok) {
		throw new Error(`Resend delivery failed: ${res.status} ${await res.text()}`)
	}
}

/**
 * Module-level, swappable — the test seam. Tests replace `.current` with a
 * capture function so the suite asserts on what *would* have been sent
 * without ever touching Resend (see test/helpers/email.ts).
 */
export const emailSender: { current: SendResetEmail } = { current: resendSender }
