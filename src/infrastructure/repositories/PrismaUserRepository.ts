import { config } from '../../config/index.js';
import { User, UserRole } from '../../domain/entities/User.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import db from '../prisma.js';

export class PrismaUserRepository implements IUserRepository {
  async findBySlackId(slackId: string): Promise<User | null> {
    const user = await db.user.findUnique({
      where: { slackId },
    });

    if (!user) return null;

    // Bootstrap Super Admin if configured
    let role = user.role as UserRole;
    if (slackId === config.slack.superAdminId && role !== UserRole.SUPER_ADMIN) {
      role = UserRole.SUPER_ADMIN;
      // Optionally save it back to DB, but for now we just return the object with the correct role
    }

    return new User({
      slackId: user.slackId,
      role: role,
      isTrusted: user.isTrusted,
      isBanned: user.isBanned,
      approvedCount: user.approvedCount,
      rejectedCount: user.rejectedCount,
      explicitRejectionCount: user.explicitRejectionCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async save(user: User): Promise<User> {
    const data = user.toJSON();
    const saved = await db.user.upsert({
      where: { slackId: data.slackId },
      update: {
        role: data.role,
        isTrusted: data.isTrusted,
        isBanned: data.isBanned,
        approvedCount: data.approvedCount,
        rejectedCount: data.rejectedCount,
        explicitRejectionCount: data.explicitRejectionCount,
      },
      create: {
        slackId: data.slackId,
        role: data.role,
        isTrusted: data.isTrusted,
        isBanned: data.isBanned,
        approvedCount: data.approvedCount,
        rejectedCount: data.rejectedCount,
        explicitRejectionCount: data.explicitRejectionCount,
      },
    });

    return new User({
      ...saved,
      role: saved.role as UserRole,
    });
  }

  async updateStats(
    slackId: string,
    stats: { approved?: number; rejected?: number; explicit?: number },
  ): Promise<void> {
    await db.user.update({
      where: { slackId },
      data: {
        approvedCount: stats.approved ? { increment: stats.approved } : undefined,
        rejectedCount: stats.rejected ? { increment: stats.rejected } : undefined,
        explicitRejectionCount: stats.explicit ? { increment: stats.explicit } : undefined,
      },
    });
  }
}
