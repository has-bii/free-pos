import {
	boolean,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core"
import { uuidv7 } from "uuidv7"

export const user = mysqlTable("user", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
})

export const session = mysqlTable("session", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	userId: varchar("user_id", { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	token: varchar("token", { length: 255 }).notNull().unique(),
	expiresAt: timestamp("expires_at").notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
})

export const account = mysqlTable("account", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	userId: varchar("user_id", { length: 36 })
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accountId: varchar("account_id", { length: 255 }).notNull(),
	providerId: varchar("provider_id", { length: 255 }).notNull(),
	password: text("password"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
})

export const verification = mysqlTable("verification", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	identifier: varchar("identifier", { length: 255 }).notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
})
