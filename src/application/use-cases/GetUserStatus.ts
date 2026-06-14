import { SubmissionStatus } from '../../domain/entities/Submission.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../domain/interfaces/IUserRepository.js';

export interface UserStatusResponse {
  isRegistered: boolean;
  isBanned: boolean;
  isTrusted: boolean;
  stats: {
    approved: number;
    rejected: number;
    explicit: number;
  };
  pendingSubmissions: Array<{
    id: string;
    link: string;
    queuePosition: number;
    createdAt: Date;
  }>;
}

export class GetUserStatus {
  constructor(
    private userRepository: IUserRepository,
    private submissionRepository: ISubmissionRepository,
  ) {}

  async execute(slackId: string): Promise<UserStatusResponse> {
    const user = await this.userRepository.findBySlackId(slackId);

    if (!user) {
      return {
        isRegistered: false,
        isBanned: false,
        isTrusted: false,
        stats: { approved: 0, rejected: 0, explicit: 0 },
        pendingSubmissions: [],
      };
    }

    const allSubmissions = await this.submissionRepository.findBySubmitterId(slackId);
    const pendingQueue = await this.submissionRepository.getPendingQueue();

    const pendingSubmissions = allSubmissions
      .filter((s) => s.status === SubmissionStatus.PENDING)
      .map((s) => {
        // Find position in global pending queue
        const pos = pendingQueue.findIndex((pq) => pq.id === s.id);
        return {
          id: s.id || 'unknown',
          link: s.slackLink,
          queuePosition: pos + 1,
          createdAt: s.createdAt || new Date(),
        };
      })
      .sort((a, b) => a.queuePosition - b.queuePosition);

    return {
      isRegistered: true,
      isBanned: user.isBanned,
      isTrusted: user.isTrusted,
      stats: {
        approved: user.approvedCount,
        rejected: user.rejectedCount,
        explicit: user.explicitRejectionCount,
      },
      pendingSubmissions,
    };
  }
}
