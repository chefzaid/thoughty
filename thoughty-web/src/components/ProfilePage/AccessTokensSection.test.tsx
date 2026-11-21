import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import AccessTokensSection from './AccessTokensSection';

const list = vi.fn();
const create = vi.fn();
const revoke = vi.fn();
const service = { list, create, revoke };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => service,
}));
vi.mock('../../utils/timeZone', () => ({ browserTimeZone: () => 'Europe/Paris' }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const token = (id: number, changes: Record<string, unknown> = {}) => ({
  id,
  name: `Token ${id}`,
  hint: `thy_ab${id}c`,
  scopes: ['entries:write'],
  expiresAt: '2027-02-19T09:00:00.000Z',
  lastUsedAt: null,
  createdAt: '2026-11-21T09:00:00.000Z',
  ...changes,
});
const SECRET = `thy_${'s'.repeat(43)}`;

describe('AccessTokensSection', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('lists each token with its hint, scopes and dates, and how to call the API', async () => {
    list.mockResolvedValue({
      data: { tokens: [token(1, { scopes: ['entries:read', 'entries:write'], lastUsedAt: '2026-11-21T10:00:00.000Z', expiresAt: null })], limit: 10 },
      error: null,
    });
    render(<AccessTokensSection isDark t={t} />);

    const item = within(await screen.findByRole('list', { name: 'Access tokens' })).getByRole('listitem');
    expect(item).toHaveTextContent('Token 1 thy_ab1c…');
    expect(item).toHaveTextContent('Read entries · Write new entries');
    expect(item).toHaveTextContent(/Last used .*Never expires/);
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${globalThis.location.origin}/api/v1`))).toBeInTheDocument();
  });

  it('makes a token for this browser’s time zone, shows it once to copy, and adds it to the list', async () => {
    list.mockResolvedValue({ data: { tokens: [], limit: 10 }, error: null });
    create.mockResolvedValue({ data: { ...token(4, { name: 'Shortcut', scopes: ['entries:write', 'entries:read'], expiresAt: null }), token: SECRET }, error: null });
    writeText.mockResolvedValue(undefined);
    render(<AccessTokensSection isDark={false} t={t} />);

    expect(await screen.findByText('You have no access tokens.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  Shortcut ' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Read entries' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Expires' }), { target: { value: 'never' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));

    const secret = await screen.findByRole('textbox', { name: 'Your new access token' });
    expect(secret).toHaveValue(SECRET);
    expect(create).toHaveBeenCalledWith({ name: 'Shortcut', scopes: ['entries:write', 'entries:read'], expiresInDays: null, timeZone: 'Europe/Paris' });
    expect(within(screen.getByRole('list', { name: 'Access tokens' })).getByText(/Shortcut/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(SECRET);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('textbox', { name: 'Your new access token' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access tokens' })).toHaveFocus();
  });

  it('says when the token cannot be copied', async () => {
    list.mockResolvedValue({ data: { tokens: [], limit: 10 }, error: null });
    create.mockResolvedValue({ data: { ...token(4), token: SECRET }, error: null });
    writeText.mockRejectedValue(new Error('denied'));
    render(<AccessTokensSection isDark t={t} />);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Name' }), { target: { value: 'CLI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The token could not be copied.');
  });

  it('asks for a name and a scope before sending, and shows the API’s refusal', async () => {
    list.mockResolvedValue({ data: { tokens: [], limit: 10 }, error: null });
    create.mockResolvedValue({ data: null, error: 'apiError_ACCESS_TOKEN_LIMIT_REACHED' });
    render(<AccessTokensSection isDark t={t} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create token' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the token a name.');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'CLI' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Write new entries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one thing the token may do.');
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Read entries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText('You have reached the limit of access tokens. Revoke one first.')).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['entries:read'], expiresInDays: 90 }));
  });

  it('revokes a token after asking, and says when that fails', async () => {
    list.mockResolvedValue({ data: { tokens: [token(1), token(2)], limit: 10 }, error: null });
    revoke.mockResolvedValueOnce({ data: { success: true }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    render(<AccessTokensSection isDark t={t} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke Token 1' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Revoke this token?' });
    expect(dialog).toHaveTextContent('“Token 1” stops working at once.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Revoke Token 1' })).not.toBeInTheDocument());
    expect(revoke).toHaveBeenCalledWith(1);
    expect(screen.getByRole('status')).toHaveTextContent('“Token 1” was revoked.');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Token 2' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The token could not be revoked. Please try again.');
    expect(screen.getByRole('button', { name: 'Revoke Token 2' })).toBeInTheDocument();
  });

  it('closes the confirmation without revoking, and hides the form at the limit', async () => {
    list.mockResolvedValue({ data: { tokens: [token(1), token(2)], limit: 2 }, error: null });
    render(<AccessTokensSection isDark={false} t={t} />);

    expect(await screen.findByText('You hold 2 tokens, the most you can. Revoke one to create another.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create token' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Token 1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(revoke).not.toHaveBeenCalled();
  });

  it.each([
    ['refused', { data: null, error: 'accessTokensLoadFailed' }],
    ['answered without a list', { data: {}, error: null }],
  ])('says when the tokens cannot be loaded (%s)', async (_case, answer) => {
    list.mockResolvedValue(answer);
    render(<AccessTokensSection isDark t={t} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your access tokens could not be loaded.');
    expect(screen.queryByRole('button', { name: 'Create token' })).not.toBeInTheDocument();
  });
});
