import type { App } from '@slack/bolt';
import { ReviewSubmission } from '../../../application/use-cases/ReviewSubmission.js';
import { UpdateUserTrust } from '../../../application/use-cases/UpdateUserTrust.js';
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
  app.command('/b-mod-queue', async ({ ack, body, respond }) => {
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
   * /grant-trust
   */
  app.command('/b-grant-trust', async ({ ack, body, client, logger }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'user_trust_modal',
          private_metadata: JSON.stringify({ action: 'GRANT' }),
          title: { type: 'plain_text', text: 'OOC Moderation' },
          submit: { type: 'plain_text', text: 'Grant Trust' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Grant Trusted Status' },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Granting *Trusted* status allows a user to bypass the moderation queue. Their posts will appear in the OOC channel *immediately*.\n\n_Use this for regular, reliable contributors._',
              },
            },
            { type: 'divider' },
            {
              type: 'section',
              block_id: 'user_select_block',
              text: { type: 'mrkdwn', text: '*Select User*' },
              accessory: {
                type: 'users_select',
                action_id: 'selected_user',
                placeholder: { type: 'plain_text', text: 'Search members...' },
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'The user will be notified via DM when trust is granted.',
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      logger.error('Failed to open grant-trust modal', error);
    }
  });

  /**
   * /revoke-trust
   */
  app.command('/b-revoke-trust', async ({ ack, body, client, logger }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'user_trust_modal',
          private_metadata: JSON.stringify({ action: 'REVOKE' }),
          title: { type: 'plain_text', text: 'OOC Moderation' },
          submit: { type: 'plain_text', text: 'Revoke Trust' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Revoke Trusted Status' },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: "Revoking *Trusted* status means this user's future submissions will require manual approval by a moderator before being posted.",
              },
            },
            { type: 'divider' },
            {
              type: 'section',
              block_id: 'user_select_block',
              text: { type: 'mrkdwn', text: '*Select User*' },
              accessory: {
                type: 'users_select',
                action_id: 'selected_user',
                placeholder: { type: 'plain_text', text: 'Search members...' },
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'The user will be notified via DM when trust is revoked.',
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      logger.error('Failed to open revoke-trust modal', error);
    }
  });

  /**
   * Modal submission handler
   */
  app.view('user_trust_modal', async ({ ack, body, view, client, logger }) => {
    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const action = metadata.action; // 'GRANT' or 'REVOKE'
    const moderatorId = body.user.id;

    const values = view.state.values;
    const targetUserId = values.user_select_block.selected_user.selected_user;

    if (!targetUserId) {
      logger.error('No user selected in trust modal');
      return;
    }

    const isTrusted = action === 'GRANT';
    const updateUserTrust = new UpdateUserTrust(userRepository, client);

    const result = await updateUserTrust.execute({
      slackId: targetUserId,
      isTrusted,
      moderatorId,
    });

    try {
      await client.chat.postMessage({
        channel: moderatorId,
        text: `${result.message}`,
      });
    } catch (error) {
      logger.error('Failed to notify moderator of trust update', error);
    }
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
