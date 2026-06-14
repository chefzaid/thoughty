import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByRole('heading', { name: 'Thoughty' })).toBeInTheDocument();
    expect(screen.getByText('Private writing, built to stay useful')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Sign Up' })).toHaveLength(2);
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

  it('loads the about page from /about', async () => {
    globalThis.history.replaceState({}, '', '/about');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'A quieter home for the thoughts worth keeping.' })).toBeInTheDocument();
      expect(screen.getByText('About Thoughty')).toBeInTheDocument();
    });
  });

  it('loads the privacy policy from /privacy', async () => {
    globalThis.history.replaceState({}, '', '/privacy');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
      expect(screen.getByText('Private by design')).toBeInTheDocument();
    });
  });

  it('loads the terms of service from /terms', async () => {
    globalThis.history.replaceState({}, '', '/terms');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
      expect(screen.getByText('Using Thoughty')).toBeInTheDocument();
    });
  });

  it('loads the contact and support page from /contact', async () => {
    globalThis.history.replaceState({}, '', '/contact');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Contact and support' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'How to guides' })).toBeInTheDocument();
    });
  });

  it('loads the feedback page from /feedback', async () => {
    globalThis.history.replaceState({}, '', '/feedback');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Shape what Thoughty becomes next.' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Ideas from the community' })).toBeInTheDocument();
    });
  });

  it('loads the blog page from /blog', async () => {
    globalThis.history.replaceState({}, '', '/blog');
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Updates, tips, and journaling inspiration.' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'From the journal desk' })).toBeInTheDocument();
    });
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
    expect(screen.getByRole('heading', { name: 'Thoughty' })).toBeInTheDocument();
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
});
