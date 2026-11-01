import type { Language } from './translations';

export type PrivacyBlurTranslationKey =
  | 'privacyBlur'
  | 'privacyBlurHint'
  | 'privacyBlurOnAnnouncement'
  | 'privacyBlurOffAnnouncement';

export const privacyBlurTranslations: Record<Language, Record<PrivacyBlurTranslationKey, string>> = {
  en: {
    privacyBlur: 'Blur entry text',
    privacyBlurHint: 'Blur entry text (Ctrl+Shift+E)',
    privacyBlurOnAnnouncement: 'Entry text blurred',
    privacyBlurOffAnnouncement: 'Entry text shown',
  },
  fr: {
    privacyBlur: 'Flouter le texte des entrées',
    privacyBlurHint: 'Flouter le texte des entrées (Ctrl+Maj+E)',
    privacyBlurOnAnnouncement: 'Texte des entrées flouté',
    privacyBlurOffAnnouncement: 'Texte des entrées affiché',
  },
};
