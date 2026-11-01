import { describeContract } from './contract-suite';
import { createEntry } from './contract-fixtures';

interface Highlights {
  onThisDay: Record<string, { id: number }[]>;
  currentDate: { month: string; day: string; year: number };
}

/** The UTC day `offset` days away: a writer in Kiritimati (UTC+14) can be a day ahead, one in Pago Pago (UTC-11) a day behind. */
function utcDay(offset = 0): string {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The same day four years earlier, which exists for a 29 February too. */
function yearsBefore(day: string): string {
  return `${Number(day.slice(0, 4)) - 4}${day.slice(4)}`;
}

describeContract('writers-day', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  it('shows On This Day for the writer’s own day, a day ahead of UTC or a day behind', async () => {
    const { alice } = context;
    const ahead = utcDay(1);
    const behind = utcDay(-1);
    const aheadId = await createEntry(context, alice, { text: 'Four years before, a day ahead', date: yearsBefore(ahead) });
    const behindId = await createEntry(context, alice, { text: 'Four years before, a day behind', date: yearsBefore(behind) });

    for (const [today, id, otherId] of [[ahead, aheadId, behindId], [behind, behindId, aheadId]] as const) {
      const response = await call('GET /api/entries/highlights', { as: alice, query: { today }, status: 200 });
      const highlights = response.body as Highlights;
      expect(highlights.currentDate).toEqual({ year: Number(today.slice(0, 4)), month: today.slice(5, 7), day: today.slice(8, 10) });
      const shown = Object.values(highlights.onThisDay).flat().map((entry) => entry.id);
      expect(highlights.onThisDay['4']?.map((entry) => entry.id)).toContain(id);
      expect(shown).not.toContain(otherId);
    }
  });

  it('refuses a day further than a day from UTC wherever the writer’s day is taken', async () => {
    const { alice } = context;
    for (const today of [utcDay(2), utcDay(-2), '2026-02-30']) {
      for (const operation of [
        'GET /api/entries/highlights',
        'GET /api/stats',
        'GET /api/stats/streak',
        'GET /api/io/export',
        'GET /api/config/download-data',
        'GET /api/books/preview',
      ] as const) {
        await call(operation, { as: alice, query: { today }, status: 400, code: 'VALIDATION_FAILED' });
      }
    }
  });

  it('names exports, the data download and books after the writer’s day', async () => {
    const { alice } = context;
    await createEntry(context, alice, { text: 'Something to export' });
    const today = utcDay(1);

    const exported = await call('GET /api/io/export', { as: alice, query: { format: 'json', today }, status: 200, contentType: /^application\/json/ });
    expect(String(exported.headers['content-disposition'])).toBe(`attachment; filename="thoughty_all_diaries_${today}.json"`);
    const archive = await call('GET /api/io/export', { as: alice, query: { format: 'zip', today }, status: 200, contentType: /^application\/zip/, binary: true });
    expect(String(archive.headers['content-disposition'])).toBe(`attachment; filename="thoughty_all_diaries_${today}.zip"`);
    const data = await call('GET /api/config/download-data', { as: alice, query: { today }, status: 200, contentType: /^application\/json/ });
    expect(String(data.headers['content-disposition'])).toBe(`attachment; filename="thoughty_data_${today}.json"`);
    const book = await call('GET /api/books/export', {
      as: alice,
      query: { narrative: 'false', format: 'md', title: 'Days', today },
      status: 200,
      contentType: /^text\/markdown/,
    });
    expect(String(book.headers['content-disposition'])).toBe(`attachment; filename="thoughty_book_Days_${today}.md"`);
    expect(book.text).toContain(`*${today}*`);
  });
});
