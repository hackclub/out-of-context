import { db } from '../db'
import { users } from '../db/schema'

export async function createUser(slackId: string) {
	const [user] = await db.insert(users).values({ slackId }).onConflictDoNothing().returning()
	return user
}
