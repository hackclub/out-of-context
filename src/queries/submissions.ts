import { eq } from 'drizzle-orm'
import { db } from '../db'
import { submissions } from '../db/schema'

export type Submission = typeof submissions.$inferSelect
export type NewSubmission = typeof submissions.$inferInsert

export async function createSubmission(data: NewSubmission) {
	const [submission] = await db.insert(submissions).values(data).returning()
	return submission!
}

export async function deleteSubmission(id: number) {
	await db.delete(submissions).where(eq(submissions.id, id))
}
