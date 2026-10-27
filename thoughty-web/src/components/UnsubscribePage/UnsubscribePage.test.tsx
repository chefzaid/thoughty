import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UnsubscribePage from './UnsubscribePage';

const { unsubscribeOnThisDayEmail } = vi.hoisted(() => ({ unsubscribeOnThisDayEmail: vi.fn() }));

vi.mock('../../services/api', () => ({ unsubscribeOnThisDayEmail }));

const t = (key: string) => key;

function renderPage(path: string, onContinue = vi.fn()) {
  globalThis.history.replaceState({}, '', path);
  const view = render(
    <BrowserRouter>
      <UnsubscribePage t={t} theme="light" onContinue={onContinue} />
    </BrowserRouter>,
  );
  return { onContinue, ...view };
}

describe('UnsubscribePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turns the email off once with the link’s token and offers to continue', async () => {
    unsubscribeOnThisDayEmail.mockResolvedValue({ data: { success: true }, error: null });
    const { onContinue } = renderPage('/unsubscribe?token=3.signed');

    expect(screen.getByText('onThisDayUnsubscribing')).toBeInTheDocument();
    expect(await screen.findByText('onThisDayUnsubscribed')).toBeInTheDocument();
    expect(unsubscribeOnThisDayEmail).toHaveBeenCalledTimes(1);
    expect(unsubscribeOnThisDayEmail).toHaveBeenCalledWith('3.signed');

    await userEvent.click(screen.getByRole('button', { name: 'continueToThoughty' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows why it failed and tries again', async () => {
    unsubscribeOnThisDayEmail
      .mockResolvedValueOnce({ data: null, error: 'apiError_ON_THIS_DAY_UNSUBSCRIBE_INVALID' })
      .mockResolvedValueOnce({ data: { success: true }, error: null });
    renderPage('/unsubscribe?token=3.bad');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('apiError_ON_THIS_DAY_UNSUBSCRIBE_INVALID'));
    await userEvent.click(screen.getByRole('button', { name: 'tryAgain' }));
    expect(await screen.findByText('onThisDayUnsubscribed')).toBeInTheDocument();
  });

  it('falls back to a generic failure, and says when the link has no token', async () => {
    unsubscribeOnThisDayEmail.mockResolvedValue({ data: null, error: null });
    const { unmount } = renderPage('/unsubscribe?token=3.x');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('onThisDayUnsubscribeFailed'));
    unmount();

    renderPage('/unsubscribe');
    expect(screen.getByRole('alert')).toHaveTextContent('onThisDayUnsubscribeMissing');
    expect(screen.getByRole('button', { name: 'continueToThoughty' })).toBeInTheDocument();
    expect(unsubscribeOnThisDayEmail).toHaveBeenCalledTimes(1);
  });

  it('ignores an answer that arrives after leaving the page', async () => {
    let finish: (value: unknown) => void = () => undefined;
    unsubscribeOnThisDayEmail.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { unmount } = renderPage('/unsubscribe?token=3.slow');
    unmount();
    finish({ data: { success: true }, error: null });
    await Promise.resolve();
    expect(unsubscribeOnThisDayEmail).toHaveBeenCalledTimes(1);
  });
});
