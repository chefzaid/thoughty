import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import VisitorPreferencesSwitch from './VisitorPreferencesSwitch';
import { getTranslation, type Language } from '../../utils/translations';

function renderSwitch(language: Language, theme: 'light' | 'dark') {
  const preferences = { language, preferredLanguage: language, theme, chooseLanguage: vi.fn(), chooseTheme: vi.fn() };
  render(<VisitorPreferencesSwitch preferences={preferences} t={(key) => getTranslation(language, key)} />);
  return preferences;
}

describe('VisitorPreferencesSwitch', () => {
  it('shows the language in use and picks another', async () => {
    const user = userEvent.setup();
    const preferences = renderSwitch('en', 'dark');

    const group = screen.getByRole('group', { name: 'Language and theme' });
    expect(group).toHaveClass('dark');
    const languages = within(group).getByRole('group', { name: 'Language' });
    expect(within(languages).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    const french = within(languages).getByRole('button', { name: 'Français' });
    expect(french).toHaveAttribute('aria-pressed', 'false');
    expect(french).toHaveAttribute('lang', 'fr');

    await user.click(french);
    expect(preferences.chooseLanguage).toHaveBeenCalledWith('fr');
  });

  it('offers the other theme, in the language in use', async () => {
    const user = userEvent.setup();
    const dark = renderSwitch('fr', 'dark');
    await user.click(screen.getByRole('button', { name: 'Utiliser le thème clair' }));
    expect(dark.chooseTheme).toHaveBeenCalledWith('light');
  });

  it('offers the dark theme from the light one', async () => {
    const user = userEvent.setup();
    const light = renderSwitch('en', 'light');
    expect(screen.getByRole('group', { name: 'Language and theme' })).toHaveClass('light');
    await user.click(screen.getByRole('button', { name: 'Use the dark theme' }));
    expect(light.chooseTheme).toHaveBeenCalledWith('dark');
  });
});
