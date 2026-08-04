import { env } from "cloudflare:workers"
import { createDatabaseClient } from "@repo/database"
import journal from "@repo/database/drizzle/meta/_journal.json"
import { sql } from "drizzle-orm"

/**
 * Extracts the database name from a connection string.
 *
 * Deliberately not `new URL()`: TiDB passwords routinely contain characters
 * that are not percent-encoded in the string TiDB Cloud hands you, and a parse
 * failure here would surface as a confusing error instead of the guard below.
 */
const databaseNameFrom = (url: string): string | null => {
	const withoutQuery = url.split(/[?#]/)[0] ?? ""
	const afterScheme = withoutQuery.replace(/^[a-z0-9+.-]+:\/\//i, "")
	const slash = afterScheme.indexOf("/")
	if (slash === -1) return null
	const name = afterScheme.slice(slash + 1)
	return name === "" ? null : name
}

// Guard 1: missing config. Throwing rather than skipping is deliberate — a
// green run that executed nothing is worse than a red one.
if (!env.FREE_POS_DATABASE_URL) {
	throw new Error("TEST_DATABASE_URL is not set. Copy apps/auth/.env.test.example to .env.test.")
}

// Guard 2: wrong database. The suite issues DELETEs; a copy-pasted production
// URL must be an instant, obvious error rather than a catastrophe.
const databaseName = databaseNameFrom(env.FREE_POS_DATABASE_URL)
if (!databaseName || !/test/i.test(databaseName)) {
	throw new Error(`Refusing to run: database "${databaseName ?? ""}" does not look like a test database.`)
}

// Guard 3: migration drift. Test runs never perform DDL, so a migration added
// after the last `db:migrate` against this database would otherwise surface
// as a confusing column-not-found error mid-suite.
const db = createDatabaseClient(env.FREE_POS_DATABASE_URL)
const result = await db.execute(sql`select count(*) as n from __drizzle_migrations`)
const firstRow = (result.rows ?? [])[0] as Record<string, unknown> | undefined
const appliedCount = Number(firstRow?.n ?? 0)
const expectedCount = journal.entries.length
if (appliedCount < expectedCount) {
	throw new Error(
		`Test database is ${expectedCount - appliedCount} migration(s) behind. Run \`pnpm --filter @repo/database db:migrate\` against it.`,
	)
}
