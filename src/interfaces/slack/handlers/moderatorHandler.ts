import type { App } from '@slack/bolt';
import { ReviewSubmission } from '../../../application/use-cases/ReviewSubmission.js';
import { UpdateUserRole } from '../../../application/use-cases/UpdateUserRole.js';
import { UpdateUserTrust } from '../../../application/use-cases/UpdateUserTrust.js';
import { UserRole } from '../../../domain/entities/User.js';
import { PrismaSubmissionRepository } from '../../../infrastructure/repositories/PrismaSubmissionRepository.js';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository.js';

const userRepository = new PrismaUserRepository();
const submissionRepository = new PrismaSubmissionRepository();

// handles: <@U123456>, <@U123456|name>, or bare user ID (U123...).
// Typed @mentions are auto-converted by Slack to <@U...> before the handler sees them.
function resolveUserId(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const mentionMatch = trimmed.match(/^<@([A-Z0-9]+)(?:\|[^>]*)?>$/);
  if (mentionMatch) return mentionMatch[1];

  if (/^[A-Z0-9]{8,12}$/.test(trimmed)) return trimmed;

  return undefined;
}

export const registerModeratorHandlers = (app: App) => {
  const reviewSubmission = new ReviewSubmission(userRepository, submissionRepository, app.client);
  const updateUserRole = new UpdateUserRole(userRepository, app.client);

  const isAdmin = async (slackId: string) => {
    const user = await userRepository.findBySlackId(slackId);
    return user?.isAdmin() || false;
  };

  const isSuperAdmin = async (slackId: string) => {
    const user = await userRepository.findBySlackId(slackId);
    return user?.isSuperAdmin() || false;
  };

  /**
   * /b-mod-queue
   */
  app.command('/b-mod-queue', async ({ ack, body, respond }) => {
    await ack();
    if (!body.channel_id?.startsWith('D')) {
      await respond({ text: 'This command can only be used in a DM with the bot.', response_type: 'ephemeral' });
      return;
    }

    if (!(await isAdmin(body.user_id))) {
      await respond('You do not have permission to access the moderation queue.');
      return;
    }

    const pending = await submissionRepository.getPendingQueue();

    if (pending.length === 0) {
      await respond('The moderation queue is empty!');
      return;
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📋 Moderation Queue', emoji: true },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `There are currently *${pending.length}* submissions waiting for review.`,
          },
        ],
      },
      { type: 'divider' },
    ];

    for (const sub of pending) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Submission from <@${sub.submitterId}>*\n<${sub.slackLink}|View Original Message>`,
        },
      });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Approve', emoji: true },
            style: 'primary',
            action_id: 'approve_submission',
            value: sub.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '✖️ Reject (OOC)', emoji: true },
            action_id: 'reject_ooc',
            value: sub.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🚫 Reject (Explicit)', emoji: true },
            style: 'danger',
            action_id: 'reject_explicit',
            value: sub.id,
          },
        ],
      });
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `ID: \`${sub.id}\`` }],
      });
      blocks.push({ type: 'divider' });
    }

    await respond({ blocks });
  });

  /**
   * /b-grant-trust
   */
  app.command('/b-grant-trust', async ({ ack, body, client, logger, respond }) => {
    await ack();

    if (!(await isAdmin(body.user_id))) {
      await respond('You do not have permission to manage user trust.');
      return;
    }

    const targetUserId = resolveUserId(body.text);
    if (targetUserId) {
      const result = await new UpdateUserTrust(userRepository, client).execute({
        slackId: targetUserId,
        isTrusted: true,
        moderatorId: body.user_id,
      });
      await respond(result.message);
      return;
    }

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'user_trust_modal',
          private_metadata: JSON.stringify({ action: 'GRANT' }),
          title: { type: 'plain_text', text: 'OOC: Grant Trust' },
          submit: { type: 'plain_text', text: 'Confirm Grant' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
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
                  text: 'The user will receive a notification DM when trust is granted.',
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
   * /b-revoke-trust
   */
  app.command('/b-revoke-trust', async ({ ack, body, client, logger, respond }) => {
    await ack();

    if (!(await isAdmin(body.user_id))) {
      await respond('You do not have permission to manage user trust.');
      return;
    }

    const targetUserId = resolveUserId(body.text);
    if (targetUserId) {
      const result = await new UpdateUserTrust(userRepository, client).execute({
        slackId: targetUserId,
        isTrusted: false,
        moderatorId: body.user_id,
      });
      await respond(result.message);
      return;
    }

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'user_trust_modal',
          private_metadata: JSON.stringify({ action: 'REVOKE' }),
          title: { type: 'plain_text', text: 'OOC: Revoke Trust' },
          submit: { type: 'plain_text', text: 'Confirm Revoke' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
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
                  text: 'The user will receive a notification DM when trust is revoked.',
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
   * /b-grant-admin
   */
  app.command('/b-grant-admin', async ({ ack, body, client, logger, respond }) => {
    await ack();

    if (!(await isSuperAdmin(body.user_id))) {
      await respond('Only Super Admins can grant admin privileges.');
      return;
    }

    const targetUserId = resolveUserId(body.text);
    if (targetUserId) {
      const result = await updateUserRole.execute({
        targetSlackId: targetUserId,
        newRole: UserRole.ADMIN,
        actorSlackId: body.user_id,
      });
      await respond(result.message);
      return;
    }

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'admin_role_modal',
          private_metadata: JSON.stringify({ action: 'GRANT' }),
          title: { type: 'plain_text', text: 'OOC Administration' },
          submit: { type: 'plain_text', text: 'Grant Admin' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Grant Admin Privileges' },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Promoting a user to *Admin* allows them to:\n- View and manage the moderation queue\n- Grant/Revoke trust status to users\n\n_Use this for trusted community moderators._',
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
          ],
        },
      });
    } catch (error) {
      logger.error('Failed to open grant-admin modal', error);
    }
  });

  /**
   * /b-revoke-admin
   */
  app.command('/b-revoke-admin', async ({ ack, body, client, logger, respond }) => {
    await ack();

    if (!(await isSuperAdmin(body.user_id))) {
      await respond('Only Super Admins can revoke admin privileges.');
      return;
    }

    const targetUserId = resolveUserId(body.text);
    if (targetUserId) {
      const result = await updateUserRole.execute({
        targetSlackId: targetUserId,
        newRole: UserRole.USER,
        actorSlackId: body.user_id,
      });
      await respond(result.message);
      return;
    }

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'admin_role_modal',
          private_metadata: JSON.stringify({ action: 'REVOKE' }),
          title: { type: 'plain_text', text: 'OOC Administration' },
          submit: { type: 'plain_text', text: 'Revoke Admin' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Revoke Admin Privileges' },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Revoking *Admin* privileges will demote the user back to a regular member status.',
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
          ],
        },
      });
    } catch (error) {
      logger.error('Failed to open revoke-admin modal', error);
    }
  });

  /**
   * Admin Role Modal submission handler
   */
  app.view('admin_role_modal', async ({ ack, body, view, client, logger }) => {
    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const action = metadata.action; // 'GRANT' or 'REVOKE'
    const superAdminId = body.user.id;

    if (!(await isSuperAdmin(superAdminId))) {
      await client.chat
        .postMessage({ channel: superAdminId, text: 'You do not have permission to manage admin roles.' })
        .catch((e) => logger.error('[admin_role_modal] Failed to notify unauthorized user', e));
      return;
    }

    const values = view.state.values;
    const targetUserId = values.user_select_block.selected_user.selected_user;

    if (!targetUserId) {
      logger.error('No user selected in admin role modal');
      return;
    }

    const newRole = action === 'GRANT' ? UserRole.ADMIN : UserRole.USER;

    const result = await updateUserRole.execute({
      targetSlackId: targetUserId,
      newRole,
      actorSlackId: superAdminId,
    });

    try {
      await client.chat.postMessage({
        channel: superAdminId,
        text: result.message,
      });
    } catch (error) {
      logger.error('Failed to notify super admin of role update', error);
    }
  });

  /**
   * Modal submission handler for Trust
   */
  app.view('user_trust_modal', async ({ ack, body, view, client, logger }) => {
    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const action = metadata.action;
    const moderatorId = body.user.id;

    if (!(await isAdmin(moderatorId))) {
      await client.chat.postMessage({
        channel: moderatorId,
        text: '⛔ You do not have permission to perform this action.',
      });
      return;
    }

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
        text: result.message,
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
    if (!(await isAdmin(body.user.id))) {
      await respond('You do not have permission to review submissions.');
      return;
    }
    const result = await handleReview((action as any).value, body.user.id, 'APPROVE');
    await respond(result.message);
  });

  app.action('reject_ooc', async ({ ack, body, action, respond }) => {
    await ack();
    if (!(await isAdmin(body.user.id))) {
      await respond('You do not have permission to review submissions.');
      return;
    }
    const result = await handleReview((action as any).value, body.user.id, 'REJECT_OOC');
    await respond(result.message);
  });

  app.action('reject_explicit', async ({ ack, body, action, respond }) => {
    await ack();
    if (!(await isAdmin(body.user.id))) {
      await respond('You do not have permission to review submissions.');
      return;
    }
    const result = await handleReview((action as any).value, body.user.id, 'REJECT_EXPLICIT');
    await respond(result.message);
  });
};
