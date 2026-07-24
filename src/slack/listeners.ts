import {
	actions,
	blocks,
	button,
	context,
	image,
	section,
	SlackWebAPIPlatformError,
	type App,
} from 'slack.ts'
import { config } from '../config'
import { createUser } from '../queries/users'
import {
	createSubmission,
	deleteSubmission,
	getSubmission,
	updateSubmissionStatus,
	type Submission,
} from '../queries/submissions'
import { forwardMessageFromUser, getUserBotDM } from './operations'
import { logAudit } from '../queries/audit'
import { userClient } from '.'

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
					{ text: `OOC submitted by <@${event.user}>` },
				)
				await app
					.channel(forwarded.channel)
					.message(forwarded.ts)
					.edit({
						blocks: blocks(
							section(`OOC submitted by <@${event.user}>`),
							actions(
								button('Approve').id('approve').value(buttonValue).style('primary'),
								button('Reject (not OOC)').id('reject_ooc').value(buttonValue),
								button('Reject (COC)').id('reject_coc').value(buttonValue).style('danger'),
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

		const submission = await updateSubmissionStatus(id, 'APPROVED')
		if (!submission) {
			return event.respond
				.message({ ephemeral: true, text: 'Cannot find submission.' })
				.catch((e) => console.error('Failed to respond to failed approval:', e))
		}

		logAudit({
			action: 'submission.approve',
			actorId: userId,
			resourceType: 'submission',
			resourceId: id,
		})

		try {
			await app
				.channel(event.event.container.channel_id)
				.message(event.event.container.message_ts)
				.edit({
					blocks: blocks(
						section(
							`OOC submitted by <@${submission.submitterId}> - :white_check_mark: approved by <@${userId}>`,
						),
					),
				})
			// const { channel, ts } = await userClient.request('chat.shareMessage', {
			// 	channel: submission.forwardedChannelId,
			// 	timestamp: submission.forwardedMessageTs,
			// 	share_channel: await getUserBotDM(),
			// })
			// const { permalink } = (await app.request('chat.getPermalink', {
			// 	channel,
			// 	message_ts: ts,
			// })) as { ok: true; permalink: string }
			// await app.channel(config.slack.channelId).send({ text: `${permalink}`, unfurl_links: true })

			const { channel, ts } = await forwardMessageFromUser(
				submission.forwardedChannelId,
				submission.forwardedMessageTs,
				config.slack.channelId,
				{ text: `<@${submission.submitterId}>` },
			)
			await app
				.channel(channel)
				.message(ts)
				.edit({
					blocks: blocks(
						context(
							image('user pfp').url(`https://cachet.dunkirk.sh/users/${submission.submitterId}/r`),
							`<@${submission.submitterId}>`,
						),
					),
				})
		} catch (e) {
			console.error('Failed to approve OOC:', e)
		}
	})
}
