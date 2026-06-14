import type { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import { Submission, SubmissionStatus } from '../../domain/entities/Submission.js';
import { User, UserRole } from '../../domain/entities/User.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';

export interface SubmitLinkRequest {
  slackId: string;
  slackLink: string;
}

export interface SubmitLinkResponse {
  submissionId?: string;
  status: 'pending' | 'approved' | 'banned' | 'error';
  message: string;
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

      const isTrusted = user.isTrusted;
      const status = isTrusted ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING;

      const submission = new Submission({
        slackLink: request.slackLink,
        status: status,
        submitterId: user.slackId,
      });

      const savedSubmission = await this.submissionRepository.save(submission);

      if (isTrusted) {
        try {
          await this.slackClient.chat.postMessage({
            channel: config.slack.oocChannelId,
            text: `New OOC post from <@${user.slackId}> (Trusted User):\n${submission.slackLink}`,
            unfurl_links: true,
          });

          await this.userRepository.updateStats(user.slackId, { approved: 1 });
        } catch (error) {
          console.error('Failed to post trusted submission:', error);
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
        message: "Your submission has been received and is waiting for moderator review. dw won't take long",
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      };
    }
  }
}
