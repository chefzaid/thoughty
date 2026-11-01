import { zonedParts } from '../../src/common/utils/time-zone.util';
import { describeContract, registerWriter } from './contract-suite';
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
    // The title page writes the writer's day out in their language (English here)
    const writtenDay = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${today}T00:00:00Z`));
    expect(book.text).toContain(`*${writtenDay}*`);
  });

  it('reads when the writer writes in their own time zone: typed times as they are, creation times converted', async () => {
    const carol = await registerWriter(context.client, 'carol');
    // Tuesday 27 October 2026 at 21:15, as the writer typed it
    await call('POST /api/entries', {
      as: carol,
      json: { text: 'A typed time', tags: [], date: '2026-10-27', timeOfDay: '21:15', visibility: 'private', format: 'plain' },
      status: 201,
    });
    await createEntry(context, carol, { text: 'Written just now, without a time' });

    for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const before = zonedParts(new Date(), timeZone);
      const response = await call('GET /api/stats', { as: carol, query: { today: utcDay(), timeZone }, status: 200 });
      const after = zonedParts(new Date(), timeZone);
      const { writingTimes } = response.body as { writingTimes: { hours: number[]; weekdays: number[] } };
      // The entry written now counts at the hour and weekday it is in that zone (read on either side of the call)
      const expected = [before, after].map((now) => {
        const hours = Array.from({ length: 24 }, () => 0);
        const weekdays = Array.from({ length: 7 }, () => 0);
        hours[21] += 1;
        weekdays[1] += 1;
        hours[now.hour] += 1;
        weekdays[(now.weekday + 6) % 7] += 1;
        return { hours, weekdays };
      });
      expect(expected).toContainEqual(writingTimes);
    }

    for (const timeZone of ['Mars/Olympus', '+05:30', '']) {
      await call('GET /api/stats', { as: carol, query: { timeZone }, status: 400, code: 'VALIDATION_FAILED' });
    }
  });

  it('finds the personal records with links to their entries, the hours read in the writer’s time zone', async () => {
    const dana = await registerWriter(context.client, 'dana');
    const write = async (json: Record<string, unknown>) => {
      const response = await call('POST /api/entries', {
        as: dana,
        json: { tags: [], visibility: 'private', format: 'plain', ...json },
        status: 201,
      });
      return (response.body as { entryId: number }).entryId;
    };
    const evening = await write({ text: 'A long evening entry with seven words', date: '2026-10-27', timeOfDay: '21:15' });
    const morning = await write({ text: 'Early', date: '2026-10-28', timeOfDay: '06:45' });
    const now = await write({ text: 'Now', date: '2026-10-28' });
    // In the recycle bin: earlier in the day, in the past and longer than any other, so it holds no record
    const binned = await write({ text: 'word '.repeat(20), date: '2020-01-01', timeOfDay: '00:05' });
    await call('DELETE /api/entries/{id}', { as: dana, params: { id: binned }, status: 200 });

    const toTime = ({ hour, minute }: { hour: number; minute: number }) =>
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const before = toTime(zonedParts(new Date(), timeZone));
      const response = await call('GET /api/stats', { as: dana, query: { today: utcDay(), timeZone }, status: 200 });
      const after = toTime(zonedParts(new Date(), timeZone));
      const { records } = response.body as { records: Record<string, unknown> };
      expect(records).toMatchObject({
        longestEntry: { entryId: evening, date: '2026-10-27', index: 1, words: 7 },
        busiestDay: { date: '2026-10-28', entries: 2 },
        longestStreak: { days: 2, startDate: '2026-10-27', endDate: '2026-10-28' },
        firstEntry: { entryId: evening, date: '2026-10-27', index: 1 },
      });
      // The entry written now counts at the time it is in that zone (read on either side of the call)
      const expected = [before, after].map((time) => {
        const times = [
          { entryId: evening, date: '2026-10-27', index: 1, time: '21:15' },
          { entryId: morning, date: '2026-10-28', index: 1, time: '06:45' },
          { entryId: now, date: '2026-10-28', index: 2, time },
        ].sort((left, right) => left.time.localeCompare(right.time));
        return { earliestEntry: times[0], latestEntry: times.at(-1) };
      });
      expect(expected).toContainEqual({ earliestEntry: records.earliestEntry, latestEntry: records.latestEntry });
    }
  });
});
