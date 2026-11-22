import type { Language } from './translations';

/** Notifications: the bell in the navigation, its list, and the one feed entry a notification opens. */
export type NotificationsTranslationKey =
  | 'notifications'
  | 'notificationsNew_one'
  | 'notificationsNew_other'
  | 'notificationsNewQuiet'
  | 'notificationsEmpty'
  | 'notificationsLoadError'
  | 'notificationNew'
  | 'notificationComment'
  | 'notificationEntryLike'
  | 'notificationCommentLike'
  | 'notificationFollow'
  | 'notificationEntryTitle'
  | 'notificationYourEntry'
  | 'notificationTheEntry'
  | 'feedOneEntry'
  | 'feedShowWholeFeed'
  | 'feedEntryGone';

export const notificationsTranslations: Record<Language, Record<NotificationsTranslationKey, string>> = {
  en: {
    notifications: 'Notifications',
    notificationsNew_one: 'Notifications, {count} new',
    notificationsNew_other: 'Notifications, {count} new',
    notificationsNewQuiet: 'Notifications, some new',
    notificationsEmpty: 'Nothing yet. Comments and likes on your public entries, likes on your comments and new followers will show here.',
    notificationsLoadError: 'Your notifications could not be loaded.',
    notificationNew: 'New',
    notificationComment: '{username} commented on {entry}',
    notificationEntryLike: '{username} liked {entry}',
    notificationCommentLike: '{username} liked your comment on {entry}',
    notificationFollow: '{username} started following you',
    notificationEntryTitle: '“{title}”',
    notificationYourEntry: 'your entry of {date}',
    notificationTheEntry: 'the entry of {date}',
    feedOneEntry: 'One entry, from your notifications',
    feedShowWholeFeed: 'Show the whole feed',
    feedEntryGone: 'This entry is no longer in the feed.',
  },
  fr: {
    notifications: 'Notifications',
    notificationsNew_one: 'Notifications, {count} nouvelle',
    notificationsNew_other: 'Notifications, {count} nouvelles',
    notificationsNewQuiet: 'Notifications, du nouveau',
    notificationsEmpty: 'Rien pour l’instant. Les commentaires et les mentions J’aime sur vos entrées publiques, les mentions J’aime sur vos commentaires et vos nouveaux abonnés s’afficheront ici.',
    notificationsLoadError: 'Vos notifications n’ont pas pu être chargées.',
    notificationNew: 'Nouveau',
    notificationComment: '{username} a commenté {entry}',
    notificationEntryLike: '{username} a aimé {entry}',
    notificationCommentLike: '{username} a aimé votre commentaire sur {entry}',
    notificationFollow: '{username} vous suit désormais',
    notificationEntryTitle: '« {title} »',
    notificationYourEntry: 'votre entrée du {date}',
    notificationTheEntry: 'l’entrée du {date}',
    feedOneEntry: 'Une entrée, depuis vos notifications',
    feedShowWholeFeed: 'Afficher tout le fil',
    feedEntryGone: 'Cette entrée n’est plus dans le fil.',
  },
};
