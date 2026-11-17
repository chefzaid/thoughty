import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '../../types';
import { ContentLockContext, type ContentLockApi } from './contentLockContext';
import DiaryLockButton from './DiaryLockButton';
import LockedEntryCard from './LockedEntryCard';
import PinLockSection from './PinLockSection';
import { useEntryLockAction } from './useEntryLockAction';

const service = vi.hoisted(() => ({ setPin: vi.fn(), removePin: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;
const lockApi = (overrides: Partial<ContentLockApi> = {}): ContentLockApi => ({
  pinSet: true,
  hasLockedContent: true,
  unlocked: false,
  requestUnlock: vi.fn(async () => true),
  unblur: vi.fn(async () => undefined),
  lock: vi.fn(async () => undefined),
  ensurePin: vi.fn(async () => true),
  refresh: vi.fn(async () => undefined),
  setEntryLocked: vi.fn(async () => true),
  setDiaryLocked: vi.fn(async () => true),
  ...overrides,
});
const withLock = (api: ContentLockApi, children: ReactNode) => <ContentLockContext.Provider value={api}>{children}</ContentLockContext.Provider>;
const entry = (overrides: Partial<Entry> = {}): Entry => ({ id: 4, date: '2026-11-01', content: '', tags: [], visibility: 'private', title: 'The keeper', withheld: true, ...overrides });

function LockActionProbe({ value }: { readonly value: Entry }) {
  const { action, dialog } = useEntryLockAction(value, 'dark', t);
  return (
    <>
      {action && <button type="button" disabled={action.disabled} onClick={action.onSelect}>{action.label}</button>}
      {dialog}
    </>
  );
}

describe('LockedEntryCard', () => {
  it('keeps the title, draws bars instead of the text, and unblurs with the PIN', () => {
    const api = lockApi();
    render(withLock(api, <LockedEntryCard entry={entry({ diary_name: 'Vault', diary_icon: '🔒' })} theme="light" showDiaryLabel t={t} />));

    const card = screen.getByRole('region', { name: 'lockedEntryLabel' });
    expect(card).toHaveTextContent('The keeper');
    expect(card).toHaveTextContent('Vault');
    fireEvent.click(screen.getByRole('button', { name: 'lockedEntryUnblur' }));
    expect(api.unblur).toHaveBeenCalled();
  });

  it('offers no unblur outside the signed-in app', () => {
    render(<LockedEntryCard entry={entry({ title: null })} showDiaryLabel={false} t={t} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('useEntryLockAction', () => {
  it('confirms before locking, removes its own lock at once, and says when the diary locks it', async () => {
    const api = lockApi();
    const { rerender } = render(withLock(api, <LockActionProbe value={entry({ is_locked: false })} />));
    fireEvent.click(screen.getByRole('button', { name: 'entryLockAction' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('entryLockMessage');
    fireEvent.click(screen.getByRole('button', { name: 'entryLockConfirm' }));
    expect(api.setEntryLocked).toHaveBeenCalledWith(4, true);

    rerender(withLock(api, <LockActionProbe value={entry({ is_locked: true })} />));
    fireEvent.click(screen.getByRole('button', { name: 'entryUnlockAction' }));
    expect(api.setEntryLocked).toHaveBeenLastCalledWith(4, false);

    rerender(withLock(api, <LockActionProbe value={entry({ is_locked: false, diary_locked: true })} />));
    expect(screen.getByRole('button', { name: 'entryLockedWithDiary' })).toBeDisabled();

    rerender(withLock(api, <LockActionProbe value={entry({ sealed_until: '2030-01-01T00:00:00Z' })} />));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('DiaryLockButton', () => {
  it('locks a diary after a confirmation and lifts the lock at once, announcing each', async () => {
    const api = lockApi();
    const { rerender } = render(withLock(api, <DiaryLockButton diary={{ id: 2, name: 'Vault', isLocked: false }} t={t} />));
    const toggle = screen.getByRole('button', { name: 'diaryLock: Vault' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('diaryLockMessage Vault');
    fireEvent.click(screen.getByRole('button', { name: 'entryLockConfirm' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('diaryLockOnAnnouncement'));
    expect(api.setDiaryLocked).toHaveBeenCalledWith(2, true);

    rerender(withLock(api, <DiaryLockButton diary={{ id: 2, name: 'Vault', isLocked: true }} t={t} />));
    fireEvent.click(screen.getByRole('button', { name: 'diaryLock: Vault' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('diaryLockOffAnnouncement'));
  });

  it('is absent outside the signed-in app', () => {
    const { container } = render(<DiaryLockButton diary={{ id: 2, name: 'Vault' }} t={t} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PinLockSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets a first PIN typed twice the same', async () => {
    const api = lockApi({ pinSet: false });
    service.setPin.mockResolvedValue({ data: { success: true }, error: null });
    render(withLock(api, <PinLockSection isDark hasPassword t={t} />));

    fireEvent.change(screen.getByLabelText('pinNew'), { target: { value: '2468' } });
    fireEvent.change(screen.getByLabelText('pinConfirm'), { target: { value: '2460' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pinMismatch');
    fireEvent.change(screen.getByLabelText('pinConfirm'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('pinSaved'));
    expect(service.setPin).toHaveBeenCalledWith('2468', {});
    expect(api.refresh).toHaveBeenCalled();
  });

  it('changes the PIN with the current one, and shows the API’s refusal', async () => {
    const api = lockApi();
    service.setPin.mockResolvedValueOnce({ data: null, error: 'apiError_CONTENT_PIN_INCORRECT' }).mockResolvedValueOnce({ data: { success: true }, error: null });
    render(withLock(api, <PinLockSection isDark={false} hasPassword t={t} />));
    expect(screen.getByText('pinLockNotEncryption')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'pinChange' }));
    fireEvent.change(screen.getByLabelText('pinCurrent'), { target: { value: '1111' } });
    fireEvent.change(screen.getByLabelText('pinNew'), { target: { value: '2468' } });
    fireEvent.change(screen.getByLabelText('pinConfirm'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('apiError_CONTENT_PIN_INCORRECT');
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('pinSaved'));
    expect(service.setPin).toHaveBeenLastCalledWith('2468', { currentPin: '1111' });
  });

  it('resets a forgotten PIN with the password and the emailed code, and removes it', async () => {
    const api = lockApi();
    service.setPin
      .mockResolvedValueOnce({ data: { twoFactorRequired: true, challengeToken: 'challenge', expiresInSeconds: 600 }, error: null })
      .mockResolvedValueOnce({ data: { success: true }, error: null });
    service.removePin.mockResolvedValue({ data: { success: true }, error: null });
    render(withLock(api, <PinLockSection isDark hasPassword t={t} />));

    fireEvent.click(screen.getByRole('button', { name: 'pinChange' }));
    fireEvent.click(screen.getByRole('button', { name: 'pinForgot' }));
    fireEvent.change(screen.getByLabelText('pinPassword'), { target: { value: 'Secret123!' } });
    fireEvent.change(screen.getByLabelText('pinNew'), { target: { value: '2468' } });
    fireEvent.change(screen.getByLabelText('pinConfirm'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('pinEmailCodeSent'));
    fireEvent.change(screen.getByLabelText('pinEmailCode'), { target: { value: '12a3456' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinSave' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('pinSaved'));
    expect(service.setPin).toHaveBeenLastCalledWith('2468', { password: 'Secret123!', challengeToken: 'challenge', code: '123456' });

    fireEvent.click(screen.getByRole('button', { name: 'pinRemove' }));
    expect(screen.getByText('pinRemoveHint')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('pinCurrent'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'pinRemove' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('pinRemoved'));
    expect(service.removePin).toHaveBeenCalledWith({ currentPin: '2468' });
  });

  it('asks an account without a password only for the emailed code, and can go back', async () => {
    render(withLock(lockApi(), <PinLockSection isDark hasPassword={false} t={t} />));
    fireEvent.click(screen.getByRole('button', { name: 'pinRemove' }));
    fireEvent.click(screen.getByRole('button', { name: 'pinForgot' }));
    expect(screen.queryByLabelText('pinPassword')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pinUseCurrent' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.getByRole('button', { name: 'pinChange' })).toBeInTheDocument();
  });

  it('is absent outside the signed-in app', () => {
    const { container } = render(<PinLockSection isDark hasPassword t={t} />);
    expect(container).toBeEmptyDOMElement();
  });
});
