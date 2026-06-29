import type { WebClient } from '@slack/web-api';
import { UserRole } from '../../domain/entities/User.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { logger } from '../../shared/utils/logger.js';

export interface UpdateUserRoleRequest {
  targetSlackId: string;
  newRole: UserRole;
  actorSlackId: string;
}

export interface UpdateUserRoleResponse {
  success: boolean;
  message: string;
}

export class UpdateUserRole {
  constructor(
    private userRepository: IUserRepository,
    private slackClient: WebClient,
  ) {}

  async execute(request: UpdateUserRoleRequest): Promise<UpdateUserRoleResponse> {
    const actor = await this.userRepository.findBySlackId(request.actorSlackId);

    // Only SUPER_ADMIN can change roles
    if (!actor || actor.role !== UserRole.SUPER_ADMIN) {
      return {
        success: false,
        message: 'Only Super Admins can manage roles.',
      };
    }

    const targetUser = await this.userRepository.findBySlackId(request.targetSlackId);

    if (!targetUser) {
      return {
        success: false,
        message: 'Target user not found. They must have interacted with the bot at least once.',
      };
    }

    // Update role
    targetUser.changeRole(request.newRole);

    await this.userRepository.save(targetUser);

    try {
      await this.slackClient.chat.postMessage({
        channel: request.targetSlackId,
        text: `Your role has been updated to: *${request.newRole}*`,
      });
    } catch (error) {
      logger.error('Failed to notify user of role update:', error);
    }

    return {
      success: true,
      message: `Successfully updated <@${request.targetSlackId}>'s role to ${request.newRole}.`,
    };
  }
}
