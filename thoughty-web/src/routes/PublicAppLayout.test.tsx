import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PublicAppLayout from './PublicAppLayout';

function RouteFixture() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <PublicAppLayout t={(key) => key}>
      <main>
        <p>{location.pathname}</p>
        <button type="button" onClick={() => navigate('/blog')}>
          Open blog
        </button>
      </main>
    </PublicAppLayout>
  );
}

describe('PublicAppLayout', () => {
  it('provides skip navigation and focuses content after route changes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/about']}>
        <RouteFixture />
      </MemoryRouter>,
    );

    const content = document.querySelector<HTMLElement>('#public-page-content');
    const skipLink = screen.getByRole('link', { name: 'skipToContent' });

    expect(skipLink).toHaveAttribute('href', '#public-page-content');
    expect(content).toHaveAttribute('tabindex', '-1');

    await user.click(skipLink);
    expect(content).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Open blog' }));
    expect(await screen.findByText('/blog')).toBeVisible();
    expect(content).toHaveFocus();
  });

  it('offers the language and theme switch to a visitor only', () => {
    const visitor = { language: 'en' as const, preferredLanguage: 'en' as const, theme: 'dark' as const, chooseLanguage: vi.fn(), chooseTheme: vi.fn() };
    const { rerender } = render(
      <MemoryRouter>
        <PublicAppLayout t={(key) => key} visitorPreferences={visitor}><main>Page</main></PublicAppLayout>
      </MemoryRouter>,
    );
    expect(screen.getByRole('group', { name: 'visitorPreferencesLabel' })).toBeVisible();

    rerender(
      <MemoryRouter>
        <PublicAppLayout t={(key) => key} visitorPreferences={null}><main>Page</main></PublicAppLayout>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('group', { name: 'visitorPreferencesLabel' })).toBeNull();
  });

  describe('on a localized public page', () => {
    function visitorReading(preferredLanguage: 'en' | 'fr') {
      return { language: preferredLanguage, preferredLanguage, theme: 'dark' as const, chooseLanguage: vi.fn(), chooseTheme: vi.fn() };
    }

    function PathProbe() {
      const location = useLocation();
      return <p data-testid="path">{location.pathname + location.search + location.hash}</p>;
    }

    function renderAt(path: string, visitor: ReturnType<typeof visitorReading> | null, writerLanguage: 'en' | 'fr' | null = null) {
      return render(
        <MemoryRouter initialEntries={[path]}>
          <PublicAppLayout t={(key) => key} visitorPreferences={visitor} preferredLanguage={visitor?.preferredLanguage ?? writerLanguage}>
            <main>Page</main>
          </PublicAppLayout>
          <PathProbe />
        </MemoryRouter>,
      );
    }

    const headLinks = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"], link[rel="alternate"]')]
      .map((link) => [link.rel, link.hreflang, link.getAttribute('href')]);

    it('names its own address and its address in each language, and takes them away with it', () => {
      const origin = globalThis.location.origin;
      const { unmount } = renderAt('/fr/memoir-questions?from=footer', visitorReading('en'));

      expect(headLinks()).toEqual([
        ['canonical', '', `${origin}/fr/memoir-questions`],
        ['alternate', 'en', `${origin}/memoir-questions`],
        ['alternate', 'fr', `${origin}/fr/memoir-questions`],
        ['alternate', 'x-default', `${origin}/memoir-questions`],
      ]);
      unmount();
      expect(headLinks()).toEqual([]);
    });

    it('names no address on the other public pages', () => {
      renderAt('/login', visitorReading('en'));
      expect(headLinks()).toEqual([]);
    });

    it('sends a visitor who reads French from the English address to the French one', () => {
      renderAt('/about?ref=mail#team', visitorReading('fr'));
      expect(screen.getByTestId('path')).toHaveTextContent('/fr/about?ref=mail#team');
      expect(screen.getByText('Page')).toBeVisible();
    });

    it('sends a French writer there too, once their settings are read', () => {
      renderAt('/terms', null, 'fr');
      expect(screen.getByTestId('path')).toHaveTextContent('/fr/terms');
      cleanup();
      renderAt('/terms', null, null);
      expect(screen.getByTestId('path')).toHaveTextContent('/terms');
    });

    it('leaves an English reader on a French address', () => {
      renderAt('/fr/about', visitorReading('en'));
      expect(screen.getByTestId('path')).toHaveTextContent('/fr/about');
      cleanup();
      renderAt('/fr/about', null, 'en');
      expect(screen.getByTestId('path')).toHaveTextContent('/fr/about');
    });

    it('shows the path’s language in the switch, which opens the page in the other', async () => {
      const user = userEvent.setup();
      const visitor = visitorReading('en');
      renderAt('/fr/blog', visitor);

      expect(screen.getByRole('button', { name: 'Français' })).toHaveAttribute('aria-pressed', 'true');
      await user.click(screen.getByRole('button', { name: 'Français' }));
      expect(screen.getByTestId('path')).toHaveTextContent('/fr/blog');

      await user.click(screen.getByRole('button', { name: 'English' }));
      expect(visitor.chooseLanguage).toHaveBeenLastCalledWith('en');
      expect(screen.getByTestId('path')).toHaveTextContent(/^\/blog$/);
    });
  });
});
