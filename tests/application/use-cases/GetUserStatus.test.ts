import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { GetUserStatus } from '../../../src/application/use-cases/GetUserStatus.js';
import { SubmissionStatus } from '../../../src/domain/entities/Submission.js';
import { User, UserRole } from '../../../src/domain/entities/User.js';

describe('GetUserStatus Use Case', () => {
  it('should return empty stats for unregistered user', async () => {
    const mockUserRepo = { findBySlackId: mock.fn(async () => null) };
    const mockSubRepo = {};

    const useCase = new GetUserStatus(mockUserRepo as any, mockSubRepo as any);
    const response = await useCase.execute('U123');

    assert.strictEqual(response.isRegistered, false);
    assert.strictEqual(response.stats.approved, 0);
  });

  it('should return correct stats and pending queue for registered user', async () => {
    const user = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: true,
      isBanned: false,
      approvedCount: 5,
      rejectedCount: 1,
      explicitRejectionCount: 0,
    });

    const mockUserRepo = { findBySlackId: mock.fn(async () => user) };
    const mockSubRepo = {
      findBySubmitterId: mock.fn(async () => [
        { id: 'sub-1', slackLink: 'link-1', status: SubmissionStatus.PENDING },
        { id: 'sub-2', slackLink: 'link-2', status: SubmissionStatus.APPROVED },
      ]),
      getPendingQueue: mock.fn(async () => [{ id: 'other-sub' }, { id: 'sub-1' }]),
    };

    const useCase = new GetUserStatus(mockUserRepo as any, mockSubRepo as any);
    const response = await useCase.execute('U123');

    assert.strictEqual(response.isRegistered, true);
    assert.strictEqual(response.isTrusted, true);
    assert.strictEqual(response.stats.approved, 5);
    assert.strictEqual(response.pendingSubmissions.length, 1);
    assert.strictEqual(response.pendingSubmissions[0].id, 'sub-1');
    assert.strictEqual(response.pendingSubmissions[0].queuePosition, 2);
  });
});
