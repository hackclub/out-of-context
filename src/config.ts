export const config = {
	port: process.env.PORT || '8000',
	superAdminId: process.env.SUPERADMIN_USER_ID,
	slack: {
		userId: process.env.SLACK_USER_ID,
		channelId: process.env.SLACK_OOC_CHANNEL,
		reviewChannelId: process.env.SLACK_REVIEW_CHANNEL,
		commandPrefix: process.env.SLACK_COMMAND_PREFIX || '',
	},
}
