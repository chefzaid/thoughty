import type { Language } from './translations';

/** Muting and blocking other writers, removing a follower, and their list in Profile › Privacy. */
export type WriterControlsTranslationKey =
  | 'writerMenu'
  | 'muteWriter'
  | 'blockWriter'
  | 'blockWriterTitle'
  | 'blockWriterMessage'
  | 'blockWriterConfirm'
  | 'writerMuted'
  | 'writerBlocked'
  | 'writerMuteError'
  | 'writerBlockError'
  | 'followersListTitle'
  | 'followersListEmpty'
  | 'removeFollower'
  | 'followerRemoveError'
  | 'hiddenWriters'
  | 'hiddenWritersDescription'
  | 'mutedWritersTitle'
  | 'blockedWritersTitle'
  | 'hiddenWritersEmpty'
  | 'hiddenWritersLoadError'
  | 'hiddenWriterUpdateError'
  | 'unmuteWriter'
  | 'unmuteWriterLabel'
  | 'unblockWriter'
  | 'unblockWriterLabel';

export const writerControlsTranslations: Record<Language, Record<WriterControlsTranslationKey, string>> = {
  en: {
    writerMenu: 'More for {username}',
    muteWriter: 'Mute {username}',
    blockWriter: 'Block {username}',
    blockWriterTitle: 'Block {username}?',
    blockWriterMessage:
      "You will stop following each other, and neither of you will see the other's entries, comments or place in the leaderboard, or be able to follow, comment on, like or save the other's entries. Their entries leave your Saved list, and yours leave theirs. {username} is not told.",
    blockWriterConfirm: 'Block',
    writerMuted: 'You muted {username}: their entries and comments stay out of your feed. Undo it in Profile › Privacy.',
    writerBlocked: 'You blocked {username}. Undo it in Profile › Privacy.',
    writerMuteError: 'This writer could not be muted. Please try again.',
    writerBlockError: 'This writer could not be blocked. Please try again.',
    followersListTitle: 'Your followers',
    followersListEmpty: 'Nobody follows you yet.',
    removeFollower: 'Remove {username} from your followers',
    followerRemoveError: 'This follower could not be removed. Please try again.',
    hiddenWriters: 'Muted and blocked writers',
    hiddenWritersDescription:
      'A muted writer stays out of your feed and comments, and any follow stays. A blocked writer and you no longer see or reach each other. Neither is told.',
    mutedWritersTitle: 'Muted',
    blockedWritersTitle: 'Blocked',
    hiddenWritersEmpty: 'You have not muted or blocked anyone.',
    hiddenWritersLoadError: 'The muted and blocked writers could not be loaded.',
    hiddenWriterUpdateError: 'This change could not be saved. Please try again.',
    unmuteWriter: 'Unmute',
    unmuteWriterLabel: 'Unmute {username}',
    unblockWriter: 'Unblock',
    unblockWriterLabel: 'Unblock {username}',
  },
  fr: {
    writerMenu: 'Plus pour {username}',
    muteWriter: 'Masquer {username}',
    blockWriter: 'Bloquer {username}',
    blockWriterTitle: 'Bloquer {username} ?',
    blockWriterMessage:
      "Vous cesserez de vous suivre l'un l'autre, et aucun de vous deux ne verra plus les entrées, les commentaires ou la place au classement de l'autre, ni ne pourra suivre l'autre, commenter, aimer ou enregistrer ses entrées. Ses entrées quittent votre liste d'entrées enregistrées, et les vôtres la sienne. {username} n'en est pas averti.",
    blockWriterConfirm: 'Bloquer',
    writerMuted: 'Vous avez masqué {username} : ses entrées et ses commentaires restent hors de votre fil. Annulez-le dans Profil › Confidentialité.',
    writerBlocked: 'Vous avez bloqué {username}. Annulez-le dans Profil › Confidentialité.',
    writerMuteError: "Cet auteur n'a pas pu être masqué. Veuillez réessayer.",
    writerBlockError: "Cet auteur n'a pas pu être bloqué. Veuillez réessayer.",
    followersListTitle: 'Vos abonnés',
    followersListEmpty: "Personne ne vous suit pour l'instant.",
    removeFollower: 'Retirer {username} de vos abonnés',
    followerRemoveError: "Cet abonné n'a pas pu être retiré. Veuillez réessayer.",
    hiddenWriters: 'Auteurs masqués et bloqués',
    hiddenWritersDescription:
      "Un auteur masqué reste hors de votre fil et de vos commentaires, et un abonnement est conservé. Un auteur bloqué et vous ne vous voyez plus et ne pouvez plus vous joindre. Aucun n'en est averti.",
    mutedWritersTitle: 'Masqués',
    blockedWritersTitle: 'Bloqués',
    hiddenWritersEmpty: "Vous n'avez masqué ni bloqué personne.",
    hiddenWritersLoadError: "Les auteurs masqués et bloqués n'ont pas pu être chargés.",
    hiddenWriterUpdateError: "Cette modification n'a pas pu être enregistrée. Veuillez réessayer.",
    unmuteWriter: 'Ne plus masquer',
    unmuteWriterLabel: 'Ne plus masquer {username}',
    unblockWriter: 'Débloquer',
    unblockWriterLabel: 'Débloquer {username}',
  },
};
