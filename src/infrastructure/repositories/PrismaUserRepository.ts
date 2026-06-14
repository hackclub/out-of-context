import { User } from '../../domain/entities/User.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import db from '../prisma.js';

export class PrismaUserRepository implements IUserRepository {
  async findBySlackId(slackId: string): Promise<User | null> {
    const user = await db.user.findUnique({
      where: { slackId },
    });

    if (!user) return null;

    return new User({
      slackId: user.slackId,
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
        isTrusted: data.isTrusted,
        isBanned: data.isBanned,
        approvedCount: data.approvedCount,
        rejectedCount: data.rejectedCount,
        explicitRejectionCount: data.explicitRejectionCount,
      },
      create: {
        slackId: data.slackId,
        isTrusted: data.isTrusted,
        isBanned: data.isBanned,
        approvedCount: data.approvedCount,
        rejectedCount: data.rejectedCount,
        explicitRejectionCount: data.explicitRejectionCount,
      },
    });

    return new User(saved);
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
