import type { Language } from './translations';

/** Private share links: the writer's dialog to make, copy and revoke them, and the page the reader opens. */
export type ShareLinksTranslationKey =
  | 'sharePrivately'
  | 'sharePrivatelyTitle'
  | 'shareBookVersionPrivately'
  | 'shareLinkEntryIntro'
  | 'shareLinkBookIntro'
  | 'shareLinkExpiry'
  | 'shareLinkExpiryDay'
  | 'shareLinkExpiryWeek'
  | 'shareLinkExpiryMonth'
  | 'shareLinkExpiryCustom'
  | 'shareLinkExpiryDate'
  | 'shareLinkExpiryDateHint'
  | 'shareLinkMaxViews'
  | 'shareLinkMaxViewsHint'
  | 'shareLinkLabel'
  | 'shareLinkLabelPlaceholder'
  | 'shareLinkShowMood'
  | 'shareLinkShowTags'
  | 'shareLinkCreate'
  | 'shareLinkCreating'
  | 'shareLinkCreated'
  | 'shareLinkUrlLabel'
  | 'shareLinkCopy'
  | 'shareLinkCopied'
  | 'shareLinkCopyFailed'
  | 'shareLinksActive'
  | 'shareLinksNone'
  | 'shareLinksCount'
  | 'shareLinkUntitled'
  | 'shareLinkExpires'
  | 'shareLinkViews_one'
  | 'shareLinkViews_other'
  | 'shareLinkViewsLimited'
  | 'shareLinkUsedUp'
  | 'shareLinkRevoke'
  | 'shareLinkRevokeLabel'
  | 'shareLinkRevoked'
  | 'shareLinksLoadFailed'
  | 'shareLinkCreateFailed'
  | 'shareLinkRevokeFailed'
  | 'sharedPageLabel'
  | 'sharedLoading'
  | 'sharedUnavailableTitle'
  | 'sharedUnavailableText'
  | 'sharedFailedTitle'
  | 'sharedFailedText'
  | 'sharedExpiresOn'
  | 'sharedFiles'
  | 'sharedDownloadFile'
  | 'sharedBookBy'
  | 'sharedBookDownload'
  | 'sharedTags';

