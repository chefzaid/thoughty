import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DisplayLanguageContext } from '../../contexts/displayLanguage';
import { QuietModeOn } from '../../test/quietMode';
import { getTranslation } from '../../utils/translations';
import NavMenu from './NavMenu';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('NavMenu unread messages', () => {
  it('counts the unread messages beside Messages, with a dot on its closed group', () => {
    render(<NavMenu currentView="journal" onViewChange={vi.fn()} t={t} unreadMessages={3} />);

    const social = screen.getByRole('button', { name: 'Social' });
    expect(social).toHaveAccessibleDescription('3 unread messages');
    expect(social.querySelector('.nav-group-dot')).not.toBeNull();
    fireEvent.click(social);

    const messages = screen.getByRole('button', { name: 'Messages' });
    expect(messages).toHaveAccessibleDescription('3 unread messages');
    expect(messages.querySelector('.nav-badge')).toHaveTextContent('3');
    expect(social.querySelector('.nav-group-dot')).toBeNull();
  });

  it('shows one unread message in French, and nothing without any', () => {
    const french = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
    const { unmount } = render(
      <DisplayLanguageContext.Provider value="fr">
        <NavMenu currentView="messages" onViewChange={vi.fn()} t={french} unreadMessages={1} />
      </DisplayLanguageContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Social' }));
    expect(screen.getByRole('button', { name: 'Messages' })).toHaveAccessibleDescription('1 message non lu');
    unmount();

    render(<NavMenu currentView="journal" onViewChange={vi.fn()} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'Social' }));
    expect(screen.getByRole('button', { name: 'Messages' })).not.toHaveAccessibleDescription();
    expect(document.querySelector('.nav-badge')).toBeNull();
  });

  it('keeps the number out of quiet mode', () => {
    render(<NavMenu currentView="journal" onViewChange={vi.fn()} t={t} unreadMessages={4} />, { wrapper: QuietModeOn });
    fireEvent.click(screen.getByRole('button', { name: 'Social' }));

    const messages = screen.getByRole('button', { name: 'Messages' });
    expect(messages).toHaveAccessibleDescription('Unread messages');
    expect(messages.querySelector('.nav-badge')).toHaveClass('nav-badge-dot');
    expect(messages.querySelector('.nav-badge')).toHaveTextContent('');
  });
});
