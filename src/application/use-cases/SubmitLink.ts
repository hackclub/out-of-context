import type { WebClient } from '@slack/web-api';
import { Submission, SubmissionStatus } from '../../domain/entities/Submission.js';
import { User, UserRole } from '../../domain/entities/User.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { logger } from '../../shared/utils/logger.js';
import { postToOocChannel } from '../../shared/utils/ooc-post.js';

export interface SubmitLinkRequest {
  slackId: string;
  slackLink: string;
  originalText?: string;
  originalAuthorId?: string;
  originalImageUrl?: string;
}

export interface SubmitLinkResponse {
  submissionId?: string;
  status: 'pending' | 'approved' | 'banned' | 'opted_out' | 'error';
  message: string;
  originalAuthorId?: string;
}

export class SubmitLink {
  constructor(
    private userRepository: IUserRepository,
    private submissionRepository: ISubmissionRepository,
    private slackClient: WebClient,
  ) {}

  async execute(request: SubmitLinkRequest): Promise<SubmitLinkResponse> {
    try {
      let user = await this.userRepository.findBySlackId(request.slackId);

      if (!user) {
        user = new User({
          slackId: request.slackId,
          isTrusted: false,
          isBanned: false,
          optedOut: false,
          role: UserRole.USER,
          approvedCount: 0,
          rejectedCount: 0,
          explicitRejectionCount: 0,
        });
        await this.userRepository.save(user);
      }

      if (user.isBanned) {
        return {
          status: 'banned',
          message: 'You are currently banned from submitting to Out of Context.',
        };
      }

      if (request.originalAuthorId && request.originalAuthorId !== request.slackId) {
        const author = await this.userRepository.findBySlackId(request.originalAuthorId);
        if (author?.optedOut) {
          return {
            status: 'opted_out',
            message: 'This user has opted out of Out of Context submissions.',
            originalAuthorId: request.originalAuthorId,
          };
        }
      }

      const isTrusted = user.isTrusted;
      const status = isTrusted ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING;

      const submission = new Submission({
        slackLink: request.slackLink,
        status: status,
        submitterId: user.slackId,
        originalText: request.originalText,
        originalAuthorId: request.originalAuthorId,
        originalImageUrl: request.originalImageUrl,
      });

      const savedSubmission = await this.submissionRepository.save(submission);

      if (isTrusted) {
        try {
          const originalContent =
            request.originalText || request.originalImageUrl
              ? {
                  text: request.originalText ?? '',
                  authorId: request.originalAuthorId ?? user.slackId,
                  imageUrl: request.originalImageUrl,
                }
              : undefined;
          postToOocChannel(
            this.slackClient,
            submission.slackLink,
            user.slackId,
            originalContent,
            this.submissionRepository,
            savedSubmission.id,
          );
          await this.userRepository.updateStats(user.slackId, { approved: 1 });
        } catch (error) {
          logger.error('Failed to post trusted submission:', error);
        }

        return {
          submissionId: savedSubmission.id,
          status: 'approved',
          message: 'Your submission has been automatically approved and posted! (Trusted User). stay a goodboy',
        };
      }

      return {
        submissionId: savedSubmission.id,
        status: 'pending',
        message: "Your submission has been received and is waiting for moderator review. won't take long!",
      };
    } catch (error) {
      logger.error('[SubmitLink] error:', error);
      return {
        status: 'error',
        message:
          error instanceof Error && error.message === 'Invalid Slack message link'
            ? "That doesn't look like a valid Slack message link."
            : 'Something went wrong, please try again.',
      };
    }
  }
}
