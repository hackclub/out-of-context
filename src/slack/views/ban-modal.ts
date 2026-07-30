import { blocks, input, option, plainTextInput, section, select } from 'slack.ts'

export const BAN_CALLBACK_ID = 'ban_user'

export const BAN_DURATIONS: { label: string; value: string; seconds: number | null }[] = [
	{ label: '1 hour', value: '3600', seconds: 3600 },
	{ label: '1 day', value: '86400', seconds: 86400 },
	{ label: '3 days', value: '259200', seconds: 259200 },
	{ label: '1 week', value: '604800', seconds: 604800 },
	{ label: '1 month', value: '2592000', seconds: 2592000 },
	{ label: 'Permanent', value: 'permanent', seconds: null },
]

export function banDurationExpiry(value: string): Date | null {
	const match = BAN_DURATIONS.find((d) => d.value === value)
	if (!match || match.seconds === null) return null
	return new Date(Date.now() + match.seconds * 1000)
}

export function generateBanModal(userId: string) {
	return {
		type: 'modal' as const,
		callback_id: BAN_CALLBACK_ID,
		private_metadata: userId,
		title: { type: 'plain_text' as const, text: 'Ban user' },
		submit: { type: 'plain_text' as const, text: 'Ban' },
		close: { type: 'plain_text' as const, text: 'Cancel' },
		blocks: blocks(
			section(`Banning <@${userId}> from submitting any OOCs.`),
			input(
				'Duration',
				select(...BAN_DURATIONS.map((d) => option(d.label).value(d.value)))
					.id('duration')
					.placeholder('Choose a duration'),
			).id('duration_block'),
			input('Reason', plainTextInput().id('reason').multiline().placeholder('Reason for the ban'))
				.id('reason_block')
				.hint('Shown to the user when they try to submit.'),
		),
	}
}
