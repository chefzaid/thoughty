import { describe, it, expect } from 'vitest';
import {
  getDefaultBirthday,
  mergeUserProfileDefaults,
  validatePasswordChange,
  validateDeleteAccount,
  isValidImageFile,
  DEFAULT_BIRTHDAY_YEARS_AGO,
  MAX_AVATAR_SIZE_BYTES,
} from './types';
import type { ProfileConfig, ProfileUser } from './types';

describe('ProfilePage types utilities', () => {
  const t = (key: string) => key;

  describe('getDefaultBirthday', () => {
    it('returns a date string 18 years ago by default', () => {
      const result = getDefaultBirthday();
      const date = new Date(result);
      const now = new Date();
      const diff = now.getFullYear() - date.getFullYear();
      expect(diff).toBe(DEFAULT_BIRTHDAY_YEARS_AGO);
    });

    it('returns a date string N years ago when specified', () => {
      const result = getDefaultBirthday(25);
      const date = new Date(result);
      const now = new Date();
      expect(now.getFullYear() - date.getFullYear()).toBe(25);
    });

    it('returns ISO date format (YYYY-MM-DD)', () => {
      const result = getDefaultBirthday();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('mergeUserProfileDefaults', () => {
    it('returns prev config unchanged when user is null', () => {
      const prev: ProfileConfig = { name: 'Test' };
      const result = mergeUserProfileDefaults(prev, null);
      expect(result).toBe(prev);
    });

    it('merges email from user when not set in config', () => {
      const prev: ProfileConfig = {};
      const user: ProfileUser = { email: 'user@example.com' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.email).toBe('user@example.com');
    });

    it('does not overwrite existing email', () => {
      const prev: ProfileConfig = { email: 'existing@example.com' };
      const user: ProfileUser = { email: 'user@example.com' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.email).toBe('existing@example.com');
    });

    it('merges username when name is User', () => {
      const prev: ProfileConfig = { name: 'User' };
      const user: ProfileUser = { username: 'JohnDoe' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.name).toBe('JohnDoe');
    });

    it('merges username when name is empty', () => {
      const prev: ProfileConfig = {};
      const user: ProfileUser = { username: 'JohnDoe' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.name).toBe('JohnDoe');
    });

    it('does not overwrite existing custom name', () => {
      const prev: ProfileConfig = { name: 'Custom Name' };
      const user: ProfileUser = { username: 'JohnDoe' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.name).toBe('Custom Name');
    });

    it('merges avatarUrl when not set', () => {
      const prev: ProfileConfig = {};
      const user: ProfileUser = { avatarUrl: 'https://example.com/avatar.png' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('does not overwrite existing avatarUrl', () => {
      const prev: ProfileConfig = { avatarUrl: 'existing.png' };
      const user: ProfileUser = { avatarUrl: 'https://example.com/avatar.png' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result.avatarUrl).toBe('existing.png');
    });

    it('returns same object reference when no updates needed', () => {
      const prev: ProfileConfig = { email: 'e@e.com', name: 'Custom', avatarUrl: 'a.png' };
      const user: ProfileUser = { email: 'other@e.com', username: 'u' };
      const result = mergeUserProfileDefaults(prev, user);
      expect(result).toBe(prev);
    });
  });

  describe('validatePasswordChange', () => {
    it('returns error when current password is empty', () => {
      const result = validatePasswordChange({
        currentPassword: '',
        newPassword: 'newpass123',
        confirmNewPassword: 'newpass123',
        t,
      });
      expect(result).toBe('currentAndNewPasswordRequired');
    });

    it('returns error when new password is empty', () => {
      const result = validatePasswordChange({
        currentPassword: 'current',
        newPassword: '',
        confirmNewPassword: '',
        t,
      });
      expect(result).toBe('currentAndNewPasswordRequired');
    });

    it('returns error when new password is too short', () => {
      const result = validatePasswordChange({
        currentPassword: 'current',
        newPassword: '12345',
        confirmNewPassword: '12345',
        t,
      });
      expect(result).toBe('passwordMinLength');
    });

    it('returns error when passwords do not match', () => {
      const result = validatePasswordChange({
        currentPassword: 'current',
        newPassword: 'newpass123',
        confirmNewPassword: 'different',
        t,
      });
      expect(result).toBe('passwordsDoNotMatch');
    });

    it('returns empty string when validation passes', () => {
      const result = validatePasswordChange({
        currentPassword: 'current',
        newPassword: 'newpass123',
        confirmNewPassword: 'newpass123',
        t,
      });
      expect(result).toBe('');
    });
  });

  describe('validateDeleteAccount', () => {
    it('returns error when delete text is not DELETE', () => {
      const result = validateDeleteAccount({
        deleteConfirmText: 'delete',
        user: null,
        deletePassword: '',
        t,
      });
      expect(result).toBe('typeDeleteToConfirm');
    });

    it('returns error for local auth user without password', () => {
      const result = validateDeleteAccount({
        deleteConfirmText: 'DELETE',
        user: { authProvider: 'local' },
        deletePassword: '',
        t,
      });
      expect(result).toBe('passwordRequired');
    });

    it('passes for local auth user with password', () => {
      const result = validateDeleteAccount({
        deleteConfirmText: 'DELETE',
        user: { authProvider: 'local' },
        deletePassword: 'mypassword',
        t,
      });
      expect(result).toBe('');
    });

    it('passes for OAuth user without password', () => {
      const result = validateDeleteAccount({
        deleteConfirmText: 'DELETE',
        user: { authProvider: 'google' },
        deletePassword: '',
        t,
      });
      expect(result).toBe('');
    });

    it('passes when user is null', () => {
      const result = validateDeleteAccount({
        deleteConfirmText: 'DELETE',
        user: null,
        deletePassword: '',
        t,
      });
      expect(result).toBe('');
    });
  });

  describe('isValidImageFile', () => {
    it('returns true for a valid image file', () => {
      const file = new File(['data'], 'photo.png', { type: 'image/png' });
      expect(isValidImageFile(file)).toBe(true);
    });

    it('returns false for non-image file', () => {
      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      expect(isValidImageFile(file)).toBe(false);
    });

    it('returns false for oversized image', () => {
      const bigContent = new Uint8Array(MAX_AVATAR_SIZE_BYTES + 1);
      const file = new File([bigContent], 'big.png', { type: 'image/png' });
      expect(isValidImageFile(file)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidImageFile(undefined)).toBe(false);
    });
  });

  describe('constants', () => {
    it('DEFAULT_BIRTHDAY_YEARS_AGO is 18', () => {
      expect(DEFAULT_BIRTHDAY_YEARS_AGO).toBe(18);
    });

    it('MAX_AVATAR_SIZE_BYTES is 5MB', () => {
      expect(MAX_AVATAR_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });
  });
});
