import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UnsubscribePage from './UnsubscribePage';

const { unsubscribeEmail } = vi.hoisted(() => ({ unsubscribeEmail: vi.fn() }));

vi.mock('../../services/api', () => ({ unsubscribeEmail }));

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
    unsubscribeEmail.mockResolvedValue({ data: { success: true, kind: 'on-this-day' }, error: null });
    const { onContinue } = renderPage('/unsubscribe?token=3.signed');

    expect(screen.getByText('emailUnsubscribing')).toBeInTheDocument();
    expect(await screen.findByText('onThisDayUnsubscribed')).toBeInTheDocument();
    expect(unsubscribeEmail).toHaveBeenCalledTimes(1);
    expect(unsubscribeEmail).toHaveBeenCalledWith('3.signed');

    await userEvent.click(screen.getByRole('button', { name: 'continueToThoughty' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('says which email went off: the monthly recap', async () => {
    unsubscribeEmail.mockResolvedValue({ data: { success: true, kind: 'monthly-recap' }, error: null });
    renderPage('/unsubscribe?token=recap.3.signed');

    expect(await screen.findByText('monthlyRecapUnsubscribed')).toBeInTheDocument();
    expect(unsubscribeEmail).toHaveBeenCalledWith('recap.3.signed');
    expect(screen.getByRole('heading', { name: 'emailUnsubscribeTitle' })).toBeInTheDocument();
  });

  it('shows why it failed and tries again', async () => {
    unsubscribeEmail
      .mockResolvedValueOnce({ data: null, error: 'apiError_EMAIL_UNSUBSCRIBE_INVALID' })
      .mockResolvedValueOnce({ data: { success: true, kind: 'on-this-day' }, error: null });
    renderPage('/unsubscribe?token=3.bad');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('apiError_EMAIL_UNSUBSCRIBE_INVALID'));
    await userEvent.click(screen.getByRole('button', { name: 'tryAgain' }));
    expect(await screen.findByText('onThisDayUnsubscribed')).toBeInTheDocument();
  });

  it('falls back to a generic failure, and says when the link has no token', async () => {
    unsubscribeEmail.mockResolvedValue({ data: null, error: null });
    const { unmount } = renderPage('/unsubscribe?token=3.x');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('emailUnsubscribeFailed'));
    unmount();

    renderPage('/unsubscribe');
    expect(screen.getByRole('alert')).toHaveTextContent('emailUnsubscribeMissing');
    expect(screen.getByRole('button', { name: 'continueToThoughty' })).toBeInTheDocument();
    expect(unsubscribeEmail).toHaveBeenCalledTimes(1);
  });

  it('ignores an answer that arrives after leaving the page', async () => {
    let finish: (value: unknown) => void = () => undefined;
    unsubscribeEmail.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { unmount } = renderPage('/unsubscribe?token=3.slow');
    unmount();
    finish({ data: { success: true, kind: 'on-this-day' }, error: null });
    await Promise.resolve();
    expect(unsubscribeEmail).toHaveBeenCalledTimes(1);
  });
});
