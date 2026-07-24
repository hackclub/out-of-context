declare module 'bun' {
	interface Env {
		DATABASE_URL: string

		SLACK_USER_ID: string
		SLACK_OOC_CHANNEL: string
		SLACK_REVIEW_CHANNEL: string

		SLACK_BOT_TOKEN: string
		SLACK_USER_TOKEN: string
		SLACK_XOXD_TOKEN: string
		SLACK_XOXC_TOKEN: string
		SLACK_SIGNING_SECRET: string
	}
}
