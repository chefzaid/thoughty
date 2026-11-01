import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTranslation } from '../../utils/translations';
import { QuietModeOn } from '../../test/quietMode';
import YearReviewTeaser from './YearReviewTeaser';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('YearReviewTeaser', () => {
  it('invites to the year in review, with its totals', () => {
    const onOpen = vi.fn();
    render(<YearReviewTeaser onOpen={onOpen} t={t} />);

    expect(screen.getByRole('region', { name: 'Your year in review' })).toHaveTextContent('Totals, themes');
    fireEvent.click(screen.getByRole('button', { name: 'Open the year in review' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('promises no totals in quiet mode', () => {
    render(<YearReviewTeaser onOpen={vi.fn()} t={t} />, { wrapper: QuietModeOn });

    const teaser = screen.getByRole('region', { name: 'Your year in review' });
    expect(teaser).toHaveTextContent('Themes, the moments worth rereading, and the mood of your year.');
    expect(teaser).not.toHaveTextContent('Totals');
  });
});
