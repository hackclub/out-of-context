import {
	actions,
	blocks,
	button,
	context,
	image,
	mrkdwn,
	R,
	richText,
	section,
	SlackWebAPIPlatformError,
	type ActionInstance,
	type App,
} from 'slack.ts'
import { config } from '../config'
import { logAudit } from '../queries/audit'
import {
	approveSubmission,
	createSubmission,
	deleteSubmission,
	getSubmission,
	updateSubmissionStatus,
} from '../queries/submissions'
import { createUser } from '../queries/users'
import { forwardMessageFromUser } from './operations'

export function attachListeners(app: App, userApp: App) {
	// someone sent a message
	userApp.on('message:normal', async (event) => {
		if ((event as any).channel_type !== 'im') return
		if (event.user === config.slack.userId) return

		let channel
		try {
			channel = await event.channel
		} catch (e) {
			if (e instanceof SlackWebAPIPlatformError && e.error === 'channel_not_found') {
				return
			} else {
				console.error('Error fetching channel:', e)
				return
			}
		}

		if (event.thread_ts) {
			// add a comment to the message?
		} else {
			// a new ooc message probably
			const attachment = event.attachments?.[0]
			if (!attachment?.is_msg_unfurl || !attachment.author_id) {
				return event.reply(
					`Please forward a message to me to send it to <#${config.slack.channelId}>. Copying the message link does not work!`,
				)
			}

			if (event.text || event.blocks) {
				return event.reply(
					`Please don\'t include any text in your forward. This makes it impossible for me to forward the message to <#${config.slack.channelId}>!`,
				)
			}

			let submission
			try {
				await createUser(event.user)
				submission = await createSubmission({
					originalMessageUser: attachment.author_id,
					forwardedChannelId: channel.id,
					forwardedMessageTs: event.ts,
					submitterId: event.user,
				})

				const buttonValue = JSON.stringify({ id: submission.id })
				const forwarded = await forwardMessageFromUser(
					event.channel.id,
					event.ts,
					config.slack.reviewChannelId,
					{
						blocks: blocks(
							richText(R.section(`OOC #${submission.id} submitted by `, R.user(event.user))),
						),
					},
				)
				await app
					.channel(forwarded.channel)
					.message(forwarded.ts)
					.edit({
						blocks: blocks(
							section(mrkdwn(`OOC #${submission.id} submitted by <@${event.user}>`).verbatim()),
							actions(
								button('Approve').id('approve').value(buttonValue).style('primary'),
								button('Reject (not OOC)').id('reject_ooc').value(buttonValue),
								button('Reject (Explicit)')
									.id('reject_explicit')
									.value(buttonValue)
									.style('danger'),
							),
						),
					})
			} catch (e) {
				if (submission) {
					deleteSubmission(submission.id).catch((e) =>
						console.error('Failed to delete failed submission:', e),
					)
				}
				console.error('Error submitting OOC', e)
				return event.reply('There was an error submitting your OOC. Please try again later.')
			}

			logAudit({
				action: 'submission.create',
				actorId: event.user,
				resourceType: 'submission',
				resourceId: submission.id,
				details: {
					originalMessageUser: attachment.author_id,
					originalMessageLink: attachment.from_url,
				},
			})

			return event.reply(
				`Your message has been staged as OOC #${submission.id}. It will be reviewed soon!`,
			)
		}
	})

	userApp.on('action:button.approve', async (event) => {
		if (event.event.container.type !== 'message') return
		const userId = event.event.user.id
		const { id } = JSON.parse(event.value!) as { id: number }

		const submission = await getSubmission(id)
		if (!submission) {
			return event.respond
				.message({ ephemeral: true, text: 'Cannot find submission.' })
				.catch((e) => console.error('Failed to respond to failed approval:', e))
		}

		let postedChannelId, postedMessageTs
		try {
			;({ channel: postedChannelId, ts: postedMessageTs } = await forwardMessageFromUser(
				submission.forwardedChannelId,
				submission.forwardedMessageTs,
				config.slack.channelId,
				{ text: `<@${submission.submitterId}>` },
			))
			await app
				.channel(postedChannelId)
				.message(postedMessageTs)
				.edit({
					blocks: blocks(
						context(
							image('user pfp').url(`https://cachet.dunkirk.sh/users/${submission.submitterId}/r`),
							`<@${submission.submitterId}>`,
						),
					),
					metadata: {
						event_type: 'out_of_context_posted',
						event_payload: {
							id: submission.id,
							submitter: submission.submitterId,
							submittedAt: submission.createdAt,
						},
					},
				})

			await app
				.channel(event.event.container.channel_id)
				.message(event.event.container.message_ts)
				.edit({
					blocks: blocks(
						section(
							mrkdwn(
								`OOC #${submission.id} submitted by <@${submission.submitterId}> - :white_check_mark: approved by <@${userId}>`,
							).verbatim(),
						),
					),
				})

			await approveSubmission(id, postedChannelId, postedMessageTs)
		} catch (e) {
			console.error('Failed to approve OOC:', e)
			if (postedChannelId && postedMessageTs) {
				app
					.request('chat.delete', { channel: postedChannelId, ts: postedMessageTs })
					.catch((e) => console.error('Failed to delete failed approved OOC:', e))
			}
			return event.respond
				.message({ ephemeral: true, text: 'Failed to approve OOC. Please try again later.' })
				.catch((e) => console.error('Failed to respond to failed approval:', e))
		}

		logAudit({
			action: 'submission.approve',
			actorId: userId,
			resourceType: 'submission',
			resourceId: id,
			details: { postedChannelId, postedMessageTs },
		})
	})

	async function reject(
		event: ActionInstance,
		id: number,
		status: 'REJECTED_NOT_OOC' | 'REJECTED_EXPLICIT',
		message: string,
	) {
		if (event.event.container.type !== 'message') return

		const submission = await getSubmission(id)
		if (!submission) {
			return event.respond
				.message({ ephemeral: true, text: 'Cannot find submission.' })
				.catch((e) => console.error('Failed to respond to failed OOC rejection:', e))
		}

		try {
			await userApp
				.channel(submission.forwardedChannelId)
				.message(submission.forwardedMessageTs)
				.reply(message)

			await app
				.channel(event.event.container.channel_id)
				.message(event.event.container.message_ts)
				.edit({
					blocks: blocks(
						section(
							mrkdwn(
								`OOC #${submission.id} submitted by <@${submission.submitterId}> - :x: rejected (${status.split('_').slice(1).join(' ').toLowerCase()}) by <@${event.event.user.id}>`,
							).verbatim(),
						),
					),
				})

			await updateSubmissionStatus(id, status)
		} catch (e) {
			console.error('Failed to reject OOC:', e)
		}
	}

	userApp.on('action:button.reject_ooc', async (event) => {
		if (event.event.container.type !== 'message') return
		const userId = event.event.user.id
		const { id } = JSON.parse(event.value!) as { id: number }

		await reject(
			event,
			id,
			'REJECTED_NOT_OOC',
			`:x: Your submission has been rejected because it is not suitable for the <#${config.slack.channelId}> channel.`,
		)

		logAudit({
			action: 'submission.reject_ooc',
			actorId: userId,
			resourceType: 'submission',
			resourceId: id,
		})
	})

	userApp.on('action:button.reject_explicit', async (event) => {
		if (event.event.container.type !== 'message') return
		const userId = event.event.user.id
		const { id } = JSON.parse(event.value!) as { id: number }

		await reject(
			event,
			id,
			'REJECTED_EXPLICIT',
			`:x: Your submission has been rejected because it doesn't comply with the rules on explicit content.`,
		)

		logAudit({
			action: 'submission.reject_explicit',
			actorId: userId,
			resourceType: 'submission',
			resourceId: id,
		})
	})
}
