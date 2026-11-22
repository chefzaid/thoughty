import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { PERSON_DATE_LABEL_MAX_LENGTH, PERSON_DATES_MAX } from '../person-dates';
import { PERSON_GROUP_NAME_MAX_LENGTH, PERSON_GROUPS_MAX } from '../person-groups';
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

  it('takes optional dates, each with its kind, month and day, a label and the year when known; an empty list removes them', async () => {
    const withDates = (dates: unknown) => invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', dates });
    const birthday = { kind: 'birthday', month: 3, day: 14 };

    await expect(withDates([{ ...birthday, year: 1992 }, { kind: 'anniversary', label: 'Wedding', month: 2, day: 29 }])).resolves.toEqual([]);
    await expect(withDates([{ ...birthday, year: null, label: null }])).resolves.toEqual([]);
    await expect(withDates([])).resolves.toEqual([]);
    await expect(withDates(Array.from({ length: PERSON_DATES_MAX }, () => ({ ...birthday, kind: 'anniversary' })))).resolves.toEqual([]);
    await expect(withDates([{ ...birthday, label: 'l'.repeat(PERSON_DATE_LABEL_MAX_LENGTH) }])).resolves.toEqual([]);
    await expect(parseLikeApi(UpdatePersonDto, { name: 'Marie', dates: [{ kind: 'anniversary', month: '3', day: '14', label: '  First met ' }] }))
      .resolves.toMatchObject({ dates: [{ kind: 'anniversary', month: 3, day: 14, label: 'First met' }] });
    await expect(parseLikeApi(UpdatePersonDto, { name: 'Marie', dates: [{ ...birthday, label: '   ' }] }))
      .resolves.toMatchObject({ dates: [{ label: null }] });
    await expect(withDates(Array.from({ length: PERSON_DATES_MAX + 1 }, () => birthday))).resolves.toEqual(['dates']);
    await expect(withDates([{ ...birthday, kind: 'nameday' }])).resolves.toEqual(['dates.0.kind']);
    await expect(withDates([birthday, { kind: 'birthday', month: 3.5, day: '' }])).resolves.toEqual(['dates.1.month', 'dates.1.day']);
    await expect(withDates([{ ...birthday, year: 'ninety' }])).resolves.toEqual(['dates.0.year']);
    await expect(withDates([{ kind: 'birthday', day: 14 }])).resolves.toEqual(['dates.0.month']);
    await expect(withDates([{ ...birthday, label: 'l'.repeat(PERSON_DATE_LABEL_MAX_LENGTH + 1) }])).resolves.toEqual(['dates.0.label']);
    await expect(withDates([{ ...birthday, label: 5 }])).resolves.toEqual(['dates.0.label']);
    await expect(withDates([{ ...birthday, note: 'x' }])).resolves.toEqual(['dates.0.note']);
    for (const dates of [null, '2026-03-14', birthday]) {
      await expect(withDates(dates)).resolves.toEqual(['dates']);
    }
    await expect(invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', date: birthday })).resolves.toEqual(['date']);
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

  it('takes optional groups: up to 10 trimmed names of 1 to 40 characters; an empty list removes them', async () => {
    const withGroups = (groups: unknown) => invalidPropertiesLikeApi(UpdatePersonDto, { name: 'Marie', groups });

    await expect(parseLikeApi(UpdatePersonDto, { name: 'Marie', groups: ['  Friends ', 'Climbing'] }))
      .resolves.toMatchObject({ groups: ['Friends', 'Climbing'] });
    await expect(withGroups([])).resolves.toEqual([]);
    await expect(withGroups(Array.from({ length: PERSON_GROUPS_MAX }, (_, index) => `Group ${index}`))).resolves.toEqual([]);
    await expect(withGroups(['g'.repeat(PERSON_GROUP_NAME_MAX_LENGTH)])).resolves.toEqual([]);
    await expect(withGroups(Array.from({ length: PERSON_GROUPS_MAX + 1 }, (_, index) => `Group ${index}`))).resolves.toEqual(['groups']);
    await expect(withGroups(['g'.repeat(PERSON_GROUP_NAME_MAX_LENGTH + 1)])).resolves.toEqual(['groups']);
    for (const groups of [null, 'Friends', ['  '], [''], [5], [null], { name: 'Friends' }]) {
      await expect(withGroups(groups)).resolves.toEqual(['groups']);
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
