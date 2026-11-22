import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CalendarEvent } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import ComposerCalendarEvents from './ComposerCalendarEvents';

const service = vi.hoisted(() => ({ eventsOn: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../utils/timeZone', () => ({ browserTimeZone: () => 'Europe/Paris' }));

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 1,
  summary: 'Dinner with Lina',
  location: 'Le Petit Zinc',
  allDay: false,
  startsAt: '2026-11-22T18:30:00.000Z',
  endsAt: '2026-11-22T21:00:00.000Z',
  startDate: null,
  endDate: null,
  ...overrides,
});

function renderEvents(language: 'en' | 'fr' = 'en', theme: 'light' | 'dark' = 'dark') {
  const onWriteAbout = vi.fn();
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
  const { container } = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ComposerCalendarEvents date={new Date(2026, 10, 22)} onWriteAbout={onWriteAbout} language={language} theme={theme} t={t} />
    </QueryClientProvider>,
  );
  return { onWriteAbout, container };
}

describe('ComposerCalendarEvents', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists the day’s events in the browser’s zone and puts a question about one in the entry', async () => {
    service.eventsOn.mockResolvedValue({
      data: { events: [event({ id: 2, summary: 'Market', location: null, allDay: true, startsAt: null, endsAt: null, startDate: '2026-11-22', endDate: '2026-11-22' }), event()] },
      error: null,
    });
    const { onWriteAbout } = renderEvents();

    const region = await screen.findByRole('region', { name: 'On your calendar' });
    const items = within(region).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('All dayMarket');
    expect(items[1]).toHaveTextContent(/7:30\s*–\s*10:00\s*PM/);
    expect(within(items[1]!).getByText('Dinner with Lina')).toHaveClass('privacy-text');
    expect(within(items[1]!).getByText('Le Petit Zinc')).toHaveClass('privacy-text');
    expect(service.eventsOn).toHaveBeenCalledWith('2026-11-22', 'Europe/Paris');

    fireEvent.click(within(items[1]!).getByRole('button', { name: 'Write about “Dinner with Lina”' }));
    expect(onWriteAbout).toHaveBeenCalledWith('Dinner with Lina: how was it?');
  });

  it('names an untitled event, shows an instant by its start, in French and in the light theme', async () => {
    service.eventsOn.mockResolvedValue({ data: { events: [event({ summary: '', location: null, endsAt: '2026-11-22T18:30:00.000Z' })] }, error: null });
    const { onWriteAbout } = renderEvents('fr', 'light');

    const region = await screen.findByRole('region', { name: 'Dans votre agenda' });
    expect(region).toHaveTextContent('19:30Événement sans titre');
    expect(within(region).getByRole('heading')).toHaveClass('text-sky-700');
    fireEvent.click(within(region).getByRole('button', { name: 'Écrire à propos de « Événement sans titre »' }));
    expect(onWriteAbout).toHaveBeenCalledWith('Événement sans titre : comment c’était ?');
  });

  it('shows nothing on a day without events, or when they cannot be loaded', async () => {
    service.eventsOn.mockResolvedValueOnce({ data: { events: [] }, error: null });
    const empty = renderEvents();
    await vi.waitFor(() => expect(service.eventsOn).toHaveBeenCalled());
    expect(empty.container).toBeEmptyDOMElement();

    service.eventsOn.mockResolvedValueOnce({ data: null, error: 'calendarEventsLoadFailed' });
    const failed = renderEvents();
    await vi.waitFor(() => expect(service.eventsOn).toHaveBeenCalledTimes(2));
    expect(failed.container).toBeEmptyDOMElement();
  });
});
