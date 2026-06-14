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
      await respond(
        "You're not registered as you haven't submitted anything yet! Send me a message link in DM to get started.",
      );
      return;
    }

    const user = await userRepository.findBySlackId(slackId);
    const roleLabel = user?.isSuperAdmin()
      ? 'Super Admin'
      : user?.isAdmin()
        ? 'Admin'
        : status.isTrusted
          ? 'Trusted Contributor'
          : 'Member (not trusted)';

    const totalRejected = status.stats.rejected + status.stats.explicit;
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '#out-of-context Profile',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status*\n ${status.isBanned ? 'Banned' : roleLabel}`,
          },
          {
            type: 'mrkdwn',
            text: `*Approved*\n ${status.stats.approved}`,
          },
          {
            type: 'mrkdwn',
            text: `*Rejected*\n ${totalRejected} *(${status.stats.explicit} explicit - ${status.stats.rejected} OOC)*`,
          },
          {
            type: 'mrkdwn',
            text: `*Pending*\n ${status.pendingSubmissions.length}`,
          },
        ],
      },
    ];

    if (status.pendingSubmissions.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Pending Review Queue',
          },
        ],
      });

      for (const sub of status.pendingSubmissions) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*#${sub.queuePosition} in queue*\n\`${sub.id}\``,
          },
        });
        blocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Submission',
              },
              url: sub.link,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Delete',
              },
              style: 'danger',
              action_id: 'delete_submission',
              value: sub.id,
              confirm: {
                title: { type: 'plain_text', text: 'Are you sure?' },
                text: { type: 'mrkdwn', text: 'Do you really want to delete this submission?' },
                confirm: { type: 'plain_text', text: 'Yes, delete it' },
                deny: { type: 'plain_text', text: 'Cancel' },
              },
            },
          ],
        });
      }
    } else {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_You have no pending submissions._',
          },
        ],
      });
    }

    await respond({ blocks });
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
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Remove Submission',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Select a submission to withdraw from the moderation queue:',
          },
        },
        { type: 'divider' },
      ];

      for (const sub of pending) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*#${sub.queuePosition} in queue*\n\`${sub.id}\``,
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Delete',
            },
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
