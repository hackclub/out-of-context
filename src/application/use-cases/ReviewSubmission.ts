import type { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { SubmissionStatus } from '../../domain/entities/Submission.js';
import { User } from '../../domain/entities/User.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { postToOocChannel } from '../../shared/utils/ooc-post.js';

export interface ReviewSubmissionRequest {
  submissionId: string;
  moderatorId: string;
  action: 'APPROVE' | 'REJECT_OOC' | 'REJECT_EXPLICIT';
  notes?: string;
}

export interface ReviewSubmissionResponse {
  success: boolean;
  message: string;
}

export class ReviewSubmission {
  constructor(
    private userRepository: IUserRepository,
    private submissionRepository: ISubmissionRepository,
    private slackClient: WebClient,
  ) { }

  async execute(request: ReviewSubmissionRequest): Promise<ReviewSubmissionResponse> {
    const submission = await this.submissionRepository.findById(request.submissionId);

    if (!submission) {
      return { success: false, message: 'Submission not found.' };
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      return { success: false, message: `Submission is already ${submission.status.toLowerCase()}.` };
    }

    const submitter = await this.userRepository.findBySlackId(submission.submitterId);
    if (!submitter) {
      return { success: false, message: 'Submitter not found.' };
    }

    if (request.action === 'APPROVE') {
      submission.approve(request.notes);
      await this.submissionRepository.save(submission);

      await this.userRepository.updateStats(submitter.slackId, { approved: 1 });

      try {
        const originalContent =
          submission.originalText || submission.originalImageUrl
            ? {
              text: submission.originalText ?? '',
              authorId: submission.originalAuthorId ?? submission.submitterId,
              imageUrl: submission.originalImageUrl,
            }
            : undefined;
        postToOocChannel(
          this.slackClient,
          submission.slackLink,
          submitter.slackId,
          originalContent,
          this.submissionRepository,
          submission.id,
        );
      } catch (error) {
        logger.error('Failed to post to OOC channel:', error);
      }

      try {
        await this.slackClient.chat.postMessage({
          channel: submitter.slackId,
          text: `Your submission was approved and posted to <#${config.slack.oocChannelId}>!`,
        });
      } catch (error) {
        logger.error('Failed to notify submitter:', error);
      }

      await this.maybePromoteToTrusted(submitter.slackId);
    } else {
      const isExplicit = request.action === 'REJECT_EXPLICIT';
      submission.reject(isExplicit, request.notes);
      await this.submissionRepository.save(submission);

      await this.userRepository.updateStats(submitter.slackId, {
        rejected: isExplicit ? 0 : 1,
        explicit: isExplicit ? 1 : 0,
      });

      const rejectionReason = isExplicit
        ? 'It was flagged as Explicit/NSFW content.'
        : 'It was determined not to be "Out of Context" material.';

      try {
        await this.slackClient.chat.postMessage({
          channel: submitter.slackId,
          text: `Your submission was rejected.\n*Reason:* ${rejectionReason}${request.notes ? `\n*Moderator Note:* ${request.notes}` : ''}`,
        });
      } catch (error) {
        logger.error('Failed to notify submitter of rejection:', error);
      }
    }

    const actionLabel = request.action === 'APPROVE' ? 'approved' : 'rejected';
    return { success: true, message: `Submission ${actionLabel} successfully.` };
  }

  private async maybePromoteToTrusted(slackId: string): Promise<void> {
    const user = await this.userRepository.findBySlackId(slackId);
    if (!user || user.isTrusted || !user.isEligibleForTrust(config)) return;

    const promoted = new User({ ...user.toJSON(), isTrusted: true });
    await this.userRepository.save(promoted);

    try {
      await this.slackClient.chat.postMessage({
        channel: slackId,
        text: `Congratulations! You've been automatically promoted to *Trusted Contributor* status.\n\nYour future submissions will be posted directly to <#${config.slack.oocChannelId}> without waiting for moderator review.`,
      });
    } catch (error) {
      logger.error('Failed to notify user of trust promotion:', error);
    }
  }
}
