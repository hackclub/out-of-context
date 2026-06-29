import { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import { logger } from './logger.js';

export interface FetchedMessage {
  text: string;
  authorId?: string;
  imageUrl?: string;
}

let _userClient: WebClient | undefined;
function getUserClient(): WebClient | undefined {
  if (!config.slack.userToken) return undefined;
  if (!_userClient) _userClient = new WebClient(config.slack.userToken);
  return _userClient;
}

async function fetchWithClient(client: WebClient, channelId: string, ts: string): Promise<FetchedMessage | null> {
  const result = await client.conversations.history({
    channel: channelId,
    latest: ts,
    oldest: ts,
    inclusive: true,
    limit: 1,
  });

  const message = result.messages?.[0];
  if (!message) return null;

  const file = (message as any).files?.[0];
  const imageUrl = file?.mimetype?.startsWith('image/') ? (file.url_private as string | undefined) : undefined;

  return {
    text: message.text || '',
    authorId: message.user,
    imageUrl,
  };
}

export async function fetchOriginalMessage(client: WebClient, slackLink: string): Promise<FetchedMessage | null> {
  const match = slackLink.match(/\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})/);
  if (!match) return null;

  const channelId = match[1];
  const ts = `${match[2]}.${match[3]}`;

  const userClient = getUserClient();
  if (userClient) {
    try {
      const result = await fetchWithClient(userClient, channelId, ts);
      if (result) return result;
    } catch {
    }
  }

  try {
    return await fetchWithClient(client, channelId, ts);
  } catch (error) {
    logger.error('[ooc] Failed to fetch original message:', error);
    return null;
  }
}
