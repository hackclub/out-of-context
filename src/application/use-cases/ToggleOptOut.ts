import { User, UserRole } from '../../domain/entities/User.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';

export interface ToggleOptOutResponse {
  optedOut: boolean;
  message: string;
}

export class ToggleOptOut {
  constructor(private userRepository: IUserRepository) {}

  async execute(slackId: string): Promise<ToggleOptOutResponse> {
    let user = await this.userRepository.findBySlackId(slackId);

    if (!user) {
      user = new User({
        slackId,
        role: UserRole.USER,
        isTrusted: false,
        isBanned: false,
        optedOut: false,
        approvedCount: 0,
        rejectedCount: 0,
        explicitRejectionCount: 0,
      });
    }

    const newOptedOut = !user.optedOut;
    const data = user.toJSON();
    const updated = new User({ ...data, optedOut: newOptedOut });
    await this.userRepository.save(updated);

    return {
      optedOut: newOptedOut,
      message: newOptedOut
        ? 'You have opted out of #out-of-context. No one will be able to submit your messages to the channel.'
        : 'You have opted back in to #out-of-context. Your messages can be submitted again.',
    };
  }
}
