import { ConflictException } from '@nestjs/common';
import { assertEntryNotSealed } from './time-capsule.guard';

describe('assertEntryNotSealed', () => {
  it('lets open entries through and refuses sealed ones with ENTRY_SEALED', () => {
    expect(() => assertEntryNotSealed({ sealedUntil: null })).not.toThrow();
    expect(() => assertEntryNotSealed({ sealedUntil: new Date('2030-01-01T09:00:00Z') })).toThrow(ConflictException);
    try {
      assertEntryNotSealed({ sealedUntil: new Date('2030-01-01T09:00:00Z') });
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({ code: 'ENTRY_SEALED', statusCode: 409 });
    }
  });
});
