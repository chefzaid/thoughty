import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { MergePersonDto, PERSON_NAME_MAX_LENGTH, PERSON_NOTES_MAX_LENGTH, UpdatePersonDto } from './person.dto';
import { MarkPersonContactedDto } from './person-reach-out.dto';

describe('person DTOs', () => {
  it('takes a trimmed name of 1 to 80 characters', async () => {
    const rename = (name: unknown) => invalidPropertiesLikeApi(UpdatePersonDto, { name });

    await expect(parseLikeApi(UpdatePersonDto, { name: '  Marie Curie ' })).resolves.toMatchObject({ name: 'Marie Curie' });
    await expect(rename('Marie')).resolves.toEqual([]);
    await expect(rename('m'.repeat(PERSON_NAME_MAX_LENGTH))).resolves.toEqual([]);
    await expect(rename('   ')).resolves.toEqual(['name']);
    await expect(rename('m'.repeat(PERSON_NAME_MAX_LENGTH + 1))).resolves.toEqual(['name']);
    await expect(rename(5)).resolves.toEqual(['name']);
    await expect(rename({ first: 'Marie' })).resolves.toEqual(['name']);
    await expect(invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', handles: ['m'] })).resolves.toEqual(['handles']);
  });

  it('takes an optional date with its kind, month and day, and the year when known; null removes it', async () => {
    const withDate = (date: unknown) => invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', date });

    await expect(withDate({ kind: 'birthday', month: 3, day: 14, year: 1992 })).resolves.toEqual([]);
    await expect(withDate({ kind: 'anniversary', month: 2, day: 29 })).resolves.toEqual([]);
    await expect(withDate({ kind: 'birthday', month: 2, day: 29, year: null })).resolves.toEqual([]);
    await expect(withDate(null)).resolves.toEqual([]);
    await expect(parseLikeApi(UpdatePersonDto, { name: 'Marie', date: { kind: 'birthday', month: '3', day: '14' } }))
      .resolves.toMatchObject({ date: { kind: 'birthday', month: 3, day: 14 } });
    await expect(withDate({ kind: 'nameday', month: 3, day: 14 })).resolves.toEqual(['date.kind']);
    await expect(withDate({ kind: 'birthday', month: 3.5, day: '' })).resolves.toEqual(['date.month', 'date.day']);
    await expect(withDate({ kind: 'birthday', month: 3, day: 14, year: 'ninety' })).resolves.toEqual(['date.year']);
    await expect(withDate({ kind: 'birthday', day: 14 })).resolves.toEqual(['date.month']);
    await expect(withDate({ kind: 'birthday', month: 3, day: 14, label: 'x' })).resolves.toEqual(['date.label']);
    await expect(withDate('2026-03-14')).resolves.toEqual(['date']);
  });

  it('takes an optional reach-out reminder from the offered intervals and an optional last contact day; null removes each', async () => {
    const withReachOut = (fields: Record<string, unknown>) => invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', ...fields });

    await expect(withReachOut({ reachOutDays: 30, lastContactOn: '2026-11-03' })).resolves.toEqual([]);
    await expect(withReachOut({ reachOutDays: 365 })).resolves.toEqual([]);
    await expect(withReachOut({ reachOutDays: null, lastContactOn: null })).resolves.toEqual([]);
    for (const reachOutDays of [0, 31, '30', 30.5, true]) {
      await expect(withReachOut({ reachOutDays })).resolves.toEqual(['reachOutDays']);
    }
    for (const lastContactOn of ['2026-02-30', '2026-11-03T10:00:00Z', '26-11-03', 20261103]) {
      await expect(withReachOut({ lastContactOn })).resolves.toEqual(['lastContactOn']);
    }
  });

  it('takes optional trimmed notes of at most 2,000 characters, reading blank or null notes as none', async () => {
    const withNotes = (notes: unknown) => invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', notes });

    await expect(parseLikeApi(UpdatePersonDto, { name: 'Marie', notes: '  Loves Japanese novels.\n ' }))
      .resolves.toMatchObject({ notes: 'Loves Japanese novels.' });
    await expect(parseLikeApi(UpdatePersonDto, { name: 'Marie', notes: ' \n ' })).resolves.toMatchObject({ notes: null });
    await expect(withNotes('n'.repeat(PERSON_NOTES_MAX_LENGTH))).resolves.toEqual([]);
    await expect(withNotes(` ${'n'.repeat(PERSON_NOTES_MAX_LENGTH)} `)).resolves.toEqual([]);
    await expect(withNotes(null)).resolves.toEqual([]);
    await expect(withNotes('n'.repeat(PERSON_NOTES_MAX_LENGTH + 1))).resolves.toEqual(['notes']);
    for (const notes of [5, true, ['Loves novels'], { text: 'x' }]) {
      await expect(withNotes(notes)).resolves.toEqual(['notes']);
    }
  });

  it('takes the writer’s current day as the contact day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await expect(invalidPropertiesLikeApi(MarkPersonContactedDto, { today })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(MarkPersonContactedDto, {})).resolves.toEqual(['today']);
    await expect(invalidPropertiesLikeApi(MarkPersonContactedDto, { today: '2020-01-01' })).resolves.toEqual(['today']);
  });

  it('takes the duplicate to merge by its ID, as a number or as digits', async () => {
    const merge = (duplicateId: unknown) => invalidPropertiesLikeApi(MergePersonDto, { duplicateId });

    await expect(merge(14)).resolves.toEqual([]);
    await expect(parseLikeApi(MergePersonDto, { duplicateId: '14' })).resolves.toEqual({ duplicateId: 14 });
    for (const duplicateId of [0, '', true, '1e1', [14]]) {
      await expect(merge(duplicateId)).resolves.toEqual(['duplicateId']);
    }
  });
});
