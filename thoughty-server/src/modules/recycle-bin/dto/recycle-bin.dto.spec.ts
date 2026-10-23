import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecycleBinQueryDto, RecycleBinSelectionDto } from './recycle-bin.dto';

async function invalidProperties(dto: object): Promise<string[]> {
  return (await validate(dto)).map((error) => error.property);
}

describe('recycle bin DTOs', () => {
  it('reads paging from the query string with defaults and a page size cap', async () => {
    const defaults = plainToInstance(RecycleBinQueryDto, {});
    expect(defaults).toEqual(expect.objectContaining({ page: 1, limit: 20 }));

    const paged = plainToInstance(RecycleBinQueryDto, { page: '2', limit: '50' });
    await expect(invalidProperties(paged)).resolves.toEqual([]);
    expect(paged).toEqual(expect.objectContaining({ page: 2, limit: 50 }));

    await expect(invalidProperties(plainToInstance(RecycleBinQueryDto, { page: '0', limit: '51' }))).resolves.toEqual([
      'page',
      'limit',
    ]);
  });

  it('needs between one and a hundred positive entry IDs', async () => {
    await expect(invalidProperties(plainToInstance(RecycleBinSelectionDto, { ids: [3, 4] }))).resolves.toEqual([]);
    await expect(invalidProperties(plainToInstance(RecycleBinSelectionDto, { ids: [] }))).resolves.toEqual(['ids']);
    await expect(invalidProperties(plainToInstance(RecycleBinSelectionDto, { ids: [0, 1.5] }))).resolves.toEqual(['ids']);
    await expect(
      invalidProperties(plainToInstance(RecycleBinSelectionDto, { ids: Array.from({ length: 101 }, (_, index) => index + 1) })),
    ).resolves.toEqual(['ids']);
  });
});
