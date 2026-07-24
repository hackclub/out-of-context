import {
	pgEnum,
	text,
	boolean,
	timestamp,
	uuid,
	jsonb,
	snakeCase,
	index,
	uniqueIndex,
	integer,
} from 'drizzle-orm/pg-core'

const pgTable = snakeCase.table

export const submissionStatusEnum = pgEnum('submission_status', [
	'PENDING',
	'APPROVED',
	'REJECTED_NOT_OOC',
	'REJECTED_EXPLICIT',
])

export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN', 'SUPER_ADMIN'])

export const users = pgTable('user', {
	slackId: text().primaryKey(),
	role: userRoleEnum().notNull().default('USER'),
	isTrusted: boolean().notNull().default(false),
	optedOut: boolean().notNull().default(false),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
})

export const submissions = pgTable(
	'submission',
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		status: submissionStatusEnum().notNull().default('PENDING'),
		originalMessageUser: text().notNull(),
		forwardedChannelId: text().notNull(),
		forwardedMessageTs: text().notNull(),
		postedChannelId: text(),
		postedMessageTs: text(),
		submitterId: text()
			.notNull()
			.references(() => users.slackId),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		deletedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		uniqueIndex().on(table.forwardedChannelId, table.forwardedMessageTs),
		uniqueIndex().on(table.postedChannelId, table.postedMessageTs),
	],
)

export const bans = pgTable(
	'ban',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text()
			.notNull()
			.references(() => users.slackId),
		reason: text().notNull(),
		expiresAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index().on(table.userId, table.expiresAt)],
)

export const warnings = pgTable(
	'warning',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text()
			.notNull()
			.references(() => users.slackId),
		reason: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index().on(table.userId)],
)

export const auditLogs = pgTable(
	'audit_log',
	{
		id: uuid().primaryKey().defaultRandom(),
		action: text().notNull(), // e.g., "warning.create", "user.ban", etc.
		actorId: text(), // Slack ID of the moderator/admin
		resourceType: text(), // e.g., "user", "submission", etc.
		resourceId: text(),
		details: jsonb().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index().on(table.resourceType, table.resourceId),
		index().on(table.action),
		index().on(table.actorId),
	],
)
