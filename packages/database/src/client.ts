import { connect } from "@tidbcloud/serverless"
import { drizzle } from "drizzle-orm/tidb-serverless"
import * as schema from "./schema"

export function createDatabaseClient(databaseUrl: string) {
	const client = connect({ url: databaseUrl })
	return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDatabaseClient>
