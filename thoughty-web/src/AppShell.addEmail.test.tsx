import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import {
  cleanupAppTestHarness,
  renderAppShell,
  resetAppTestHarness,
  setMockAuthState,
} from './test/appTestHarness';

const WITHOUT_EMAIL = { id: 'test-user-id', username: 'TestUser', email: 'user-1@invalid', emailMissing: true };

describe('AppShell for an account without an email address', () => {
  beforeEach(resetAppTestHarness);
  afterEach(cleanupAppTestHarness);

  it('asks for an address before the journal', async () => {
    setMockAuthState({ user: WITHOUT_EMAIL });

    renderAppShell();

    expect(await screen.findByTestId('add-email-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add your email address' })).toBeInTheDocument();
  });

  it('lets the journal open offline, where no address can be given', async () => {
    setMockAuthState({ user: WITHOUT_EMAIL, offline: true });

    renderAppShell();

    expect(await screen.findByRole('main')).toBeInTheDocument();
    expect(screen.queryByTestId('add-email-page')).not.toBeInTheDocument();
  });
});
