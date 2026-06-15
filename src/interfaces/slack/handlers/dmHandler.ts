import type { App } from '@slack/bolt';
import { SubmitLink } from '../../../application/use-cases/SubmitLink.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';
import { extractSlackLink } from '../../../shared/utils/slack-link-validator.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();

export const registerDMHandler = (app: App) => {
  const submitLinkUseCase = new SubmitLink(userRepository, submissionRepository, app.client);

  app.message(async ({ message, say }) => {
    if (message.channel_type !== 'im') return;

    const slackId = (message as any).user as string | undefined;
    if (!slackId) return;

    const msg = message as any;

    if (msg.subtype === 'file_share' && msg.files?.length) {
      const imageFile = msg.files.find((f: any) => f.mimetype?.startsWith('image/'));
      if (imageFile?.permalink) {
        const response = await submitLinkUseCase.execute({
          slackId,
          slackLink: imageFile.permalink,
          originalImageUrl: imageFile.url_private || undefined,
        });
        await say(response.message);
        return;
      }
    }

    if (msg.attachments?.length) {
      const attachment = msg.attachments[0];
      const fromUrl: string | undefined = attachment.from_url;

      if (fromUrl?.includes('slack.com/archives/')) {
        const imageFile =
          attachment.files?.find((f: any) => f.mimetype?.startsWith('image/')) ||
          msg.files?.find((f: any) => f.mimetype?.startsWith('image/'));
        const response = await submitLinkUseCase.execute({
          slackId,
          slackLink: fromUrl,
          originalText: attachment.text || attachment.fallback || undefined,
          originalAuthorId: attachment.author_id || undefined,
          originalImageUrl: attachment.image_url || imageFile?.url_private || undefined,
        });
        await say(response.message);
        return;
      }
    }

    const text = msg.text as string | undefined;
    if (!text) return;

    const link = extractSlackLink(text);
    if (!link) {
      await say(
        "Hello! Please forward or send me a Slack message link to submit it to #out-of-context. If you're looking for help, try `/b-status`.",
      );
      return;
    }

    const response = await submitLinkUseCase.execute({ slackId, slackLink: link });
    await say(response.message);
  });
};
