declare module 'bun' {
	interface Env {
		DATABASE_URL: string

		SLACK_BOT_TOKEN: string
		SLACK_USER_TOKEN: string
		SLACK_SIGNING_SECRET: string
	}
}
