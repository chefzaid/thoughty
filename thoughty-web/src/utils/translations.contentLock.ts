import type { Language } from './translations';

export type ContentLockTranslationKey =
  | 'pinLock'
  | 'pinLockDescription'
  | 'pinLockNotEncryption'
  | 'pinLockNoPin'
  | 'pinLockPinSet'
  | 'pinNew'
  | 'pinConfirm'
  | 'pinCurrent'
  | 'pinMismatch'
  | 'pinFormatHint'
  | 'pinSet'
  | 'pinChange'
  | 'pinRemove'
  | 'pinRemoveHint'
  | 'pinForgot'
  | 'pinUseCurrent'
  | 'pinPassword'
  | 'pinEmailCode'
  | 'pinEmailCodeSent'
  | 'pinSaved'
  | 'pinRemoved'
  | 'pinSave'
  | 'pinLockLoadFailed'
  | 'pinSaveFailed'
  | 'pinUnlockFailed'
  | 'pinLockFailed'
  | 'pinLockChangeFailed'
  | 'pinDialogTitle'
  | 'pinDialogDescription'
  | 'pinDialogField'
  | 'pinUnblur'
  | 'pinWrong'
  | 'pinBlocked'
  | 'pinForgotHint'
  | 'pinSetDialogTitle'
  | 'pinSetDialogDescription'
  | 'lockedEntryLabel'
  | 'lockedEntryHint'
  | 'lockedEntryUnblur'
  | 'lockedEntryPlaceholder'
  | 'entryLockAction'
  | 'entryUnlockAction'
  | 'entryLockedWithDiary'
  | 'entryLockTitle'
  | 'entryLockMessage'
  | 'entryLockConfirm'
  | 'diaryLock'
  | 'diaryLockHint'
  | 'diaryLockTitle'
  | 'diaryLockMessage'
  | 'diaryLockOnAnnouncement'
  | 'diaryLockOffAnnouncement'
  | 'contentLockedAgain'
  | 'contentUnlockedAnnouncement';

