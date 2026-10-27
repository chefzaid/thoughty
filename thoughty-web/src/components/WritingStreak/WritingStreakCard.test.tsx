import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import WritingStreakCard from './WritingStreakCard';
import { useWritingStreak } from './useWritingStreak';
import { getTranslation } from '../../utils/translations';
import type { WritingStreak } from '../../services/api';

vi.mock('./useWritingStreak', () => ({ useWritingStreak: vi.fn() }));

const lastEntry = { id: 42, date: '2026-10-21', title: 'River walk', snippet: 'A slow walk along the river.' };
const streak = (overrides: Partial<WritingStreak>): WritingStreak => ({
  currentStreak: 0, writtenToday: false, daysSinceLastEntry: 0, lastEntry, ...overrides,
});
const answer = (data: WritingStreak | undefined) =>
  vi.mocked(useWritingStreak).mockReturnValue({ data } as ReturnType<typeof useWritingStreak>);

function renderCard(props: Partial<Parameters<typeof WritingStreakCard>[0]> = {}) {
  const onWriteNow = vi.fn();
  const onOpenEntry = vi.fn();
  const language = props.language ?? 'en';
  const view = render(
    <WritingStreakCard
      diaryId={3}
      enabled
      onWriteNow={onWriteNow}
      onOpenEntry={onOpenEntry}
      language={language}
      theme="dark"
      t={(key, params) => getTranslation(language, key, params)}
      {...props}
    />,
  );
  return { ...view, onWriteNow, onOpenEntry };
}

describe('WritingStreakCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 9, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the days in a row in a labelled region, measured up to the writer’s day', () => {
    answer(streak({ currentStreak: 4, writtenToday: true }));
    renderCard();

    const region = screen.getByRole('region', { name: 'Writing streak' });
    expect(region).toHaveTextContent('4 days in a row');
    expect(region).toHaveTextContent("Today's page is written.");
    expect(useWritingStreak).toHaveBeenCalledWith(3, '2026-10-27', true);
  });

  it('keeps the streak going warmly while today is still unwritten', () => {
    answer(streak({ currentStreak: 2, daysSinceLastEntry: 1 }));
    renderCard({ theme: 'light' });

    expect(screen.getByText('2 days in a row')).toBeInTheDocument();
    expect(screen.getByText("Today's page is open whenever you feel like writing.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Write now' })).not.toBeInTheDocument();
  });

  it('offers to pick up the last entry after a gap, without counting the streak that ended', () => {
    answer(streak({ currentStreak: 0, daysSinceLastEntry: 6 }));
    const { onWriteNow, onOpenEntry } = renderCard();

    const region = screen.getByRole('region', { name: 'Pick up where you left off' });
    expect(region).toHaveTextContent('Welcome back. Your last entry is from October 21, 2026.');
    expect(region).toHaveTextContent('River walk');
    expect(region).toHaveTextContent('A slow walk along the river.');
    expect(region).not.toHaveTextContent(/in a row|streak/i);

    fireEvent.click(screen.getByRole('button', { name: 'Write now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reread it' }));
    expect(onWriteNow).toHaveBeenCalledTimes(1);
    expect(onOpenEntry).toHaveBeenCalledWith(42);
  });

  it('names an untitled last entry and speaks French', () => {
    answer(streak({ daysSinceLastEntry: 3, lastEntry: { ...lastEntry, title: null, snippet: '' } }));
    renderCard({ language: 'fr' });

    const region = screen.getByRole('region', { name: 'Reprendre là où vous en étiez' });
    expect(region).toHaveTextContent('Votre dernière entrée date du 21 octobre 2026.');
    expect(region).toHaveTextContent('Entrée sans titre');
    expect(screen.getByRole('button', { name: 'La relire' })).toBeInTheDocument();
  });

  it('counts the French days in a row with their plural', () => {
    answer(streak({ currentStreak: 5, writtenToday: true }));
    renderCard({ language: 'fr' });

    expect(screen.getByRole('region', { name: "Série d'écriture" })).toHaveTextContent("5 jours d'affilée");
  });

  it.each([
    ['nothing is written yet', streak({ lastEntry: null, daysSinceLastEntry: null })],
    ['a single day is not a run yet', streak({ currentStreak: 1, writtenToday: true })],
    ['the break is short', streak({ daysSinceLastEntry: 2 })],
    ['the streak has not loaded', undefined],
  ])('shows nothing when %s', (_case, data) => {
    answer(data);
    const { container } = renderCard();

    expect(container).toBeEmptyDOMElement();
  });

  it('hides until tomorrow once dismissed, and comes back the next day', () => {
    answer(streak({ currentStreak: 3, writtenToday: true }));
    const { unmount } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Hide until tomorrow' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(useWritingStreak).toHaveBeenLastCalledWith(3, '2026-10-27', false);
    unmount();

    renderCard();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    cleanupAndMoveTo(new Date(2026, 9, 28, 8, 0));
    renderCard();
    expect(screen.getByRole('region', { name: 'Writing streak' })).toBeInTheDocument();
  });

  it('asks for nothing while turned off in Profile', () => {
    answer(streak({ currentStreak: 3 }));
    const { container } = renderCard({ enabled: false });

    expect(container).toBeEmptyDOMElement();
    expect(useWritingStreak).toHaveBeenCalledWith(3, '2026-10-27', false);
  });
});

function cleanupAndMoveTo(date: Date) {
  document.body.innerHTML = '';
  vi.setSystemTime(date);
}