export const shareLinksTranslations: Record<Language, Record<ShareLinksTranslationKey, string>> = {
  en: {
    sharePrivately: 'Share privately…',
    sharePrivatelyTitle: 'Share privately',
    shareBookVersionPrivately: 'Share version {version} privately',
    shareLinkEntryIntro:
      'Anyone with the link can read this entry and its files without signing in, until the link expires or you revoke it. It stays out of the public feed.',
    shareLinkBookIntro:
      'Anyone with the link can download this book version without signing in, until the link expires or you revoke it.',
    shareLinkExpiry: 'Link expires',
    shareLinkExpiryDay: 'In 1 day',
    shareLinkExpiryWeek: 'In 7 days',
    shareLinkExpiryMonth: 'In 30 days',
    shareLinkExpiryCustom: 'On a date…',
    shareLinkExpiryDate: 'Last day of the link',
    shareLinkExpiryDateHint: 'The link works until the end of that day, at most a year from today.',
    shareLinkMaxViews: 'View limit (optional)',
    shareLinkMaxViewsHint: 'Each opening of the entry, or download of the book, is a view. Leave empty for no limit.',
    shareLinkLabel: 'Note for yourself (optional)',
    shareLinkLabelPlaceholder: 'For Mum',
    shareLinkShowMood: 'Show the mood',
    shareLinkShowTags: 'Show the tags',
    shareLinkCreate: 'Create link',
    shareLinkCreating: 'Creating…',
    shareLinkCreated: 'Copy the link now: it is shown only this once.',
    shareLinkUrlLabel: 'Private link',
    shareLinkCopy: 'Copy link',
    shareLinkCopied: 'Link copied',
    shareLinkCopyFailed: 'Could not copy. Select the link and copy it yourself.',
    shareLinksActive: 'Active links',
    shareLinksNone: 'No active links.',
    shareLinksCount: 'You have {count} of {limit} active links in all.',
    shareLinkUntitled: 'Link made {date}',
    shareLinkExpires: 'Expires {date}',
    shareLinkViews_one: '{count} view',
    shareLinkViews_other: '{count} views',
    shareLinkViewsLimited: '{views} of {max} views',
    shareLinkUsedUp: 'No views left',
    shareLinkRevoke: 'Revoke',
    shareLinkRevokeLabel: 'Revoke {name}',
    shareLinkRevoked: 'Link revoked. It no longer works.',
    shareLinksLoadFailed: 'Could not load the links.',
    shareLinkCreateFailed: 'Could not create the link.',
    shareLinkRevokeFailed: 'Could not revoke the link.',
    sharedPageLabel: 'Shared privately',
    sharedLoading: 'Opening…',
    sharedUnavailableTitle: 'This link is not available',
    sharedUnavailableText:
      'It may have expired, been revoked or used all its views. Ask the person who shared it for a new link.',
    sharedFailedTitle: 'This page could not be loaded',
    sharedFailedText: 'Check your connection and try again.',
    sharedExpiresOn: 'This link works until {date}.',
    sharedFiles: 'Files',
    sharedDownloadFile: 'Download {name}',
    sharedBookBy: 'By {author}',
    sharedBookDownload: 'Download the book',
    sharedTags: 'Tags',
  },
  fr: {
    sharePrivately: 'Partager en privé…',
    sharePrivatelyTitle: 'Partager en privé',
    shareBookVersionPrivately: 'Partager la version {version} en privé',
    shareLinkEntryIntro:
      'Toute personne qui a le lien peut lire cette entrée et ses fichiers sans se connecter, jusqu’à ce que le lien expire ou que vous le révoquiez. Elle reste hors du fil public.',
    shareLinkBookIntro:
      'Toute personne qui a le lien peut télécharger cette version du livre sans se connecter, jusqu’à ce que le lien expire ou que vous le révoquiez.',
    shareLinkExpiry: 'Le lien expire',
    shareLinkExpiryDay: 'Dans 1 jour',
    shareLinkExpiryWeek: 'Dans 7 jours',
    shareLinkExpiryMonth: 'Dans 30 jours',
    shareLinkExpiryCustom: 'À une date…',
    shareLinkExpiryDate: 'Dernier jour du lien',
    shareLinkExpiryDateHint: 'Le lien fonctionne jusqu’à la fin de ce jour, au plus un an à partir d’aujourd’hui.',
    shareLinkMaxViews: 'Limite de vues (facultatif)',
    shareLinkMaxViewsHint: 'Chaque ouverture de l’entrée, ou téléchargement du livre, compte comme une vue. Laissez vide pour ne pas limiter.',
    shareLinkLabel: 'Note pour vous (facultatif)',
    shareLinkLabelPlaceholder: 'Pour maman',
    shareLinkShowMood: 'Afficher l’humeur',
    shareLinkShowTags: 'Afficher les tags',
    shareLinkCreate: 'Créer le lien',
    shareLinkCreating: 'Création…',
    shareLinkCreated: 'Copiez le lien maintenant : il n’est affiché qu’une seule fois.',
    shareLinkUrlLabel: 'Lien privé',
    shareLinkCopy: 'Copier le lien',
    shareLinkCopied: 'Lien copié',
    shareLinkCopyFailed: 'Copie impossible. Sélectionnez le lien et copiez-le vous-même.',
    shareLinksActive: 'Liens actifs',
    shareLinksNone: 'Aucun lien actif.',
    shareLinksCount: 'Vous avez {count} liens actifs sur {limit} au total.',
    shareLinkUntitled: 'Lien créé le {date}',
    shareLinkExpires: 'Expire le {date}',
    shareLinkViews_one: '{count} vue',
    shareLinkViews_other: '{count} vues',
    shareLinkViewsLimited: '{views} vues sur {max}',
    shareLinkUsedUp: 'Plus aucune vue',
    shareLinkRevoke: 'Révoquer',
    shareLinkRevokeLabel: 'Révoquer {name}',
    shareLinkRevoked: 'Lien révoqué. Il ne fonctionne plus.',
    shareLinksLoadFailed: 'Impossible de charger les liens.',
    shareLinkCreateFailed: 'Impossible de créer le lien.',
    shareLinkRevokeFailed: 'Impossible de révoquer le lien.',
    sharedPageLabel: 'Partagé en privé',
    sharedLoading: 'Ouverture…',
    sharedUnavailableTitle: 'Ce lien n’est pas disponible',
    sharedUnavailableText:
      'Il a peut-être expiré, été révoqué ou utilisé toutes ses vues. Demandez un nouveau lien à la personne qui vous l’a envoyé.',
    sharedFailedTitle: 'Cette page n’a pas pu être chargée',
    sharedFailedText: 'Vérifiez votre connexion et réessayez.',
    sharedExpiresOn: 'Ce lien fonctionne jusqu’au {date}.',
    sharedFiles: 'Fichiers',
    sharedDownloadFile: 'Télécharger {name}',
    sharedBookBy: 'Par {author}',
    sharedBookDownload: 'Télécharger le livre',
    sharedTags: 'Tags',
  },
};
