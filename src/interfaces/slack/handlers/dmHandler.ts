import type { App } from '@slack/bolt';
import { SubmitLink } from '../../../application/use-cases/SubmitLink.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';
import { extractSlackLink } from '../../../shared/utils/slack-link-validator.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();

export const registerDMHandler = (app: App) => {
  const submitLinkUseCase = new SubmitLink(userRepository, submissionRepository, app.client);

  app.message(async ({ message, say, logger }) => {
    if (message.channel_type !== 'im') return;

    if (!('text' in message) || !message.text) return;

    const slackId = message.user as string;
    if (!slackId) return;

    const text = (message as any).text || '';

    const link = extractSlackLink(text);

    if (!link) {
      await say(
        "Hello! Please send me a Slack message link to submit it to #out-of-context. If you're looking for help, try `/status`.",
      );
      return;
    }

    const response = await submitLinkUseCase.execute({
      slackId,
      slackLink: link,
    });

    await say(response.message);
  });
};
