import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import type { WebClient } from '@slack/web-api';
import { ReviewSubmission } from '../../../src/application/use-cases/ReviewSubmission.js';
import { Submission, SubmissionStatus } from '../../../src/domain/entities/Submission.js';
import { User, UserRole } from '../../../src/domain/entities/User.js';
import type { ISubmissionRepository } from '../../../src/domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../../src/domain/interfaces/IUserRepository.js';

describe('ReviewSubmission Use Case', () => {
  const mockSubmission = new Submission({
    id: 'sub-123',
    slackLink: 'https://my-team.slack.com/archives/C123/p1620000000000000',
    status: SubmissionStatus.PENDING,
    submitterId: 'U_SUBMITTER',
  });

  const mockSubmitter = new User({
    slackId: 'U_SUBMITTER',
    role: UserRole.USER,
    isTrusted: false,
    isBanned: false,
    optedOut: false,
    approvedCount: 0,
    rejectedCount: 0,
    explicitRejectionCount: 0,
  });

  const setup = () => {
    const mockUserRepo = {
      findBySlackId: mock.fn(async () => mockSubmitter),
      updateStats: mock.fn(async () => {}),
      save: mock.fn(),
    };
    const mockSubRepo = {
      findById: mock.fn(async () => mockSubmission),
      save: mock.fn(async (s) => s),
      assignNextNumber: mock.fn(async () => 1),
    };
    const mockSlackClient = {
      chat: {
        postMessage: mock.fn(async () => ({})),
      },
    };

    return {
      useCase: new ReviewSubmission(
        mockUserRepo as unknown as IUserRepository,
        mockSubRepo as unknown as ISubmissionRepository,
        mockSlackClient as unknown as WebClient,
      ),
      mockUserRepo,
      mockSubRepo,
      mockSlackClient,
    };
  };

  it('should approve a submission, post to channel, and notify user', async () => {
    const { useCase, mockSubRepo, mockUserRepo, mockSlackClient } = setup();

    const response = await useCase.execute({
      submissionId: 'sub-123',
      moderatorId: 'U_MOD',
      action: 'APPROVE',
      notes: 'Great post!',
    });

    assert.strictEqual(response.success, true);

    const savedSub = mockSubRepo.save.mock.calls[0].arguments[0];
    assert.strictEqual(savedSub.status, SubmissionStatus.APPROVED);

    assert.strictEqual(
      (
        mockUserRepo.updateStats.mock.calls[0] as unknown as {
          arguments: [string, { approved?: number; rejected?: number }];
        }
      ).arguments[1].approved,
      1,
    );

    // postToOocChannel is fire-and-forget; only the submitter notification is synchronous
    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 1);
  });

  it('should reject a submission and notify user', async () => {
    const { useCase, mockSubRepo, mockUserRepo, mockSlackClient } = setup();

    (mockSubmission as unknown as { props: { status: SubmissionStatus } }).props.status = SubmissionStatus.PENDING;

    const response = await useCase.execute({
      submissionId: 'sub-123',
      moderatorId: 'U_MOD',
      action: 'REJECT_OOC',
    });

    assert.strictEqual(response.success, true);

    const savedSub = mockSubRepo.save.mock.calls[0].arguments[0];
    assert.strictEqual(savedSub.status, SubmissionStatus.REJECTED_NOT_OOC);

    assert.strictEqual(
      (
        mockUserRepo.updateStats.mock.calls[0] as unknown as {
          arguments: [string, { approved?: number; rejected?: number }];
        }
      ).arguments[1].rejected,
      1,
    );

    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 1);
  });
});
