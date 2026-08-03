import type { Database } from "@repo/database"
import { createFactory } from "hono/factory"

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
export type DatabaseExecutor = Database | Transaction

type AppEnv = { Bindings: CloudflareBindings; Variables: { db: Database } }

export const factory = createFactory<AppEnv>()
