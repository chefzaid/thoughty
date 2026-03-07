export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;

export interface ProfileConfig {
  name?: string;
  bio?: string;
  email?: string;
  birthday?: string;
  avatarUrl?: string;
  theme?: 'light' | 'dark';
  language?: string;
  entriesPerPage?: number | string;
  defaultVisibility?: 'public' | 'private';
}

export interface ProfileUser {
  username?: string;
  email?: string;
  avatarUrl?: string;
  authProvider?: 'local' | 'google';
}

export interface ProfileStats {
  firstEntryYear?: number;
}

export const DEFAULT_BIRTHDAY_YEARS_AGO = 18;
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const getDefaultBirthday = (yearsAgo = DEFAULT_BIRTHDAY_YEARS_AGO): string => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - yearsAgo);
  return date.toISOString().split('T')[0] ?? '';
};

export const mergeUserProfileDefaults = (prev: ProfileConfig, user: ProfileUser | null): ProfileConfig => {
  if (!user) return prev;

  const updates: Partial<ProfileConfig> = {};

  if (user.email && !prev.email) {
    updates.email = user.email;
  }

  if (user.username && (!prev.name || prev.name === 'User')) {
    updates.name = user.username;
  }

  if (user.avatarUrl && !prev.avatarUrl) {
    updates.avatarUrl = user.avatarUrl;
  }

  return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
};

export const validatePasswordChange = ({
  currentPassword,
  newPassword,
  confirmNewPassword,
  t
}: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  t: TranslationFunction;
}): string => {
  if (!currentPassword || !newPassword) return t('currentAndNewPasswordRequired');
  if (newPassword.length < 6) return t('passwordMinLength');
  if (newPassword !== confirmNewPassword) return t('passwordsDoNotMatch');
  return '';
};

export const validateDeleteAccount = ({
  deleteConfirmText,
  user,
  deletePassword,
  t
}: {
  deleteConfirmText: string;
  user: ProfileUser | null;
  deletePassword: string;
  t: TranslationFunction;
}): string => {
  if (deleteConfirmText !== 'DELETE') return t('typeDeleteToConfirm');
  if (user?.authProvider === 'local' && !deletePassword) return t('passwordRequired');
  return '';
};

export const isValidImageFile = (file: File | undefined): boolean =>
  Boolean(file?.type?.startsWith('image/') && file?.size <= MAX_AVATAR_SIZE_BYTES);
