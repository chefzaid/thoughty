import type { Language } from './translations';

/** Who may comment on a public entry, and the comments its writer hides or pins on top. */
export type CommentControlsTranslationKey =
  | 'commentPolicyLabel'
  | 'commentPolicyEveryone'
  | 'commentPolicyFollowers'
  | 'commentPolicyClosed'
  | 'commentPolicyUpdateError'
  | 'commentsClosedNote'
  | 'commentsFollowersOnlyNote'
  | 'commentUpdateError'
  | 'hideComment'
  | 'hideCommentBy'
  | 'showComment'
  | 'showCommentBy'
  | 'pinComment'
  | 'pinCommentBy'
  | 'unpinComment'
  | 'unpinCommentBy'
  | 'commentPinned'
  | 'commentHiddenForAuthor'
  | 'commentHiddenOwn'
  | 'commentHiddenForWriter'
  | 'publicEntriesSettings'
  | 'defaultCommentPolicy'
  | 'defaultCommentPolicyDescription';

export const commentControlsTranslations: Record<Language, Record<CommentControlsTranslationKey, string>> = {
  en: {
    commentPolicyLabel: 'Who can comment',
    commentPolicyEveryone: 'Everyone',
    commentPolicyFollowers: 'Your followers',
    commentPolicyClosed: 'No one (closed)',
    commentPolicyUpdateError: 'Who can comment could not be changed. Please try again.',
    commentsClosedNote: 'Comments are closed. The ones already here stay readable.',
    commentsFollowersOnlyNote: 'Only followers of {username} can comment.',
    commentUpdateError: 'The comment could not be changed. Please try again.',
    hideComment: 'Hide',
    hideCommentBy: 'Hide the comment by {username}',
    showComment: 'Show',
    showCommentBy: 'Show the comment by {username} to everyone again',
    pinComment: 'Pin',
    pinCommentBy: 'Pin the comment by {username} on top',
    unpinComment: 'Unpin',
    unpinCommentBy: 'Unpin the comment by {username}',
    commentPinned: 'Pinned',
    commentHiddenForAuthor: 'Hidden: only you and {username} see it',
    commentHiddenOwn: 'Hidden: only you see it',
    commentHiddenForWriter: "Hidden by the entry's writer: only you and they see it",
    publicEntriesSettings: 'Public entries',
    defaultCommentPolicy: 'Who can comment',
    defaultCommentPolicyDescription:
      'Who may comment on your public entries. Each entry follows this until you choose otherwise under its comments in the feed.',
  },
  fr: {
    commentPolicyLabel: 'Qui peut commenter',
    commentPolicyEveryone: 'Tout le monde',
    commentPolicyFollowers: 'Vos abonnés',
    commentPolicyClosed: 'Personne (fermés)',
    commentPolicyUpdateError: "Le choix de qui peut commenter n'a pas pu être modifié. Veuillez réessayer.",
    commentsClosedNote: 'Les commentaires sont fermés. Ceux déjà publiés restent lisibles.',
    commentsFollowersOnlyNote: 'Seuls les abonnés de {username} peuvent commenter.',
    commentUpdateError: "Le commentaire n'a pas pu être modifié. Veuillez réessayer.",
    hideComment: 'Masquer',
    hideCommentBy: 'Masquer le commentaire de {username}',
    showComment: 'Afficher',
    showCommentBy: 'Afficher de nouveau à tous le commentaire de {username}',
    pinComment: 'Épingler',
    pinCommentBy: 'Épingler en haut le commentaire de {username}',
    unpinComment: 'Désépingler',
    unpinCommentBy: 'Désépingler le commentaire de {username}',
    commentPinned: 'Épinglé',
    commentHiddenForAuthor: 'Masqué : seuls vous et {username} le voyez',
    commentHiddenOwn: 'Masqué : vous seul le voyez',
    commentHiddenForWriter: "Masqué par l'auteur de l'entrée : seuls vous et l'auteur le voyez",
    publicEntriesSettings: 'Entrées publiques',
    defaultCommentPolicy: 'Qui peut commenter',
    defaultCommentPolicyDescription:
      "Qui peut commenter vos entrées publiques. Chaque entrée suit ce choix tant que vous n'en choisissez pas un autre sous ses commentaires dans le fil.",
  },
};
