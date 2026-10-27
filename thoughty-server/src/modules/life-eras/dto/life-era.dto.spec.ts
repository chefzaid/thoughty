import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { CreateLifeEraDto, UpdateLifeEraDto } from './life-era.dto';

const invalidOnCreate = (body: object) => invalidPropertiesLikeApi(CreateLifeEraDto, body);
const invalidOnUpdate = (body: object) => invalidPropertiesLikeApi(UpdateLifeEraDto, body);

describe('life era DTOs', () => {
  it('takes a name and start date, with an optional end, colour, emoji and note', async () => {
    await expect(invalidOnCreate({ name: 'University', startDate: '2010-09-01' })).resolves.toEqual([]);
    await expect(invalidOnCreate({
      name: 'University',
      startDate: '2010-09-01',
      endDate: '2014-06-30',
      color: '#2a9d8f',
      emoji: '🎓',
      note: 'Lyon',
    })).resolves.toEqual([]);
    await expect(invalidOnCreate({ name: 'Paris', startDate: '2015-01-01', endDate: null, color: null, emoji: null, note: null }))
      .resolves.toEqual([]);
  });

  it('trims text, capitalizes the colour and reads empty optional text as none', async () => {
    await expect(parseLikeApi(CreateLifeEraDto, { name: '  University ', startDate: '2010-09-01', color: ' #2a9d8f ', emoji: '  ', note: ' Lyon ' }))
      .resolves.toMatchObject({ name: 'University', color: '#2A9D8F', emoji: null, note: 'Lyon' });
    await expect(parseLikeApi(CreateLifeEraDto, { name: 'A', startDate: '2010-09-01', color: '' })).resolves.toMatchObject({ color: null });
  });

  it.each([
    ['name', ''],
    ['name', '   '],
    ['name', 'x'.repeat(51)],
    ['startDate', '2010-02-30'],
    ['startDate', '2010-9-1'],
    ['endDate', '2014-13-01'],
    ['color', 'teal'],
    ['color', '#2A9D8'],
    ['emoji', 'x'.repeat(17)],
    ['note', 'x'.repeat(501)],
  ])('refuses an invalid %s (%p)', async (property, value) => {
    await expect(invalidOnCreate({ name: 'Uni', startDate: '2010-09-01', [property]: value })).resolves.toEqual([property]);
  });

  it('needs a start date to create an era but lets an update change any field alone', async () => {
    await expect(invalidOnCreate({ name: 'Uni' })).resolves.toEqual(['startDate']);
    await expect(invalidOnUpdate({})).resolves.toEqual([]);
    await expect(invalidOnUpdate({ endDate: null })).resolves.toEqual([]);
    await expect(invalidOnUpdate({ name: '' })).resolves.toEqual(['name']);
    await expect(invalidOnUpdate({ userId: 3 })).resolves.toEqual(['userId']);
  });
});
