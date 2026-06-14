import type { App } from '@slack/bolt';
import { ReviewSubmission } from '../../../application/use-cases/ReviewSubmission.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();

export const registerModeratorHandlers = (app: App) => {
  const reviewSubmission = new ReviewSubmission(userRepository, submissionRepository, app.client);

  /**
   * Temporary command to view and manage the queue
   * In a real app, this would be a secure dashboard or restricted command.
   */
  app.command('/mod-queue', async ({ ack, body, respond }) => {
    await ack();

    const pending = await submissionRepository.getPendingQueue();

    if (pending.length === 0) {
      await respond('The moderation queue is empty!');
      return;
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📋 Moderation Queue' },
      },
    ];

    for (const sub of pending) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Submission from <@${sub.submitterId}>*\nLink: ${sub.slackLink}`,
        },
      });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: 'approve_submission',
            value: sub.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject (OOC)' },
            action_id: 'reject_ooc',
            value: sub.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject (Explicit)' },
            style: 'danger',
            action_id: 'reject_explicit',
            value: sub.id,
          },
        ],
      });
      blocks.push({ type: 'divider' });
    }

    await respond({ blocks });
  });

  /**
   * Action handlers for Approve/Reject
   */
  const handleReview = async (submissionId: string, moderatorId: string, action: any) => {
    return await reviewSubmission.execute({
      submissionId,
      moderatorId,
      action,
    });
  };

  app.action('approve_submission', async ({ ack, body, action, respond }) => {
    await ack();
    const result = await handleReview((action as any).value, body.user.id, 'APPROVE');
    await respond(result.message);
  });

  app.action('reject_ooc', async ({ ack, body, action, respond }) => {
    await ack();
    const result = await handleReview((action as any).value, body.user.id, 'REJECT_OOC');
    await respond(result.message);
  });

  app.action('reject_explicit', async ({ ack, body, action, respond }) => {
    await ack();
    const result = await handleReview((action as any).value, body.user.id, 'REJECT_EXPLICIT');
    await respond(result.message);
  });
};
