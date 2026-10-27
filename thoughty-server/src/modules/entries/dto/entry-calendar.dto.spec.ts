import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { GetEntryCalendarQueryDto } from './entries.dto';

const invalidProperties = (query: Record<string, unknown>) => invalidPropertiesLikeApi(GetEntryCalendarQueryDto, query, 'query');

describe('GetEntryCalendarQueryDto', () => {
  it('takes a YYYY-MM month with the journal filters', async () => {
    await expect(invalidProperties({ month: '2026-10' })).resolves.toEqual([]);
    await expect(
      invalidProperties({
        month: '1999-01',
        search: '"morning run" -rain',
        tags: 'family,travel',
        visibility: 'private',
        favorites: 'true',
        archiveStatus: 'all',
        mood: '4,5',
        diaryId: '2',
        ids: '3,1,2',
        eraId: '3',
      }),
    ).resolves.toEqual([]);

    await expect(parseLikeApi(GetEntryCalendarQueryDto, { month: '2026-12', favorites: 'true', diaryId: '7', eraId: '3' }, 'query'))
      .resolves.toMatchObject({ favorites: true, diaryId: 7, eraId: 3 });
  });

  it('requires a real month', async () => {
    await expect(invalidProperties({})).resolves.toEqual(['month']);
    for (const month of ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01', '2026-10; DROP']) {
      await expect(invalidProperties({ month })).resolves.toEqual(['month']);
    }
  });

  it('rejects the same invalid filters as the list', async () => {
    await expect(invalidProperties({ month: '2026-10', mood: '6' })).resolves.toEqual(['mood']);
    await expect(invalidProperties({ month: '2026-10', visibility: 'friends' })).resolves.toEqual(['visibility']);
    await expect(invalidProperties({ month: '2026-10', archiveStatus: 'old' })).resolves.toEqual(['archiveStatus']);
    await expect(invalidProperties({ month: '2026-10', ids: '1,a' })).resolves.toEqual(['ids']);
    for (const eraId of ['0', '-2', 'abc', '1.5']) {
      await expect(invalidProperties({ month: '2026-10', eraId })).resolves.toEqual(['eraId']);
    }
    await expect(invalidProperties({ month: '2026-10', search: 'a'.repeat(501) })).resolves.toEqual(['search']);
  });
});
