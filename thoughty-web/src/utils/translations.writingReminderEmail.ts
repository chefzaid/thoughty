import type { Language } from './translations';

/** The opt-in writing reminder email: its Profile section and what the unsubscribe page says once it is off. */
export type WritingReminderEmailTranslationKey =
  | 'writingReminderEmailTitle'
  | 'writingReminderEmailIntro'
  | 'writingReminderEmailEnable'
  | 'writingReminderEmailEnableDescription'
  | 'writingReminderEmailPrivacy'
  | 'writingReminderEmailNext'
  | 'writingReminderEmailTurnedOn'
  | 'writingReminderEmailTurnedOff'
  | 'writingReminderEmailSaved'
  | 'writingReminderEmailLoadFailed'
  | 'writingReminderEmailSaveFailed'
  | 'writingReminderUnsubscribed';

export const writingReminderEmailTranslations: Record<Language, Record<WritingReminderEmailTranslationKey, string>> = {
  en: {
    writingReminderEmailTitle: 'Writing reminder by email',
    writingReminderEmailIntro:
      'Get a short email at the hour you choose on each day you haven’t written yet, with the streak an entry would keep going and a link that opens the composer on the diary you pick.',
    writingReminderEmailEnable: 'Remind me to write by email',
    writingReminderEmailEnableDescription:
      'Off unless you turn it on. A day that already has an entry (in the diary you pick, or in any diary) sends nothing.',
    writingReminderEmailPrivacy:
      'The email goes only to your verified address and holds nothing from your journal: no titles, no text. Quiet mode leaves the streak count out. Entries in the recycle bin don’t count as writing.',
    writingReminderEmailNext: 'Next possible reminder: {date}.',
    writingReminderEmailTurnedOn: 'Writing reminder emails are on.',
    writingReminderEmailTurnedOff: 'Writing reminder emails are off.',
    writingReminderEmailSaved: 'Writing reminder settings saved.',
    writingReminderEmailLoadFailed: 'The writing reminder setting could not be loaded.',
    writingReminderEmailSaveFailed: 'The writing reminder setting could not be saved.',
    writingReminderUnsubscribed:
      'You won’t receive writing reminder emails anymore. You can turn them back on in your profile at any time.',
  },
  fr: {
    writingReminderEmailTitle: 'Rappel d’écriture par e-mail',
    writingReminderEmailIntro:
      'Recevez un court e-mail à l’heure choisie chaque jour où vous n’avez pas encore écrit, avec la série qu’une entrée prolongerait et un lien qui ouvre l’éditeur sur le journal choisi.',
    writingReminderEmailEnable: 'Me rappeler d’écrire par e-mail',
    writingReminderEmailEnableDescription:
      'Désactivé tant que vous ne l’activez pas. Un jour qui a déjà une entrée (dans le journal choisi, ou dans n’importe quel journal) n’envoie rien.',
    writingReminderEmailPrivacy:
      'L’e-mail est envoyé uniquement à votre adresse vérifiée et ne contient rien de votre journal : ni titre, ni texte. Le mode calme retire le nombre de jours de la série. Les entrées de la corbeille ne comptent pas comme écrites.',
    writingReminderEmailNext: 'Prochain rappel possible : {date}.',
    writingReminderEmailTurnedOn: 'Les e-mails de rappel d’écriture sont activés.',
    writingReminderEmailTurnedOff: 'Les e-mails de rappel d’écriture sont désactivés.',
    writingReminderEmailSaved: 'Réglages du rappel d’écriture enregistrés.',
    writingReminderEmailLoadFailed: 'Le réglage du rappel d’écriture n’a pas pu être chargé.',
    writingReminderEmailSaveFailed: 'Le réglage du rappel d’écriture n’a pas pu être enregistré.',
    writingReminderUnsubscribed:
      'Vous ne recevrez plus les e-mails de rappel d’écriture. Vous pouvez les réactiver à tout moment dans votre profil.',
  },
};
