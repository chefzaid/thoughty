import { RATE_LIMITS } from '@/common';
import { SavedEntriesController } from './saved-entries.controller';

describe('SavedEntriesController', () => {
  const service = { setSaved: jest.fn() };
  const controller = new SavedEntriesController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('saves and unsaves for the authenticated user', async () => {
    service.setSaved.mockResolvedValueOnce({ saved: true }).mockResolvedValueOnce({ saved: false });

    await expect(controller.saveEntry(user as never, 8)).resolves.toEqual({ saved: true });
    await expect(controller.unsaveEntry(user as never, 8)).resolves.toEqual({ saved: false });
    expect(service.setSaved.mock.calls).toEqual([
      [4, 8, true],
      [4, 8, false],
    ]);
  });

  it('limits saves like the other social writes', () => {
    for (const handler of [controller.saveEntry, controller.unsaveEntry]) {
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(
        RATE_LIMITS.socialWrite.limit,
      );
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(
        RATE_LIMITS.socialWrite.ttl,
      );
    }
  });
});
