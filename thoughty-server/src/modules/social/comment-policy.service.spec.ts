import { ForbiddenException } from '@nestjs/common';
import { CommentPolicyService, DEFAULT_COMMENT_POLICY_SETTING } from './comment-policy.service';

describe('CommentPolicyService', () => {
  const settingRepository = { findOne: jest.fn() };
  const followRepository = { exists: jest.fn() };
  const service = new CommentPolicyService(settingRepository as never, followRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    settingRepository.findOne.mockResolvedValue(null);
    followRepository.exists.mockResolvedValue(false);
  });

  it('keeps the entry’s own choice without reading the writer’s default', async () => {
    await expect(service.effectivePolicy({ userId: 5, commentPolicy: 'closed' })).resolves.toBe(
      'closed',
    );
    expect(settingRepository.findOne).not.toHaveBeenCalled();
  });

  it('falls back to the writer’s default, then to everyone', async () => {
    settingRepository.findOne.mockResolvedValueOnce({ value: 'followers' });
    await expect(service.effectivePolicy({ userId: 5, commentPolicy: null })).resolves.toBe(
      'followers',
    );
    expect(settingRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 5, key: DEFAULT_COMMENT_POLICY_SETTING },
      select: { value: true },
    });

    settingRepository.findOne.mockResolvedValueOnce({ value: 'friends' });
    await expect(service.effectivePolicy({ userId: 5, commentPolicy: null })).resolves.toBe(
      'everyone',
    );
    await expect(service.effectivePolicy({ userId: 5, commentPolicy: null })).resolves.toBe(
      'everyone',
    );
  });

  it('opens a followers-only entry to its writer and their followers', async () => {
    const entry = { userId: 5, commentPolicy: 'followers' as const };

    await expect(service.stateFor(5, entry)).resolves.toEqual({
      commentPolicy: 'followers',
      canComment: true,
    });
    expect(followRepository.exists).not.toHaveBeenCalled();

    await expect(service.stateFor(7, entry)).resolves.toEqual({
      commentPolicy: 'followers',
      canComment: false,
    });
    followRepository.exists.mockResolvedValueOnce(true);
    await expect(service.stateFor(7, entry)).resolves.toEqual({
      commentPolicy: 'followers',
      canComment: true,
    });
    expect(followRepository.exists).toHaveBeenCalledWith({
      where: { followerId: 7, followedId: 5, status: 'approved' },
    });
  });

  it('opens an entry to everyone, and a closed one to no one, its writer included', async () => {
    await expect(service.stateFor(7, { userId: 5, commentPolicy: 'everyone' })).resolves.toEqual({
      commentPolicy: 'everyone',
      canComment: true,
    });
    await expect(service.stateFor(5, { userId: 5, commentPolicy: 'closed' })).resolves.toEqual({
      commentPolicy: 'closed',
      canComment: false,
    });
  });

  it('says why a comment is refused', async () => {
    await expect(
      service.assertMayComment(7, { userId: 5, commentPolicy: 'everyone' }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertMayComment(7, { userId: 5, commentPolicy: 'closed' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMMENTS_CLOSED' }),
    });
    const refusal = service.assertMayComment(7, { userId: 5, commentPolicy: 'followers' });
    await expect(refusal).rejects.toBeInstanceOf(ForbiddenException);
    await expect(refusal).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMMENTS_FOLLOWERS_ONLY' }),
    });
  });
});
