import type { App } from '@slack/bolt';
import { DeleteSubmission } from '../../../application/use-cases/DeleteSubmission.js';
import { GetUserStatus } from '../../../application/use-cases/GetUserStatus.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();
const getUserStatus = new GetUserStatus(userRepository, submissionRepository);
const deleteSubmission = new DeleteSubmission(submissionRepository);

export const registerCommandHandlers = (app: App) => {
  /**
   * /status handler
   */
  app.command('/b-status', async ({ ack, body, respond }) => {
    await ack();
    const slackId = body.user_id;

    const status = await getUserStatus.execute(slackId);

    if (!status.isRegistered) {
      await respond("You're not registered as you haven't submitted anything yet! Send me a message link in DM to get started.");
      return;
    }

    const sections: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '*Your \'Out of Context\' Status*\n' +
            `Approved: ${status.stats.approved}\n` +
            `Rejected: ${status.stats.rejected}\n` +
            `Explicit: ${status.stats.explicit}\n` +
            `Trusted: ${status.isTrusted ? 'Yes' : 'No'}\n` +
            `Banned: ${status.isBanned ? 'Yes' : 'No'}`,
        },
      },
    ];

    if (status.pendingSubmissions.length > 0) {
      sections.push({ type: 'divider' });
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '*Pending Submissions*' },
      });

      for (const sub of status.pendingSubmissions) {
        sections.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${sub.link}|View Submission>\nID: \`${sub.id}\` | Queue Position: #${sub.queuePosition}`,
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Delete' },
            style: 'danger',
            action_id: 'delete_submission',
            value: sub.id,
          },
        });
      }
    } else {
      sections.push({ type: 'divider' });
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '_You have no pending submissions._' },
      });
    }

    await respond({ blocks: sections });
  });

  /**
   * /delete handler (supports both manual ID and interactive listing)
   */
  app.command('/b-delete', async ({ ack, body, respond }) => {
    await ack();
    const slackId = body.user_id;
    const text = body.text.trim();

    if (text) {
      const result = await deleteSubmission.execute({ slackId, submissionId: text });
      await respond(result.message);
    } else {
      const status = await getUserStatus.execute(slackId);
      const pending = status.pendingSubmissions;

      if (pending.length === 0) {
        await respond('You have no pending submissions to delete.');
        return;
      }

      const blocks: any[] = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Select a submission to delete:*' },
        },
      ];

      for (const sub of pending) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `<${sub.link}|View Link>\nID: \`${sub.id}\`` },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Delete' },
            style: 'danger',
            action_id: 'delete_submission',
            value: sub.id,
          },
        });
      }

      await respond({ blocks });
    }
  });
};
