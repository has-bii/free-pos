import { boolean, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
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

export const shop = mysqlTable(
	"shop",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.$defaultFn(() => uuidv7()),
		ownerUserId: varchar("owner_id", { length: 36 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 64 }).notNull(),
		description: text("description"),
		address: text("address"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
	},
	(table) => [uniqueIndex("shop_owner_unique").on(table.ownerUserId), uniqueIndex("shop_slug_unique").on(table.slug)],
)

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

export const account = mysqlTable(
	"account",
	{
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
	},
	(table) => [
		// Backstop for OAuth link/create races (e.g. double-tapped callbacks): a
		// provider account can map to at most one `account` row. See
		// docs/prd/google-oauth.md.
		uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId),
	],
)

export const verification = mysqlTable("verification", {
	id: varchar("id", { length: 36 })
		.primaryKey()
		.$defaultFn(() => uuidv7()),
	identifier: varchar("identifier", { length: 255 }).notNull(),
	// varchar + unique (not text) so the reset leg can look up by hashed token
	// value — MySQL can't index a text column without a prefix length.
	// Mirrors the session.token pattern; 64-hex-char SHA-256 hashes fit.
	value: varchar("value", { length: 255 }).notNull().unique(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
})
