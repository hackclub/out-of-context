export interface Config {
  moderation: {
    approvedPostsForTrust: number;
    maxExplicitRejectionsForTrust: number;
    explicitRejectionWindowDays: number;
    explicitRejectionsBeforeBan: number;
    defaultOocBanDays: number;
    warningThresholds: number[];
    cooldownThresholds: {
      submissions: number;
      windowMinutes: number;
    };
    cooldownDurationMinutes: number;
    trustedReviewEnabled: boolean;
  };
  slack: {
    oocChannelId: string;
    superAdminId: string;
  };
}

export const config: Config = {
  moderation: {
    approvedPostsForTrust: Number(process.env.APPROVED_POSTS_FOR_TRUST) || 5,
    maxExplicitRejectionsForTrust: Number(process.env.MAX_EXPLICIT_REJECTIONS_FOR_TRUST) || 0,
    explicitRejectionWindowDays: Number(process.env.EXPLICIT_REJECTION_WINDOW_DAYS) || 30,
    explicitRejectionsBeforeBan: Number(process.env.EXPLICIT_REJECTIONS_BEFORE_BAN) || 3,
    defaultOocBanDays: Number(process.env.DEFAULT_OOC_BAN_DAYS) || 7,
    warningThresholds: [1, 2],
    cooldownThresholds: {
      submissions: Number(process.env.COOLDOWN_SUBMISSIONS_LIMIT) || 5,
      windowMinutes: Number(process.env.COOLDOWN_WINDOW_MINUTES) || 60,
    },
    cooldownDurationMinutes: Number(process.env.COOLDOWN_DURATION_MINUTES) || 30,
    trustedReviewEnabled: process.env.TRUSTED_REVIEW_ENABLED === 'true' || true,
  },
  slack: {
    oocChannelId: process.env.SLACK_OOC_CHANNEL_ID || '',
    superAdminId: process.env.SLACK_SUPER_ADMIN_ID || '',
  },
};
