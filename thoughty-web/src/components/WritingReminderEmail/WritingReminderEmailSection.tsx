import type { Diary, TranslationFunction } from '../../types';
import { createWritingReminderEmailService } from '../../services/api';
import type { Language } from '../../utils/translations';
import OptInEmailSection, { type OptInEmailCopyKeys } from '../OptInEmail/OptInEmailSection';

const WRITING_REMINDER_EMAIL_QUERY_KEY = ['writingReminderEmail'] as const;

const COPY: OptInEmailCopyKeys = {
  title: 'writingReminderEmailTitle',
  intro: 'writingReminderEmailIntro',
  enable: 'writingReminderEmailEnable',
  enableDescription: 'writingReminderEmailEnableDescription',
  next: 'writingReminderEmailNext',
  privacy: 'writingReminderEmailPrivacy',
  turnedOn: 'writingReminderEmailTurnedOn',
  turnedOff: 'writingReminderEmailTurnedOff',
  saved: 'writingReminderEmailSaved',
  loadFailed: 'writingReminderEmailLoadFailed',
  saveFailed: 'writingReminderEmailSaveFailed',
};

interface WritingReminderEmailSectionProps {
  readonly diaries: readonly Diary[];
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/** The profile's opt-in writing reminder: each day not yet written, at the chosen local hour, opening the composer on the chosen diary. */
function WritingReminderEmailSection(props: WritingReminderEmailSectionProps) {
  return (
    <OptInEmailSection
      {...props}
      sectionId="writing-reminder-email"
      switchName="writingReminderEmail"
      queryKey={WRITING_REMINDER_EMAIL_QUERY_KEY}
      createService={createWritingReminderEmailService}
      copy={COPY}
    />
  );
}

export default WritingReminderEmailSection;
