import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { ReviewSubmission } from '../../../src/application/use-cases/ReviewSubmission.js';
import { Submission, SubmissionStatus } from '../../../src/domain/entities/Submission.js';
import { User } from '../../../src/domain/entities/User.js';

describe('ReviewSubmission Use Case', () => {
  const mockSubmission = new Submission({
    id: 'sub-123',
    slackLink: 'https://my-team.slack.com/archives/C123/p1620000000000000',
    status: SubmissionStatus.PENDING,
    submitterId: 'U_SUBMITTER',
  });

  const mockSubmitter = new User({
    slackId: 'U_SUBMITTER',
    isTrusted: false,
    isBanned: false,
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
    };
    const mockSlackClient = {
      chat: {
        postMessage: mock.fn(async () => ({})),
      },
    };

    return {
      useCase: new ReviewSubmission(mockUserRepo as any, mockSubRepo as any, mockSlackClient as any),
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

    assert.strictEqual((mockUserRepo.updateStats.mock.calls[0] as any).arguments[1].approved, 1);

    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 2);
  });

  it('should reject a submission and notify user', async () => {
    const { useCase, mockSubRepo, mockUserRepo, mockSlackClient } = setup();

    (mockSubmission as any).props.status = SubmissionStatus.PENDING;

    const response = await useCase.execute({
      submissionId: 'sub-123',
      moderatorId: 'U_MOD',
      action: 'REJECT_OOC',
    });

    assert.strictEqual(response.success, true);

    const savedSub = mockSubRepo.save.mock.calls[0].arguments[0];
    assert.strictEqual(savedSub.status, SubmissionStatus.REJECTED_NOT_OOC);

    assert.strictEqual((mockUserRepo.updateStats.mock.calls[0] as any).arguments[1].rejected, 1);

    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 1);
  });
});
