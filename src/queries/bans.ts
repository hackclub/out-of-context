import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { db } from '../db'
import { bans } from '../db/schema'

export type Ban = typeof bans.$inferSelect
export type NewBan = typeof bans.$inferInsert

function activeBanFilter(userId: string, now: Date) {
	return and(eq(bans.userId, userId), or(isNull(bans.expiresAt), gt(bans.expiresAt, now)))
}

export async function getActiveBan(userId: string) {
	const [ban] = await db
		.select()
		.from(bans)
		.where(activeBanFilter(userId, new Date()))
		.orderBy(desc(bans.createdAt))
		.limit(1)
	return ban
}

export async function createBan(data: { userId: string; reason: string; expiresAt: Date | null }) {
	const [ban] = await db.insert(bans).values(data).returning()
	return ban!
}

export async function liftActiveBans(userId: string) {
	const now = new Date()
	const lifted = await db
		.update(bans)
		.set({ expiresAt: now })
		.where(activeBanFilter(userId, now))
		.returning()
	return lifted.length 
}
