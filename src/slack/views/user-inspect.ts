import { actions, blocks, button, divider, option, section, select } from 'slack.ts'
import { type User } from '../../queries/users'

export async function generateUserInspectBlocks(user?: User) {
	let userBlocks
	if (user) {
		userBlocks = blocks(
			section(`<@${user.slackId}>`),
			section(`Is trusted: ${user.isTrusted}`).accessory(
				button(`Make ${user.isTrusted ? 'not ' : ''}trusted`)
					.style(user.isTrusted ? 'danger' : 'primary')
					.id('admin_set_trusted')
					.value(JSON.stringify({ id: user.slackId, isTrusted: !user.isTrusted })),
			),
			section(`Is opted out: ${user.optedOut}`).accessory(
				button(`Opt ${user.optedOut ? 'in' : 'out'} user`)
					.id('admin_set_optout')
					.value(JSON.stringify({ id: user.slackId, optedOut: !user.optedOut })),
			),
			section(`Role: ${user.role}`).accessory(
				select(
					option('User').value(JSON.stringify({ id: user.slackId, role: 'USER' })),
					option('Admin').value(JSON.stringify({ id: user.slackId, role: 'ADMIN' })),
					option('Super Admin').value(JSON.stringify({ id: user.slackId, role: 'SUPER_ADMIN' })),
				)
					.id('admin_set_role')
					.placeholder('Change role (super admin only)'),
			),
			divider(),
		)
	} else {
		userBlocks = blocks()
	}

	let userSelect = select().users().placeholder('Choose user to inspect').id('admin_inspect_user')
	if (user) userSelect = userSelect.default(user.slackId)

	return [...userBlocks, ...blocks(actions(userSelect))]
}
