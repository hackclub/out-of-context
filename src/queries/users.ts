import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'

export type User = typeof users.$inferSelect

export async function createUser(slackId: string) {
	const [user] = await db.insert(users).values({ slackId }).onConflictDoNothing().returning()
	return user
}

export async function getUser(slackId: string) {
	const [user] = await db.select().from(users).where(eq(users.slackId, slackId))
	return user
}

export async function isAdmin(userId: string) {
	const user = await getUser(userId)
	return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
}

export async function isSuperAdmin(userId: string) {
	const user = await getUser(userId)
	return user?.role === 'SUPER_ADMIN'
}

export async function setUserTrusted(userId: string, isTrusted: boolean) {
	const [user] = await db
		.update(users)
		.set({ isTrusted })
		.where(eq(users.slackId, userId))
		.returning()
	return user
}

export async function setUserOptOut(userId: string, optedOut: boolean) {
	const [user] = await db
		.update(users)
		.set({ optedOut })
		.where(eq(users.slackId, userId))
		.returning()
	return user
}

export async function setUserRole(userId: string, role: User['role']) {
	const [user] = await db.update(users).set({ role }).where(eq(users.slackId, userId)).returning()
	return user
}
