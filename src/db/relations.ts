import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
	users: {
		submissions: r.many.submissions(),
		bans: r.many.bans(),
		warnings: r.many.warnings(),
	},
	submissions: {
		submitter: r.one.users({
			from: r.submissions.submitterId,
			to: r.users.slackId,
		}),
	},
	bans: {
		user: r.one.users({
			from: r.bans.userId,
			to: r.users.slackId,
		}),
	},
	warnings: {
		user: r.one.users({
			from: r.warnings.userId,
			to: r.users.slackId,
		}),
	},
}))
