import type { WebClient } from '@slack/web-api';
import { User } from '../../domain/entities/User.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';

export interface UpdateUserTrustRequest {
  slackId: string;
  isTrusted: boolean;
  moderatorId: string;
}

export interface UpdateUserTrustResponse {
  success: boolean;
  message: string;
}

export class UpdateUserTrust {
  constructor(
    private userRepository: IUserRepository,
    private slackClient: WebClient,
  ) {}

  async execute(request: UpdateUserTrustRequest): Promise<UpdateUserTrustResponse> {
    let user = await this.userRepository.findBySlackId(request.slackId);

    if (!user) {
      user = new User({
        slackId: request.slackId,
        isTrusted: request.isTrusted,
        isBanned: false,
        approvedCount: 0,
        rejectedCount: 0,
        explicitRejectionCount: 0,
      });
    } else {
      const data = user.toJSON();
      user = new User({
        ...data,
        isTrusted: request.isTrusted,
      });
    }

    await this.userRepository.save(user);

    const statusText = request.isTrusted ? 'GRANTED' : 'REVOKED';
    try {
      await this.slackClient.chat.postMessage({
        channel: request.slackId,
        text: `Your "Trusted User" status has been *${statusText}* by a moderator.\n${
          request.isTrusted
            ? 'You can now post links that bypass the moderation queue!'
            : 'Your submissions will now require moderator approval.'
        }`,
      });
    } catch (error) {
      console.error('Failed to notify user of trust change:', error);
    }

    return {
      success: true,
      message: `User <@${request.slackId}> is now ${request.isTrusted ? 'Trusted' : 'not Trusted'}.`,
    };
  }
}
