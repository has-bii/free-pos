import { bigint, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core"

export const placeholder = mysqlTable("placeholder", {
	id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
})
