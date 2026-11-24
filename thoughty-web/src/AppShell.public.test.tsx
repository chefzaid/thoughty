import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  cleanupAppTestHarness,
  renderAppShell,
  resetAppTestHarness,
  setMockAuthState,
} from './test/appTestHarness';

describe('AppShell public flows', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('shows the public intro page when the user is not authenticated', () => {
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    expect(screen.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeInTheDocument();
    expect(screen.getByText('Private journal · Guided memoir · Your own book')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Start your journal' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Sign Up' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Sign In' })).toHaveLength(2);
  });

  it('loads the sign-in screen from /login', async () => {
    globalThis.history.replaceState({}, '', '/login');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByLabelText('Email or Username')).toBeInTheDocument();
    });
  });

  it('loads the sign-up screen from /register', async () => {
    globalThis.history.replaceState({}, '', '/register');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByText('Create your account')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });
  });

  it.each([
    ['/about', 'A quieter home for the thoughts worth keeping.', 'About Thoughty'],
    ['/privacy', 'Privacy Policy', 'Private by design'],
    ['/terms', 'Terms of Service', 'Using Thoughty'],
  ])('loads the public page %s', async (path, heading, text) => {
    globalThis.history.replaceState({}, '', path);
    setMockAuthState({ user: null, isAuthenticated: false });
    renderAppShell();
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
  });



  it.each([
    ['/contact', 'Contact and support', 'How to guides'],
    ['/feedback', 'Shape what Thoughty becomes next.', 'Ideas from the community'],
    ['/blog', 'Updates, tips, and journaling inspiration.', 'From the journal desk'],
    ['/journal-templates', 'Journal templates for the days you do not know where to start.', 'Gratitude journal'],
    ['/memoir-questions', 'Questions to ask your parents, and yourself.', 'Turn the answers into a book'],
  ])('loads the community page %s', async (path, heading, sectionHeading) => {
    globalThis.history.replaceState({}, '', path);
    setMockAuthState({ user: null, isAuthenticated: false });
    renderAppShell();
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: sectionHeading })).toBeInTheDocument();
  });



  it('loads the public email verification route', async () => {
    const verifyEmail = vi.fn().mockResolvedValue({ success: true });
    globalThis.history.replaceState({}, '', '/verify-email?token=route-token');
    setMockAuthState({ user: null, isAuthenticated: false, verifyEmail });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
      expect(screen.getByText('Your email is verified.')).toBeInTheDocument();
    });
    expect(verifyEmail).toHaveBeenCalledWith('route-token');
  });

  it('loads the sign-up link route and opens the welcome page once the account is created', async () => {
    // Completing the sign-up signs the new writer in, as the auth context does, so the app stays open
    const completeSignUp = vi.fn(async () => {
      setMockAuthState({ completeSignUp });
      return { success: true, isNewUser: true };
    });
    globalThis.history.replaceState({}, '', '/complete-sign-up?token=link-token');
    setMockAuthState({ user: null, isAuthenticated: false, completeSignUp });

    renderAppShell();

    expect(await screen.findByRole('heading', { name: 'Finish creating your account' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Password'), 'Pass123!@');
    await userEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(completeSignUp).toHaveBeenCalledWith('link-token', 'Pass123!@', undefined);
    await waitFor(() => expect(globalThis.location.pathname).toBe('/welcome'));
    expect(await screen.findByRole('heading', { name: 'Welcome to Thoughty' })).toBeInTheDocument();
  });

  it('loads the password reset link route, drops the token from the address and goes on to sign in', async () => {
    const resetPassword = vi.fn().mockResolvedValue({ success: true });
    globalThis.history.replaceState({}, '', '/reset-password?token=reset-token');
    setMockAuthState({ user: null, isAuthenticated: false, resetPassword });

    renderAppShell();

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    expect(globalThis.location.search).toBe('');
    await userEvent.type(screen.getByLabelText('New Password'), 'NewPass1!');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'NewPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'Save the new password' }));
    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'NewPass1!');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(globalThis.location.pathname).toBe('/login'));
  });

  it('loads the public unsubscribe route and turns the email off without signing in', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, kind: 'on-this-day' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    globalThis.history.replaceState({}, '', '/unsubscribe?token=3.signed');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    expect(await screen.findByRole('heading', { name: 'Unsubscribe' })).toBeInTheDocument();
    expect(await screen.findByText(/You won’t receive “On this day” emails anymore/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/email-unsubscribe?token=3.signed', { method: 'POST' });
    await userEvent.click(screen.getByRole('button', { name: 'Continue to Thoughty' }));
    expect(globalThis.location.pathname).toBe('/');
    fetchSpy.mockRestore();
  });

  it('navigates from the intro page to sign in and sign up modes', async () => {
    const user = userEvent.setup();
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    const signInButton = screen.getAllByRole('button', { name: 'Sign In' })[0];
    expect(signInButton).toBeDefined();
    await user.click(signInButton as HTMLElement);
    expect(globalThis.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(globalThis.location.pathname).toBe('/');

    const signUpButton = screen.getAllByRole('button', { name: 'Sign Up' })[0];
    expect(signUpButton).toBeDefined();
    await user.click(signUpButton as HTMLElement);
    expect(globalThis.location.pathname).toBe('/register');
    expect(screen.getByText('Create your account')).toBeInTheDocument();
  });

  it('navigates back home from the about page', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/about');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(globalThis.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeInTheDocument();
  });

  it('shows loading spinner when auth is loading', () => {
    setMockAuthState({ user: null, loading: true, isAuthenticated: false });

    const { container } = renderAppShell();

    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });

  it('shows the auth page when the user is not authenticated', async () => {
    setMockAuthState({ user: null, loading: false, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Sign In' })[0]).toBeInTheDocument();
    });
  });

  it('says Thoughty cannot be reached, not sign in, to a writer whose session it could not confirm', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/journal');
    setMockAuthState({ user: null, isAuthenticated: false, unreachable: true });
    const { useAuth } = await import('./contexts/AuthContext');
    const { retrySession, logout } = useAuth();

    renderAppShell();

    expect(await screen.findByRole('heading', { level: 1, name: 'Thoughty can’t be reached right now' })).toBeInTheDocument();
    expect(screen.getByText(/You’re still signed in/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email or Username')).not.toBeInTheDocument();
    expect(globalThis.location.pathname).toBe('/journal');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retrySession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('still shows the presentation page to a writer whose session it could not confirm', () => {
    globalThis.history.replaceState({}, '', '/');
    setMockAuthState({ user: null, isAuthenticated: false, unreachable: true });

    renderAppShell();

    expect(screen.getByRole('heading', { level: 1, name: 'A private journal that becomes your life story.' })).toBeInTheDocument();
  });

  it('lets a visitor switch the language and theme, which this browser remembers', async () => {
    const user = userEvent.setup();
    globalThis.history.replaceState({}, '', '/');
    setMockAuthState({ user: null, isAuthenticated: false });

    const { unmount } = renderAppShell();
    const preferences = screen.getByRole('group', { name: 'Language and theme' });
    await user.click(within(preferences).getByRole('button', { name: 'Français' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Un journal privé qui devient l’histoire de votre vie.' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
    await user.click(screen.getByRole('button', { name: 'Utiliser le thème clair' }));
    expect(document.body).toHaveClass('light-mode');
    unmount();

    renderAppShell();
    expect(screen.getByRole('heading', { level: 1, name: 'Un journal privé qui devient l’histoire de votre vie.' })).toBeInTheDocument();
    expect(document.body).toHaveClass('light-mode');
  });

  it('offers no visitor switch to a signed-in writer, whose settings apply', async () => {
    globalThis.history.replaceState({}, '', '/about');
    setMockAuthState({ isAuthenticated: true });
    renderAppShell();

    expect(await screen.findByRole('heading', { name: 'A quieter home for the thoughts worth keeping.' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Language and theme' })).toBeNull();
  });
});
