import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MemoirChapter } from '../../services/api';
import { getTranslation } from '../../utils/translations';
import { QuietModeOn } from '../../test/quietMode';
import MemoirProgress from './MemoirProgress';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const chapters: MemoirChapter[] = [{
  id: 'childhood',
  title: { en: 'Childhood', fr: 'Enfance' },
  questions: [
    { id: 'home', text: { en: 'Home?', fr: 'Maison ?' }, answer: { entryId: 1, answeredAt: '2026-10-12T09:00:00.000Z' }, snoozedUntil: null },
    { id: 'play', text: { en: 'Games?', fr: 'Jeux ?' }, answer: null, snoozedUntil: null },
  ],
}];

function renderProgress(quiet: boolean) {
  const onMakeBook = vi.fn();
  render(
    <MemoirProgress
      progress={{ answered: 1, total: 2, words: 8400, estimatedPages: 34 }}
      chapters={chapters}
      language="en"
      canMakeBook
      onMakeBook={onMakeBook}
      t={t}
    />,
    quiet ? { wrapper: QuietModeOn } : undefined,
  );
  return onMakeBook;
}

describe('MemoirProgress', () => {
  it('counts the answers, words, pages and chapters', () => {
    renderProgress(false);

    expect(screen.getByRole('heading', { name: 'Your progress' })).toBeInTheDocument();
    expect(screen.getByText('8,400')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('keeps only the way to the book in quiet mode', () => {
    const onMakeBook = renderProgress(true);

    const card = screen.getByRole('region', { name: 'Your memoir book' });
    expect(card).not.toHaveTextContent(/\d/);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn my memoir into a book' }));
    expect(onMakeBook).toHaveBeenCalledTimes(1);
  });
});
