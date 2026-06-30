import assert from 'node:assert';
import { describe, it } from 'node:test';
import { config } from '../../../src/config/index.js';
import { User, UserRole } from '../../../src/domain/entities/User.js';

describe('User Entity', () => {
  const mockConfig = {
    ...config,
    moderation: {
      ...config.moderation,
      approvedPostsForTrust: 5,
      maxExplicitRejectionsForTrust: 0,
      explicitRejectionsBeforeBan: 3,
    },
  };

  it('should be eligible for trust if approved count meets threshold', () => {
    const user = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optedOut: false,
      approvedCount: 5,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    });

    assert.strictEqual(user.isEligibleForTrust(mockConfig), true);
  });

  it('should NOT be eligible for trust if they have explicit rejections', () => {
    const user = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optedOut: false,
      approvedCount: 10,
      rejectedCount: 0,
      explicitRejectionCount: 1,
    });

    assert.strictEqual(user.isEligibleForTrust(mockConfig), false);
  });

  it('should be flagged for ban if explicit rejections meet threshold', () => {
    const user = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: false,
      isBanned: false,
      optedOut: false,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 3,
    });

    assert.strictEqual(user.shouldBeBanned(mockConfig), true);
  });
});
