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

export async function getSubmission(id: number) {
	const [submission] = await db.select().from(submissions).where(eq(submissions.id, id))
	return submission
}

export async function updateSubmissionStatus(id: number, status: Submission['status']) {
	const [submission] = await db
		.update(submissions)
		.set({ status })
		.where(eq(submissions.id, id))
		.returning()
	return submission
}

export async function approveSubmission(
	id: number,
	postedChannelId: string,
	postedMessageTs: string,
) {
	const [submission] = await db
		.update(submissions)
		.set({ status: 'APPROVED', postedChannelId, postedMessageTs })
		.where(eq(submissions.id, id))
		.returning()
	return submission
}
