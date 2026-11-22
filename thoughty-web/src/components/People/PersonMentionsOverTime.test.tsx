import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import PersonMentionsOverTime from './PersonMentionsOverTime';
import type { MentionsScope } from './usePersonMentions';

const service = vi.hoisted(() => ({ mentionsOverTime: vi.fn(), groupMentionsOverTime: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

const months = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  const period = `2026-${String(month).padStart(2, '0')}`;
  if (month === 3) return { period, entries: 4, moodEntries: 2, averageMood: 4.5 };
  if (month === 11) return { period, entries: 1, moodEntries: 0, averageMood: null };
  return { period, entries: 0, moodEntries: 0, averageMood: null };
});
const mentions = {
  entries: 7,
  months,
  years: [
    { period: '2025', entries: 2, moodEntries: 1, averageMood: 2 },
    { period: '2026', entries: 5, moodEntries: 2, averageMood: 4.5 },
  ],
};

function renderPanel(scope: MentionsScope, name: string, t = en, language: 'en' | 'fr' = 'en', theme: 'light' | 'dark' = 'light') {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PersonMentionsOverTime scope={scope} name={name} theme={theme} language={language} t={t} />
    </QueryClientProvider>,
  );
}

describe('PersonMentionsOverTime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reads out each of the last twelve months with its count and mood, and lists the years newest first', async () => {
    service.mentionsOverTime.mockResolvedValue({ data: mentions, error: null });
    renderPanel({ personId: 12 }, 'Marie');

    expect(await screen.findByText('5 entries in the last 12 months')).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Mentions of Marie over time' });
    expect(service.mentionsOverTime).toHaveBeenCalledWith(12, '2026-11-22');
    const bars = within(within(section).getByRole('list', { name: 'The last 12 months' })).getAllByRole('listitem');
    expect(bars).toHaveLength(12);
    expect(bars[2]).toHaveTextContent('March 2026: 4 entries, average mood 4.5 out of 5 (Very good)');
    expect(bars[10]).toHaveTextContent('November 2026: 1 entry');
    expect(bars[0]).toHaveTextContent('January 2026: 0 entries');
    expect(bars[2]?.querySelector('[data-mention-bar]')).toHaveStyle({ height: '64px' });
    expect(bars[10]?.querySelector('[data-mention-bar]')).toHaveStyle({ height: '16px' });

    const rows = within(within(section).getByRole('table', { name: 'By year' })).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'YearEntriesAverage mood',
      '202654.5 out of 5 (Very good)',
      '202522.0 out of 5 (Low)',
    ]);
  });

  it('asks for a group’s mentions and says when nothing mentions them, in French too', async () => {
    service.groupMentionsOverTime.mockResolvedValue({ data: { entries: 0, months, years: [] }, error: null });
    renderPanel({ group: 'Amis' }, 'Amis', fr, 'fr', 'dark');

    expect(await screen.findByText('Aucune entrée ne mentionne encore quelqu’un de Amis.')).toBeInTheDocument();
    expect(service.groupMentionsOverTime).toHaveBeenCalledWith('Amis', '2026-11-22');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a French mood with a decimal comma, a year without a mood, and a person without mentions', async () => {
    service.mentionsOverTime.mockResolvedValueOnce({
      data: { ...mentions, years: [{ period: '2026', entries: 5, moodEntries: 0, averageMood: null }, { period: '2025', entries: 1, moodEntries: 1, averageMood: 3.5 }] },
      error: null,
    });
    renderPanel({ personId: 12 }, 'Marie', fr, 'fr');
    expect(await screen.findByText('3,5 sur 5 (Bonne)')).toBeInTheDocument();
    expect(screen.getByText('Aucune humeur')).toBeInTheDocument();
    expect(screen.getByText('mars 2026 : 4 entrées, humeur moyenne 4,5 sur 5 (Très bonne)')).toBeInTheDocument();

    service.mentionsOverTime.mockResolvedValueOnce({ data: { entries: 0, months, years: [] }, error: null });
    renderPanel({ personId: 14 }, 'Paul');
    expect(await screen.findByText('No entry mentions Paul yet.')).toBeInTheDocument();
  });

  it('says while it loads and when the mentions cannot be loaded', async () => {
    service.mentionsOverTime.mockResolvedValue({ data: null, error: 'personMentionsFailed' });
    renderPanel({ personId: 12 }, 'Marie');

    expect(screen.getByText('Loading the mentions…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The mentions could not be loaded. Try again later.'));
  });
});
