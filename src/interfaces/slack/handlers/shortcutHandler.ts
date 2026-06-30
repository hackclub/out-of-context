import type { App, MessageShortcut } from '@slack/bolt';
import { SubmitLink } from '../../../application/use-cases/SubmitLink.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();

function buildPermalink(domain: string, channelId: string, ts: string): string {
  return `https://${domain}.slack.com/archives/${channelId}/p${ts.replace('.', '')}`;
}

export const registerShortcutHandler = (app: App) => {
  const submitLink = new SubmitLink(userRepository, submissionRepository, app.client);

  app.shortcut('submit_to_ooc', async ({ shortcut, ack, client, logger }) => {
    await ack();

    const s = shortcut as MessageShortcut;
    const slackId = s.user.id;
    const channelId = s.channel.id;
    type SlackFile = { mimetype?: string; url_private?: string };
    type Msg = { text?: string; user?: string; files?: SlackFile[] };
    const msg = s.message as Msg;
    const domain = s.team?.domain ?? s.user.team_id ?? 'hackclub';
    const slackLink = buildPermalink(domain, channelId, s.message_ts);

    const imageFile = msg.files?.find((f) => f.mimetype?.startsWith('image/'));

    const result = await submitLink.execute({
      slackId,
      slackLink,
      originalText: msg.text || undefined,
      originalAuthorId: msg.user || undefined,
      originalImageUrl: imageFile?.url_private,
    });

    if (result.status === 'opted_out') {
      await client.chat
        .postEphemeral({ channel: channelId, user: slackId, text: result.message })
        .catch((e: unknown) => {
          logger.error('[shortcut] Failed to send opted-out ephemeral:', e);
        });
      return;
    }

    await client.chat.postMessage({ channel: slackId, text: result.message }).catch((e: unknown) => {
      logger.error('[shortcut] Failed to DM user:', e);
    });
  });
};
