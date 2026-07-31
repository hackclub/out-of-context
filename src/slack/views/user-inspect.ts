import { actions, blocks, button, divider, option, section, select } from 'slack.ts'
import { getActiveBan } from '../../queries/bans'
import { type User } from '../../queries/users'

function banStatusText(ban: Awaited<ReturnType<typeof getActiveBan>>) {
	if (!ban) return 'Not banned'
	const until = ban.expiresAt
		? `until <!date^${Math.floor(ban.expiresAt.getTime() / 1000)}^{date_short_pretty} {time}|${ban.expiresAt.toISOString()}>`
		: 'permanently'
	return `:no_entry: Banned ${until}\nReason: ${ban.reason}`
}

export async function generateUserInspectBlocks(user?: User) {
	let userBlocks
	if (user) {
		const ban = await getActiveBan(user.slackId)
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
			section(banStatusText(ban)).accessory(
				ban
					? button('Unban')
							.style('primary')
							.id('admin_unban_user')
							.value(JSON.stringify({ id: user.slackId }))
					: button('Ban')
							.style('danger')
							.id('admin_ban_user')
							.value(JSON.stringify({ id: user.slackId })),
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
