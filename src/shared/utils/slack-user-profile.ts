import type { WebClient } from '@slack/web-api';

export interface SlackUserProfile {
  displayName: string;
  iconUrl?: string;
}

export async function fetchUserProfile(client: WebClient, slackId: string): Promise<SlackUserProfile> {
  try {
    const result = await client.users.info({ user: slackId });
    const profile = result.user?.profile;
    return {
      displayName: profile?.display_name || result.user?.real_name || 'Unknown',
      iconUrl: profile?.image_192 || profile?.image_72 || undefined,
    };
  } catch (error) {
    console.error('Failed to fetch Slack user profile:', error);
    return { displayName: 'Unknown' };
  }
}
