import type { FontFamilyPreference, LetterSpacingPreference, LineSpacingPreference, TranslationFunction } from '../../types';
import type { User } from '../../contexts/authTypes';
import { formatEntryDate } from '../../utils/entryDate';
import { ownEmail } from '../../utils/accountEmail';
import { validateNewPassword } from '../AuthPage/types';

export type { TranslationFunction };

export interface ProfileConfig {
  name?: string;
  bio?: string;
  email?: string;
  birthday?: string;
  gender?: string;
  avatarUrl?: string;
  theme?: 'light' | 'dark';
  fontFamily?: FontFamilyPreference;
  fontSize?: number | string;
  fontColor?: string;
  lineSpacing?: LineSpacingPreference;
  letterSpacing?: LetterSpacingPreference;
  highContrast?: boolean | string;
  ttsVoiceUri?: string;
  language?: string;
  maxPinnedEntries?: number | string;
  defaultVisibility?: 'public' | 'private';
  defaultCommentPolicy?: 'everyone' | 'followers' | 'closed';
  readDates?: boolean;
  streakCard?: boolean;
  quietMode?: boolean;
  comfortReads?: boolean;
  entryLocation?: boolean;
  openRouterModel?: string;
  openRouterTagModel?: string;
  openRouterWritingModel?: string;
  openRouterChatModel?: string;
  openRouterToneModel?: string;
  openRouterSummaryModel?: string;
  openRouterPromptModel?: string;
  openRouterBookModel?: string;
  autoTagMaxTags?: string | number;
  tagMetadata?: string;
  subscriptionPlan?: 'free' | 'plus' | 'pro';
  paymentMethodLabel?: string;
}

/** The signed-in user's fields the profile page reads. */
export type ProfileUser = Partial<Pick<User, 'username' | 'email' | 'emailMissing' | 'avatarUrl' | 'authProvider' | 'emailVerified'>>;

export interface ProfileStats {
  firstEntryYear?: number;
}

export const DEFAULT_BIRTHDAY_YEARS_AGO = 18;
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const getDefaultBirthday = (yearsAgo = DEFAULT_BIRTHDAY_YEARS_AGO): string => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - yearsAgo);
  return formatEntryDate(date);
};

export const mergeUserProfileDefaults = (prev: ProfileConfig, user: ProfileUser | null): ProfileConfig => {
  if (!user) return prev;

  const updates: Partial<ProfileConfig> = {};

  const email = ownEmail(user);
  if (email && !prev.email) {
    updates.email = email;
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
  // The rule and the confirmation, as sign-up, the reset page and the API check a new password
  return validateNewPassword({ password: newPassword, confirmPassword: confirmNewPassword, t });
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
