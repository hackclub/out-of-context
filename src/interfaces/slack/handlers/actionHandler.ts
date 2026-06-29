import type { App } from '@slack/bolt';
import { DeleteSubmission } from '../../../application/use-cases/DeleteSubmission.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';

const submissionRepository = new PrismaSubmissionRepository();
const deleteSubmission = new DeleteSubmission(submissionRepository);

export const registerActionHandlers = (app: App) => {
  app.action('delete_submission', async ({ ack, body, action, respond }) => {
    await ack();

    const slackId = body.user.id;
    const submissionId = 'value' in action ? action.value : '';

    if (!submissionId) return;

    const result = await deleteSubmission.execute({ slackId, submissionId });

    await respond({
      text: result.message,
      replace_original: result.success,
    });
  });
};