export const contentLockTranslations: Record<Language, Record<ContentLockTranslationKey, string>> = {
  en: {
    pinLock: 'PIN lock',
    pinLockDescription: 'Lock diaries or single entries behind a 4-digit PIN. Locked entries stay blurred until you type the PIN, and the unlock ends after 15 minutes without activity, when you blur again, close the tab or sign out.',
    pinLockNotEncryption: 'Hides these entries behind your PIN on this account. It is not encryption.',
    pinLockNoPin: 'No PIN set',
    pinLockPinSet: 'PIN set',
    pinNew: 'New PIN',
    pinConfirm: 'Type the PIN again',
    pinCurrent: 'Current PIN',
    pinMismatch: 'The two PINs are not the same.',
    pinFormatHint: 'Exactly 4 digits.',
    pinSet: 'Set a PIN',
    pinChange: 'Change PIN',
    pinRemove: 'Remove PIN',
    pinRemoveHint: 'Removing the PIN removes every lock with it.',
    pinForgot: 'Forgot your PIN?',
    pinUseCurrent: 'Use my current PIN',
    pinPassword: 'Account password',
    pinEmailCode: 'Code from the email',
    pinEmailCodeSent: 'We emailed you a code. Type it to confirm.',
    pinSaved: 'PIN saved.',
    pinRemoved: 'PIN removed. Nothing is locked any more.',
    pinSave: 'Save PIN',
    pinLockLoadFailed: 'The PIN lock could not be loaded.',
    pinSaveFailed: 'The PIN could not be saved.',
    pinUnlockFailed: 'Could not unlock. Try again.',
    pinLockFailed: 'Could not lock again.',
    pinLockChangeFailed: 'The lock could not be changed.',
    pinDialogTitle: 'Unblur locked entries',
    pinDialogDescription: 'Type your 4-digit PIN to show your locked diaries and entries.',
    pinDialogField: 'PIN',
    pinUnblur: 'Unblur',
    pinWrong: 'Wrong PIN. {count} more before a pause.',
    pinBlocked: 'Too many wrong PINs. Try again after {time}.',
    pinForgotHint: 'Forgot it? Reset it with your account password in your profile.',
    pinSetDialogTitle: 'Set a PIN first',
    pinSetDialogDescription: 'Choose the 4-digit PIN that unblurs what you lock.',
    lockedEntryLabel: 'Locked entry',
    lockedEntryHint: 'Locked with your PIN',
    lockedEntryUnblur: 'Unblur with PIN',
    lockedEntryPlaceholder: 'Locked text',
    entryLockAction: 'Lock with PIN',
    entryUnlockAction: 'Remove PIN lock',
    entryLockedWithDiary: 'Locked with its diary',
    entryLockTitle: 'Lock this entry?',
    entryLockMessage: 'Hides this entry behind your PIN on this account. It is not encryption. A public entry becomes private, and its share links stop opening while it is locked.',
    entryLockConfirm: 'Lock',
    diaryLock: 'Lock with PIN',
    diaryLockHint: 'Hides this diary’s entries behind your PIN on this account. It is not encryption.',
    diaryLockTitle: 'Lock this diary?',
    diaryLockMessage: 'Hides every entry of “{name}” behind your PIN on this account. It is not encryption. Its public entries become private, and their share links stop opening while it is locked.',
    diaryLockOnAnnouncement: 'Diary locked',
    diaryLockOffAnnouncement: 'Diary lock removed',
    contentLockedAgain: 'Locked entries are locked again',
    contentUnlockedAnnouncement: 'Locked entries unblurred',
  },
  fr: {
    pinLock: 'Verrou par code',
    pinLockDescription: 'Verrouillez des journaux ou des entrées avec un code à 4 chiffres. Les entrées verrouillées restent floutées jusqu’à ce que vous tapiez le code, et le déverrouillage prend fin après 15 minutes sans activité, quand vous floutez à nouveau, fermez l’onglet ou vous déconnectez.',
    pinLockNotEncryption: 'Masque ces entrées derrière votre code sur ce compte. Ce n’est pas un chiffrement.',
    pinLockNoPin: 'Aucun code',
    pinLockPinSet: 'Code défini',
    pinNew: 'Nouveau code',
    pinConfirm: 'Retapez le code',
    pinCurrent: 'Code actuel',
    pinMismatch: 'Les deux codes ne sont pas identiques.',
    pinFormatHint: 'Exactement 4 chiffres.',
    pinSet: 'Choisir un code',
    pinChange: 'Changer le code',
    pinRemove: 'Supprimer le code',
    pinRemoveHint: 'Supprimer le code retire aussi tous les verrous.',
    pinForgot: 'Code oublié ?',
    pinUseCurrent: 'Utiliser mon code actuel',
    pinPassword: 'Mot de passe du compte',
    pinEmailCode: 'Code reçu par e-mail',
    pinEmailCodeSent: 'Nous vous avons envoyé un code par e-mail. Tapez-le pour confirmer.',
    pinSaved: 'Code enregistré.',
    pinRemoved: 'Code supprimé. Plus rien n’est verrouillé.',
    pinSave: 'Enregistrer le code',
    pinLockLoadFailed: 'Le verrou par code n’a pas pu être chargé.',
    pinSaveFailed: 'Le code n’a pas pu être enregistré.',
    pinUnlockFailed: 'Déverrouillage impossible. Réessayez.',
    pinLockFailed: 'Le reverrouillage a échoué.',
    pinLockChangeFailed: 'Le verrou n’a pas pu être modifié.',
    pinDialogTitle: 'Déflouter les entrées verrouillées',
    pinDialogDescription: 'Tapez votre code à 4 chiffres pour afficher vos journaux et entrées verrouillés.',
    pinDialogField: 'Code',
    pinUnblur: 'Déflouter',
    pinWrong: 'Code incorrect. Encore {count} avant une pause.',
    pinBlocked: 'Trop de codes incorrects. Réessayez après {time}.',
    pinForgotHint: 'Code oublié ? Réinitialisez-le avec le mot de passe de votre compte dans votre profil.',
    pinSetDialogTitle: 'Choisissez d’abord un code',
    pinSetDialogDescription: 'Choisissez le code à 4 chiffres qui défloute ce que vous verrouillez.',
    lockedEntryLabel: 'Entrée verrouillée',
    lockedEntryHint: 'Verrouillée par votre code',
    lockedEntryUnblur: 'Déflouter avec le code',
    lockedEntryPlaceholder: 'Texte verrouillé',
    entryLockAction: 'Verrouiller par code',
    entryUnlockAction: 'Retirer le verrou',
    entryLockedWithDiary: 'Verrouillée avec son journal',
    entryLockTitle: 'Verrouiller cette entrée ?',
    entryLockMessage: 'Masque cette entrée derrière votre code sur ce compte. Ce n’est pas un chiffrement. Une entrée publique devient privée, et ses liens de partage ne s’ouvrent plus tant qu’elle est verrouillée.',
    entryLockConfirm: 'Verrouiller',
    diaryLock: 'Verrouiller par code',
    diaryLockHint: 'Masque les entrées de ce journal derrière votre code sur ce compte. Ce n’est pas un chiffrement.',
    diaryLockTitle: 'Verrouiller ce journal ?',
    diaryLockMessage: 'Masque toutes les entrées de « {name} » derrière votre code sur ce compte. Ce n’est pas un chiffrement. Ses entrées publiques deviennent privées, et leurs liens de partage ne s’ouvrent plus tant qu’il est verrouillé.',
    diaryLockOnAnnouncement: 'Journal verrouillé',
    diaryLockOffAnnouncement: 'Verrou du journal retiré',
    contentLockedAgain: 'Les entrées verrouillées sont de nouveau verrouillées',
    contentUnlockedAnnouncement: 'Entrées verrouillées défloutées',
  },
};
