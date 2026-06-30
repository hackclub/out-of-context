import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import type { WebClient } from '@slack/web-api';
import { SubmitLink } from '../../../src/application/use-cases/SubmitLink.js';
import { SubmissionStatus } from '../../../src/domain/entities/Submission.js';
import { User, UserRole } from '../../../src/domain/entities/User.js';
import type { ISubmissionRepository } from '../../../src/domain/interfaces/ISubmissionRepository.js';
import type { IUserRepository } from '../../../src/domain/interfaces/IUserRepository.js';

describe('SubmitLink Use Case', () => {
  const validLink = 'https://workspace.slack.com/archives/C12345/p1620000000000000';
  const mockSlackClient = {
    chat: {
      postMessage: mock.fn(async () => ({})),
    },
  };

  it('should create a pending submission for a new user', async () => {
    const mockUserRepo = {
      findBySlackId: mock.fn(async () => null),
      save: mock.fn(async (u: User) => u),
      updateStats: mock.fn(),
    } as unknown as IUserRepository;

    const mockSubmissionRepo = {
      save: mock.fn(async (s: { toJSON(): object }) => {
        const data = s.toJSON();
        return { ...data, id: 'sub-123' };
      }),
    } as unknown as ISubmissionRepository;

    const useCase = new SubmitLink(mockUserRepo, mockSubmissionRepo, mockSlackClient as unknown as WebClient);
    const response = await useCase.execute({
      slackId: 'U123',
      slackLink: validLink,
    });

    assert.strictEqual(response.status, 'pending');
    assert.strictEqual((mockUserRepo.save as unknown as { mock: { callCount(): number } }).mock.callCount(), 1);
    assert.strictEqual((mockSubmissionRepo.save as unknown as { mock: { callCount(): number } }).mock.callCount(), 1);
  });

  it('should reject submission if user is banned', async () => {
    const bannedUser = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: false,
      isBanned: true,
      optedOut: false,
      approvedCount: 0,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    });

    const mockUserRepo = {
      findBySlackId: mock.fn(async () => bannedUser),
      save: mock.fn(),
      updateStats: mock.fn(),
    } as unknown as IUserRepository;

    const mockSubmissionRepo = {
      save: mock.fn(),
    } as unknown as ISubmissionRepository;

    const useCase = new SubmitLink(mockUserRepo, mockSubmissionRepo, mockSlackClient as unknown as WebClient);
    const response = await useCase.execute({
      slackId: 'U123',
      slackLink: validLink,
    });

    assert.strictEqual(response.status, 'banned');
    assert.strictEqual((mockSubmissionRepo.save as unknown as { mock: { callCount(): number } }).mock.callCount(), 0);
  });

  it('should automatically approve if user is trusted', async () => {
    const trustedUser = new User({
      slackId: 'U123',
      role: UserRole.USER,
      isTrusted: true,
      isBanned: false,
      optedOut: false,
      approvedCount: 10,
      rejectedCount: 0,
      explicitRejectionCount: 0,
    });

    const mockUserRepo = {
      findBySlackId: mock.fn(async () => trustedUser),
      save: mock.fn(),
      updateStats: mock.fn(async () => {}),
    } as unknown as IUserRepository;

    const mockSubmissionRepo = {
      save: mock.fn(async (s: { toJSON(): object }) => ({ ...s.toJSON(), id: 'sub-456' })),
      assignNextNumber: mock.fn(async () => 1),
    } as unknown as ISubmissionRepository;

    const useCase = new SubmitLink(mockUserRepo, mockSubmissionRepo, mockSlackClient as unknown as WebClient);
    const response = await useCase.execute({
      slackId: 'U123',
      slackLink: validLink,
    });

    assert.strictEqual(response.status, 'approved');
    const savedSubmission = (mockSubmissionRepo.save as unknown as { mock: { calls: { arguments: unknown[] }[] } }).mock
      .calls[0].arguments[0] as { status: string };
    assert.strictEqual(savedSubmission.status, SubmissionStatus.APPROVED);

    assert.strictEqual(mockSlackClient.chat.postMessage.mock.callCount(), 0);
  });
});
