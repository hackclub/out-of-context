import { db } from '../db'
import { auditLogs } from '../db/schema'

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

export async function logAudit(data: {
	action: string
	actorId?: string
	resourceType?: string
	resourceId?: unknown
	details?: unknown
}) {
	try {
		const [log] = await db
			.insert(auditLogs)
			.values({
				action: data.action,
				actorId: data.actorId,
				resourceType: data.resourceType,
				resourceId: String(data.resourceId),
				details: data.details || {},
			})
			.returning()
		return log!
	} catch (e) {
		console.error('Failed to log audit log:', e)
	}
}
