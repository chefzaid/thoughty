import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLifeEraDto, UpdateLifeEraDto } from './life-era.dto';

async function invalidProperties(dto: object): Promise<string[]> {
  return (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map((error) => error.property);
}

const create = (body: object) => plainToInstance(CreateLifeEraDto, body);
const update = (body: object) => plainToInstance(UpdateLifeEraDto, body);

describe('life era DTOs', () => {
  it('takes a name and start date, with an optional end, colour, emoji and note', async () => {
    await expect(invalidProperties(create({ name: 'University', startDate: '2010-09-01' }))).resolves.toEqual([]);
    await expect(invalidProperties(create({
      name: 'University',
      startDate: '2010-09-01',
      endDate: '2014-06-30',
      color: '#2a9d8f',
      emoji: '🎓',
      note: 'Lyon',
    }))).resolves.toEqual([]);
    await expect(invalidProperties(create({ name: 'Paris', startDate: '2015-01-01', endDate: null, color: null, emoji: null, note: null })))
      .resolves.toEqual([]);
  });

  it('trims text, capitalizes the colour and reads empty optional text as none', () => {
    const dto = create({ name: '  University ', startDate: '2010-09-01', color: ' #2a9d8f ', emoji: '  ', note: ' Lyon ' });

    expect(dto).toEqual(expect.objectContaining({ name: 'University', color: '#2A9D8F', emoji: null, note: 'Lyon' }));
    expect(create({ name: 'A', startDate: '2010-09-01', color: '' }).color).toBeNull();
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
    await expect(invalidProperties(create({ name: 'Uni', startDate: '2010-09-01', [property]: value }))).resolves.toEqual([property]);
  });

  it('needs a start date to create an era but lets an update change any field alone', async () => {
    await expect(invalidProperties(create({ name: 'Uni' }))).resolves.toEqual(['startDate']);
    await expect(invalidProperties(update({}))).resolves.toEqual([]);
    await expect(invalidProperties(update({ endDate: null }))).resolves.toEqual([]);
    await expect(invalidProperties(update({ name: '' }))).resolves.toEqual(['name']);
    await expect(invalidProperties(update({ userId: 3 }))).resolves.toEqual(['userId']);
  });
});
