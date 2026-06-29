import type { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { config } from '../../../config/index.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';

const userRepository = new PrismaUserRepository();

let _userClient: WebClient | undefined;
function getUserClient(): WebClient | undefined {
  if (!config.slack.userToken) return undefined;
  if (!_userClient) _userClient = new WebClient(config.slack.userToken);
  return _userClient;
}

export const registerChannelHandler = (app: App) => {
  if (!config.slack.oocChannelId) return;

  app.message(async ({ message, client, logger }) => {
    const msg = message as any;

    if (msg.channel !== config.slack.oocChannelId) return;
    if (msg.subtype || msg.bot_id) return;
    if (msg.thread_ts) return; // thread replies are allowed for everyone

    const slackId = msg.user as string | undefined;
    if (!slackId) return;

    // Super admin is always allowed even if not in the DB yet
    if (config.slack.superAdminId && slackId === config.slack.superAdminId) return;

    const user = await userRepository.findBySlackId(slackId).catch(() => null);
    if (user?.isTrusted) return;

    // Delete the message — requires SLACK_USER_TOKEN from a workspace admin with chat:write scope
    const userClient = getUserClient();
    if (userClient) {
      await userClient.chat
        .delete({ channel: config.slack.oocChannelId, ts: msg.ts })
        .catch((err: unknown) => logger.error('[channel] Failed to delete message:', err));
    } else {
      logger.warn('[channel] SLACK_USER_TOKEN not set — cannot delete message, only DM sent');
    }

    await client.chat
      .postMessage({
        channel: slackId,
        text:
          `Hey! You can't post directly to <#${config.slack.oocChannelId}> yet, posts go through a moderation queue.\n\n` +
          'To share a message, right-click it and choose *Submit to #out-of-context*. ' +
          "Once you have enough approved posts you'll be promoted to trusted status and can post directly.",
      })
      .catch((err: unknown) => logger.error('[channel] Failed to DM user:', err));
  });
};
