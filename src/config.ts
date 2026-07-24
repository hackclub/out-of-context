export const config = {
	port: process.env.PORT || '8000',
	slack: {
		userId: process.env.SLACK_USER_ID,
		channelId: process.env.SLACK_OOC_CHANNEL,
		reviewChannelId: process.env.SLACK_REVIEW_CHANNEL,
	},
}
