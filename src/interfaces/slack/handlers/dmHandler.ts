import type { App } from '@slack/bolt';
import { config } from '../../../config/index.js';

export const registerDMHandler = (app: App) => {
  app.message(async ({ message, say }) => {
    const msg = message as any;
    if (msg.channel_type !== 'im') return;
    if (msg.bot_id || msg.subtype) return;

    const channelMention = config.slack.oocChannelId
      ? `<#${config.slack.oocChannelId}>`
      : '#out-of-context';

    await say(
      `Hey! Submissions to ${channelMention} go through the message shortcut — ` +
        'right-click any message and choose *Submit to #out-of-context*.\n\n' +
        'Use `/b-status` to check your submission history.',
    );
  });
};
