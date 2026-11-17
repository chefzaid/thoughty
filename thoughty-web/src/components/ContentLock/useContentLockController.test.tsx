import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '../../test/queryClient';
import { getContentUnlockToken, setContentUnlockToken } from '../../services/api/contentUnlockToken';
import { translations } from '../../utils/translations';
import { useContentLockController } from './useContentLockController';
import type { ContentLockControllerApi } from './useContentLockController';

const service = vi.hoisted(() => ({
  status: vi.fn(),
  setPin: vi.fn(),
  removePin: vi.fn(),
  unlock: vi.fn(),
  lock: vi.fn(),
  setEntryLocked: vi.fn(),
  setDiaryLocked: vi.fn(),
}));

vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;
const status = (overrides: Record<string, unknown> = {}) => ({
  data: { pinSet: true, hasLockedContent: true, unlocked: false, unlockExpiresAt: null, attemptsLeft: 5, blockedUntil: null, ...overrides },
  error: null,
});

let api: ContentLockControllerApi;
let epoch = 0;
function Harness() {
  const controller = useContentLockController({ isDark: true, language: 'en', t });
  api = controller.api;
  epoch = controller.epoch;
  return <>{controller.dialog}<p data-testid="state">{`${controller.api.pinSet}-${controller.api.unlocked}`}</p></>;
}
const renderController = () => render(<QueryClientProvider client={createTestQueryClient()}><Harness /></QueryClientProvider>);

describe('useContentLockController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.status.mockResolvedValue(status());
    service.lock.mockResolvedValue({ data: { success: true }, error: null });
  });
  afterEach(() => setContentUnlockToken(null));

  it('asks for the PIN, says how many tries are left, and keeps the unlock once it is right', async () => {
    renderController();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('true-false'));
    service.unlock.mockResolvedValueOnce({ data: null, error: 'apiError_CONTENT_PIN_INCORRECT' });
    service.status.mockResolvedValueOnce(status({ attemptsLeft: 3 }));

    let unlocked: Promise<boolean> = Promise.resolve(false);
    act(() => { unlocked = api.requestUnlock(); });
    const field = await screen.findByLabelText('pinDialogField');
    fireEvent.change(field, { target: { value: '00a00' } });
    expect(field).toHaveValue('0000');
    fireEvent.click(screen.getByRole('button', { name: 'pinUnblur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pinWrong 3');

    service.unlock.mockResolvedValueOnce({ data: { token: 'tok', expiresAt: '2026-11-17T10:15:00Z' }, error: null });
    service.status.mockResolvedValue(status({ unlocked: true }));
    fireEvent.change(field, { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinUnblur' }));
    await expect(unlocked).resolves.toBe(true);
    expect(getContentUnlockToken()).toBe('tok');
    await waitFor(() => expect(epoch).toBe(1));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('true-true'));
    await expect(api.requestUnlock()).resolves.toBe(true);

    await act(() => api.lock());
    expect(service.lock).toHaveBeenCalledTimes(1);
    expect(getContentUnlockToken()).toBeNull();
    await waitFor(() => expect(epoch).toBe(2));
  });

  it('says until when tries are blocked, and resolves false when the dialog is closed', async () => {
    renderController();
    await waitFor(() => expect(service.status).toHaveBeenCalled());
    service.unlock.mockResolvedValueOnce({ data: null, error: 'apiError_CONTENT_PIN_BLOCKED' });
    service.status.mockResolvedValueOnce(status({ attemptsLeft: 0, blockedUntil: '2026-11-17T10:30:00Z' }));
    let unlocked: Promise<boolean> = Promise.resolve(true);
    act(() => { unlocked = api.requestUnlock(); });
    fireEvent.change(await screen.findByLabelText('pinDialogField'), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinUnblur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pinBlocked');

    service.unlock.mockResolvedValueOnce({ data: null, error: 'apiError_RATE_LIMITED' });
    fireEvent.change(screen.getByLabelText('pinDialogField'), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinUnblur' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('apiError_RATE_LIMITED'));

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await expect(unlocked).resolves.toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks for a first PIN before locking, twice the same, then locks the entry', async () => {
    service.status.mockResolvedValue(status({ pinSet: false, hasLockedContent: false }));
    service.setPin.mockResolvedValue({ data: { success: true }, error: null });
    service.setEntryLocked.mockResolvedValue({ data: { success: true }, error: null });
    renderController();
    await waitFor(() => expect(service.status).toHaveBeenCalled());

    let locked: Promise<boolean> = Promise.resolve(false);
    act(() => { locked = api.setEntryLocked(4, true); });
    fireEvent.change(await screen.findByLabelText('pinNew'), { target: { value: '2468' } });
    fireEvent.change(screen.getByLabelText('pinConfirm'), { target: { value: '1357' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pinMismatch');
    expect(service.setPin).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('pinConfirm'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    await expect(locked).resolves.toBe(true);
    expect(service.setPin).toHaveBeenCalledWith('2468');
    expect(service.setEntryLocked).toHaveBeenCalledWith(4, true);
  });

  it('lifts a diary’s lock only after the PIN, and lets go of an unlock the server ended', async () => {
    renderController();
    await waitFor(() => expect(service.status).toHaveBeenCalled());
    let lifted: Promise<boolean> = Promise.resolve(true);
    act(() => { lifted = api.setDiaryLocked(2, false); });
    fireEvent.click(await screen.findByRole('button', { name: 'cancel' }));
    await expect(lifted).resolves.toBe(false);
    expect(service.setDiaryLocked).not.toHaveBeenCalled();

    service.setDiaryLocked.mockResolvedValue({ data: null, error: 'apiError_CONTENT_LOCKED' });
    act(() => setContentUnlockToken('tok'));
    await expect(api.setDiaryLocked(2, false)).resolves.toBe(false);
    await act(() => api.refresh());
    await waitFor(() => expect(getContentUnlockToken()).toBeNull());
  });

  it('names its strings in English and French', () => {
    expect(translations.en.pinLockNotEncryption).toBe('Hides these entries behind your PIN on this account. It is not encryption.');
    expect(translations.fr.pinLockNotEncryption).toContain('Ce n’est pas un chiffrement');
    expect(translations.fr.apiError_CONTENT_PIN_BLOCKED).toBeTruthy();
  });
});
