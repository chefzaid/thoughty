import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CalendarEvent } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import JournalDayEvents from './JournalDayEvents';
import { CALENDAR_DAYS_LIMIT, CALENDAR_QUERY_KEY } from './useCalendarEvents';

const service = vi.hoisted(() => ({ summary: vi.fn(), eventsOnDays: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', () => ({ browserTimeZone: () => 'Europe/Paris' }));

const event = (id: number, summary: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  summary,
  location: null,
  allDay: false,
  startsAt: '2026-11-22T08:00:00.000Z',
  endsAt: '2026-11-22T09:00:00.000Z',
  startDate: null,
  endDate: null,
  repeats: false,
  ...overrides,
});
const imported = (eventCount: number) => ({ data: { eventCount, lastImportedAt: '2026-11-22T09:00:00.000Z', limit: 10000 }, error: null });
const DAYS = ['2026-11-22', '2026-11-20', '2026-11-21'];

function renderDays(days = DAYS, language: 'en' | 'fr' = 'en', client: QueryClient = createTestQueryClient()) {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
  const view = (dayList: readonly string[]) => (
    <QueryClientProvider client={client}>
      {dayList.map((date) => <JournalDayEvents key={date} date={date} days={dayList} language={language} theme="light" t={t} />)}
    </QueryClientProvider>
  );
  const result = render(view(days));
  return { ...result, client, rerenderDays: (dayList: readonly string[]) => result.rerender(view(dayList)) };
}

describe('JournalDayEvents', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows each day’s events under it from one request for every day shown, and nothing on a day without', async () => {
    service.summary.mockResolvedValue(imported(4));
    service.eventsOnDays.mockResolvedValue({
      data: {
        days: [
          { date: '2026-11-21', events: [event(1, 'Trip to Lyon', { allDay: true, startsAt: null, endsAt: null, startDate: '2026-11-21', endDate: '2026-11-23' })] },
          { date: '2026-11-22', events: [event(1, 'Trip to Lyon', { allDay: true, startsAt: null, endsAt: null }), event(2, 'Yoga', { repeats: true, location: 'Studio' })] },
        ],
      },
      error: null,
    });
    renderDays();

    const regions = await screen.findAllByRole('region', { name: 'On your calendar' });
    expect(regions).toHaveLength(2);
    expect(within(regions[0]!).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['All dayTrip to Lyon', expect.stringMatching(/^9:00\s.\s10:00\sAMYogaStudio$/)]);
    expect(within(regions[0]!).getByRole('img', { name: 'Repeats' })).toBeInTheDocument();
    expect(within(regions[0]!).getByText('Yoga')).toHaveClass('privacy-text');
    expect(within(regions[0]!).getByText('Studio')).toHaveClass('privacy-text');
    expect(within(regions[1]!).getAllByRole('listitem')).toHaveLength(1);
    expect(service.eventsOnDays).toHaveBeenCalledTimes(1);
    expect(service.eventsOnDays).toHaveBeenCalledWith(['2026-11-20', '2026-11-21', '2026-11-22'], 'Europe/Paris');
  });

  it('shows the first three events with a button for the rest, in French too', async () => {
    service.summary.mockResolvedValue(imported(5));
    const events = ['Standup', 'Lunch', 'Review', 'Gym', 'Dinner'].map((summary, index) => event(index + 1, summary));
    service.eventsOnDays.mockResolvedValue({ data: { days: [{ date: '2026-11-22', events }] }, error: null });
    renderDays(['2026-11-22'], 'fr');

    const region = await screen.findByRole('region', { name: 'Dans votre agenda' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(3);
    const more = within(region).getByRole('button', { name: 'Afficher 2 autres événements' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', within(region).getByRole('list').id);

    fireEvent.click(more);
    expect(within(region).getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(within(region).getByRole('button', { name: 'Afficher moins d’événements', expanded: true }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(3);
  });

  it('says one more event in the singular, and shows no button for three or fewer', async () => {
    service.summary.mockResolvedValue(imported(7));
    service.eventsOnDays.mockResolvedValue({
      data: {
        days: [
          { date: '2026-11-21', events: [1, 2, 3].map((id) => event(id, `Event ${id}`)) },
          { date: '2026-11-22', events: [4, 5, 6, 7].map((id) => event(id, `Event ${id}`)) },
        ],
      },
      error: null,
    });
    renderDays();

    expect(await screen.findByRole('button', { name: 'Show 1 more event' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('asks nothing until a calendar is imported, and shows nothing once its events are removed', async () => {
    service.summary.mockResolvedValue(imported(0));
    const { client } = renderDays();
    await waitFor(() => expect(service.summary).toHaveBeenCalled());
    expect(service.eventsOnDays).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    service.summary.mockResolvedValue(imported(1));
    service.eventsOnDays.mockResolvedValue({ data: { days: [{ date: '2026-11-22', events: [event(1, 'Yoga')] }] }, error: null });
    await act(() => client.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }));
    expect(await screen.findByRole('region', { name: 'On your calendar' })).toBeInTheDocument();

    service.summary.mockResolvedValue(imported(0));
    await act(() => client.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }));
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
  });

  it('keeps the days’ events while other days load, asks for at most the newest 200 days, and shows nothing when the request fails', async () => {
    service.summary.mockResolvedValue(imported(1));
    service.eventsOnDays.mockResolvedValueOnce({ data: { days: [{ date: '2026-11-22', events: [event(1, 'Yoga')] }] }, error: null });
    const { rerenderDays } = renderDays(['2026-11-22']);
    await screen.findByRole('region');

    let answer: (value: unknown) => void = () => undefined;
    service.eventsOnDays.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    rerenderDays(['2026-11-22', '2026-11-19']);
    expect(screen.getByRole('region')).toHaveTextContent('Yoga');
    await act(async () => answer({ data: { days: [{ date: '2026-11-19', events: [event(2, 'Concert')] }] }, error: null }));
    expect(await screen.findByText('Concert')).toBeInTheDocument();
    expect(screen.queryByText('Yoga')).not.toBeInTheDocument();

    const many = Array.from({ length: CALENDAR_DAYS_LIMIT + 5 }, (_, index) => new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10));
    service.eventsOnDays.mockResolvedValue({ data: null, error: 'calendarEventsLoadFailed' });
    rerenderDays(many.slice(0, 2));
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    rerenderDays(many);
    await waitFor(() => expect(service.eventsOnDays).toHaveBeenLastCalledWith(many.slice(5), 'Europe/Paris'));
  });
});
