import { App } from 'slack.ts'

export const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	receiver: { type: 'fetch', signingSecret: process.env.SLACK_SIGNING_SECRET },
})

export const userApp = new App({
	token: process.env.SLACK_USER_TOKEN,
})
