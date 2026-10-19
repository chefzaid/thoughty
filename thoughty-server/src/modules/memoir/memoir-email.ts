import type { MemoirQuestionEmail } from '@/modules/auth/services/email.service';
import type { MemoirLanguage, MemoirQuestion } from './memoir-questions';

const EMAIL_COPY: Record<MemoirLanguage, Omit<MemoirQuestionEmail, 'question' | 'actionUrl'>> = {
  en: {
    subject: 'Your memoir question for this week',
    heading: 'This week’s question for your memoir',
    actionLabel: 'Write my answer',
    footer:
      'You receive this email because you started the guided memoir in Thoughty. ' +
      'Change the day or stop these emails in the Memoir settings.',
  },
  fr: {
    subject: 'Votre question de la semaine pour vos mémoires',
    heading: 'La question de la semaine pour vos mémoires',
    actionLabel: 'Écrire ma réponse',
    footer:
      'Vous recevez cet e-mail car vous avez commencé les mémoires guidées dans Thoughty. ' +
      'Changez le jour ou arrêtez ces e-mails dans les réglages de Mémoires.',
  },
};

export function buildMemoirQuestionEmail(
  question: MemoirQuestion,
  language: MemoirLanguage,
  frontendUrl: string,
): MemoirQuestionEmail {
  const actionUrl = new URL('/memoir', frontendUrl);
  actionUrl.searchParams.set('question', question.id);

  return {
    ...EMAIL_COPY[language],
    question: question.text[language],
    actionUrl: actionUrl.toString(),
  };
}
