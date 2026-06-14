import { Submission, SubmissionStatus } from '../../domain/entities/Submission.js';
import { User } from '../../domain/entities/User.js';
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
  ) {}

  async execute(request: SubmitLinkRequest): Promise<SubmitLinkResponse> {
    try {
      let user = await this.userRepository.findBySlackId(request.slackId);

      if (!user) {
        user = new User({
          slackId: request.slackId,
          isTrusted: false,
          isBanned: false,
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

      const status = user.isTrusted ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING;

      const submission = new Submission({
        slackLink: request.slackLink,
        status: status,
        submitterId: user.slackId,
      });

      const savedSubmission = await this.submissionRepository.save(submission);

      if (user.isTrusted) {
        return {
          submissionId: savedSubmission.id,
          status: 'approved',
          message: 'Your submission has been automatically approved and posted! (Trusted User)',
        };
      }

      return {
        submissionId: savedSubmission.id,
        status: 'pending',
        message: 'Your submission has been received and is waiting for moderator review.',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message || 'An unexpected error occurred.',
      };
    }
  }
}
