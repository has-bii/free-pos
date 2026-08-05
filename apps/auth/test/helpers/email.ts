import { emailSender } from "@repo/auth/lib/email"

export type CapturedEmail = { to: string; resetUrl: string }

/**
 * Every email the Worker's `emailSender.current` would have sent, in order.
 * `installEmailCapture()` swaps the sender for a fake that records here, so
 * the suite asserts on what *would* have been sent without ever touching
 * Resend (which cannot exist in CI).
 *
 * This mutation reaches the handlers because @cloudflare/vitest-pool-workers
 * bundles the test file and the Worker into one isolate — the same mechanism
 * the suite already relies on for `cloudflare:workers` `env` and the direct
 * `@repo/auth-kit/*` imports.
 */
export const capturedEmails: CapturedEmail[] = []

export const installEmailCapture = () => {
	emailSender.current = async ({ to, resetUrl }) => {
		capturedEmails.push({ to, resetUrl })
	}
}

export const resetEmailCapture = () => {
	capturedEmails.length = 0
}
