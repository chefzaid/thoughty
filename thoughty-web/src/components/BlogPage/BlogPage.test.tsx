import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import BlogPage from './BlogPage';

const messages: Record<string, string> = {
  blogEyebrow: 'Thoughty blog',
  blogTitle: 'Updates, tips, and journaling inspiration.',
  blogSubtitle: 'Read product notes.',
  blogIndexKicker: 'Latest posts',
  blogIndexTitle: 'From the journal desk',
  blogCategoryUpdate: 'Product update',
  blogCategoryTips: 'Journaling tips',
  blogCategoryInspiration: 'Inspiration',
  blogUpdateTitle: 'What changed in Thoughty this month',
  blogUpdateExcerpt: 'A quick look at public pages.',
  blogUpdateBody: 'This month focuses on the public side of Thoughty.',
  blogUpdateDate: 'June 2026',
  blogTipsTitle: 'A simple weekly review that stays light',
  blogTipsExcerpt: 'Use tags, favorites, and stats.',
  blogTipsBody: 'Pick three entries from the week.',
  blogTipsDate: 'Guide',
  blogInspirationTitle: 'Prompts for writing when the day feels noisy',
  blogInspirationExcerpt: 'Three quiet prompts.',
  blogInspirationBody: 'Try starting with what still has your attention.',
  blogInspirationDate: 'Prompt set',
  blogRead: 'Read',
  blogReading: 'Reading',
  back: 'Back',
  copyright: 'Copyright',
  madeWithLove: 'Made with care',
  about: 'About',
  privacy: 'Privacy',
  terms: 'Terms',
  contact: 'Contact',
};

function t(key: string) {
  return messages[key] ?? key;
}

describe('BlogPage', () => {
  it('renders the blog hero, featured post, and post index', () => {
    render(<BlogPage t={t} theme="dark" onBackHome={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Updates, tips, and journaling inspiration.' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'What changed in Thoughty this month' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'From the journal desk' })).toBeInTheDocument();
  });

  it('switches the featured post when a reader chooses another article', async () => {
    const user = userEvent.setup();
    render(<BlogPage t={t} theme="light" onBackHome={vi.fn()} />);

    const readButton = screen.getAllByRole('button', { name: 'Read' })[0];
    expect(readButton).toBeDefined();
    await user.click(readButton as HTMLElement);

    expect(screen.getByText('Pick three entries from the week.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reading' })).toHaveLength(1);
  });

  it('navigates back home from the hero action', async () => {
    const user = userEvent.setup();
    const onBackHome = vi.fn();
    render(<BlogPage t={t} theme="dark" onBackHome={onBackHome} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
