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

    expect(screen.getByText('A journal that feels calm when you write and sharp when you search.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
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

  it('navigates from the intro page to sign in and sign up modes', async () => {
    const user = userEvent.setup();
    setMockAuthState({ user: null, isAuthenticated: false });

    renderAppShell();

    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(globalThis.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(globalThis.location.pathname).toBe('/');

    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(globalThis.location.pathname).toBe('/register');
    expect(screen.getByText('Create your account')).toBeInTheDocument();
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
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });
  });
});