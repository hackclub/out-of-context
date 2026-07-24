import { App } from 'slack.ts'

export const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
})

export const userApp = new App({
	token: process.env.SLACK_USER_TOKEN,
	receiver: { type: 'fetch', signingSecret: process.env.SLACK_SIGNING_SECRET },
})

export const userClient = new App({
	token: {
		cookie: encodeURIComponent(process.env.SLACK_XOXD_TOKEN),
		token: process.env.SLACK_XOXC_TOKEN,
	},
})
