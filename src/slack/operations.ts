import type { AnyBlock } from '@slack/types'
import { app, userApp, userClient } from '.'
import { config } from '../config'

let userBotDm: string | null = null

export async function getUserBotDM() {
	return userBotDm || (userBotDm = (await app.user(config.slack.userId).im()).id)
}

export async function forwardMessageFromUser(
	sourceChannel: string,
	sourceTs: string,
	destinationChannel: string,
	params?: { text?: string; blocks?: AnyBlock[]; username?: string; icon_url?: string },
) {
	const dm = await getUserBotDM()

	const result = await userClient.request('chat.shareMessage', {
		channel: sourceChannel,
		timestamp: sourceTs,
		share_channel: dm,
	})

	return app.request('chat.shareMessage', {
		channel: dm,
		timestamp: result.ts,
		share_channel: destinationChannel,
		...{ ...params, blocks: params?.blocks ? JSON.stringify(params.blocks) : undefined },
	})
}
