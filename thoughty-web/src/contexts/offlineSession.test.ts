import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSignOutPending,
  forgetOfflineSession,
  isSignOutPending,
  markSignOutPending,
  readOfflineDisplay,
  readOfflineUser,
  rememberOfflineDisplay,
  rememberOfflineUser,
} from './offlineSession';

const ADA = { id: 1, username: 'ada', email: 'ada@example.com', authProvider: 'local' as const, emailVerified: true, emailMissing: false, twoFactorEnabled: false };

describe('offlineSession', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('remembers who signed in, without the avatar or anything a session adds', () => {
    rememberOfflineUser({ ...ADA, isNewUser: true, avatarUrl: 'data:image/png;base64,AAAA' });

    expect(readOfflineUser()).toEqual(ADA);
    expect(localStorage.getItem('thoughty.offlineUser')).not.toContain('avatar');
  });

  it('reads a writer remembered before accounts could lack an address as having one', () => {
    const { emailMissing: _missing, ...remembered } = ADA;
    localStorage.setItem('thoughty.offlineUser', JSON.stringify(remembered));
    expect(readOfflineUser()).toEqual(ADA);
    rememberOfflineUser({ ...ADA, emailMissing: true });
    expect(readOfflineUser()).toEqual({ ...ADA, emailMissing: true });
  });

  it('reads nothing back from a missing, broken or foreign record', () => {
    expect(readOfflineUser()).toBeNull();
    localStorage.setItem('thoughty.offlineUser', '{not json');
    expect(readOfflineUser()).toBeNull();
    localStorage.setItem('thoughty.offlineUser', JSON.stringify({ ...ADA, id: '1' }));
    expect(readOfflineUser()).toBeNull();
    localStorage.setItem('thoughty.offlineUser', JSON.stringify({ ...ADA, authProvider: 'other' }));
    expect(readOfflineUser()).toBeNull();
  });

  it('keeps only the settings that change how the app looks and reads', () => {
    rememberOfflineDisplay({ language: 'fr', theme: 'light', fontSize: 18, quietMode: true, bio: 'Private words', email: 'ada@example.com' });

    expect(readOfflineDisplay()).toEqual({ language: 'fr', theme: 'light', fontSize: 18, quietMode: true });
    expect(localStorage.getItem('thoughty.offlineDisplay')).not.toContain('Private');
  });

  it('reads back only known settings of a plain type', () => {
    expect(readOfflineDisplay()).toBeNull();
    localStorage.setItem('thoughty.offlineDisplay', '[1]');
    expect(readOfflineDisplay()).toBeNull();
    localStorage.setItem('thoughty.offlineDisplay', JSON.stringify({ language: 'fr', theme: { dark: true }, bio: 'x' }));
    expect(readOfflineDisplay()).toEqual({ language: 'fr' });
  });

  it('forgets the writer and their settings, leaving the other keys', () => {
    rememberOfflineUser(ADA);
    rememberOfflineDisplay({ language: 'fr' });
    localStorage.setItem('thoughty.composerDraft.1', '{}');

    forgetOfflineSession();

    expect(readOfflineUser()).toBeNull();
    expect(readOfflineDisplay()).toBeNull();
    expect(localStorage.getItem('thoughty.composerDraft.1')).toBe('{}');
  });

  it('keeps a sign-out the server has not heard until it is cleared', () => {
    expect(isSignOutPending()).toBe(false);
    markSignOutPending();
    expect(isSignOutPending()).toBe(true);
    clearSignOutPending();
    expect(isSignOutPending()).toBe(false);
  });

  it('tolerates a storage the browser blocks', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(() => rememberOfflineUser(ADA)).not.toThrow();
    expect(readOfflineUser()).toBeNull();
    expect(() => forgetOfflineSession()).not.toThrow();
    expect(() => clearSignOutPending()).not.toThrow();
    expect(isSignOutPending()).toBe(false);
  });
});
