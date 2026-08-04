import { vValidator } from "@hono/valibot-validator"
import type { ValidationTargets } from "hono"
import type { GenericSchema, GenericSchemaAsync } from "valibot"

export const validate = <T extends GenericSchema | GenericSchemaAsync, Target extends keyof ValidationTargets>(
	target: Target,
	schema: T,
) => {
	return vValidator(target, schema, (result, c) => {
		if (result.success) return
		const error: Record<string, string> = {}
		for (const issue of result.issues) {
			const field = issue.path?.[0]?.key
			if (typeof field === "string" && !(field in error)) {
				error[field] = issue.message
			}
		}
		return c.json({ message: "Validation failed.", error }, 400)
	})
}
