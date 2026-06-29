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
    const msg = s.message as any;
    const domain = s.team?.domain ?? s.user.team_id ?? 'hackclub';
    const slackLink = buildPermalink(domain, channelId, s.message_ts);

    const imageFile = msg.files?.find((f: any) => f.mimetype?.startsWith('image/'));

    const result = await submitLink.execute({
      slackId,
      slackLink,
      originalText: (msg.text as string | undefined) || undefined,
      originalAuthorId: (msg.user as string | undefined) || undefined,
      originalImageUrl: imageFile?.url_private as string | undefined,
    });

    await client.chat.postMessage({ channel: slackId, text: result.message }).catch((e: unknown) => {
      logger.error('[shortcut] Failed to DM user:', e);
    });
  });
};
