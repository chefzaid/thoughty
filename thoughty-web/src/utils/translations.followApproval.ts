import type { Language } from './translations';

/** Followers by approval: the switch in Profile, follow requests both ways, and the teaser of an entry not yet readable. */
export type FollowApprovalTranslationKey =
  | 'askToFollowAuthor'
  | 'followRequestedAuthor'
  | 'cancelFollowRequest'
  | 'feedTeaserNote'
  | 'feedTeaserRequested'
  | 'followRequestsTitle'
  | 'followRequestsSentTitle'
  | 'followRequestsCount'
  | 'approveFollowRequest'
  | 'declineFollowRequest'
  | 'followRequestApproveError'
  | 'followersByApproval'
  | 'followersByApprovalDescription'
  | 'followApprovalLoadError'
  | 'followApprovalSaveError'
  | 'followApprovalTurnedOn'
  | 'followApprovalTurnedOff'
  | 'followApprovalApproved_one'
  | 'followApprovalApproved_other'
  | 'followApprovalOffTitle'
  | 'followApprovalOffMessage_one'
  | 'followApprovalOffMessage_other'
  | 'followApprovalOffConfirm'
  | 'notificationFollowRequest';

export const followApprovalTranslations: Record<Language, Record<FollowApprovalTranslationKey, string>> = {
  en: {
    askToFollowAuthor: 'Ask to follow',
    followRequestedAuthor: 'Requested',
    cancelFollowRequest: 'Withdraw your request to follow {username}',
    feedTeaserNote: 'Only the followers {username} approves can read this entry. Ask to follow to read it.',
    feedTeaserRequested: 'You asked to follow {username}. This entry opens once they approve.',
    followRequestsTitle: 'Asking to follow you',
    followRequestsSentTitle: 'Waiting for approval',
    followRequestsCount: 'Requests: {count}',
    approveFollowRequest: 'Approve {username}',
    declineFollowRequest: 'Decline {username}',
    followRequestApproveError: 'This request could not be approved. Please try again.',
    followersByApproval: 'Followers by approval',
    followersByApprovalDescription:
      'New followers ask first, and only the followers you approve read your public entries: others see only their day and title. The followers you already have stay. Approve or decline requests in the feed’s Following tab; nobody is told about a decline.',
    followApprovalLoadError: 'Followers by approval could not be loaded.',
    followApprovalSaveError: 'Followers by approval could not be changed. Please try again.',
    followApprovalTurnedOn: 'Followers by approval is on.',
    followApprovalTurnedOff: 'Followers by approval is off.',
    followApprovalApproved_one: 'Followers by approval is off: {count} waiting request was approved.',
    followApprovalApproved_other: 'Followers by approval is off: {count} waiting requests were approved.',
    followApprovalOffTitle: 'Turn off followers by approval?',
    followApprovalOffMessage_one:
      'The {count} request still waiting will be approved, and anyone will be able to follow you and read your public entries.',
    followApprovalOffMessage_other:
      'The {count} requests still waiting will be approved, and anyone will be able to follow you and read your public entries.',
    followApprovalOffConfirm: 'Turn off and approve',
    notificationFollowRequest: '{username} asks to follow you. Approve or decline in the feed’s Following tab',
  },
  fr: {
    askToFollowAuthor: 'Demander à suivre',
    followRequestedAuthor: 'Demande envoyée',
    cancelFollowRequest: 'Retirer votre demande pour suivre {username}',
    feedTeaserNote: 'Seuls les abonnés approuvés par {username} peuvent lire cette entrée. Demandez à suivre pour la lire.',
    feedTeaserRequested: 'Vous avez demandé à suivre {username}. Cette entrée s’ouvrira dès son approbation.',
    followRequestsTitle: 'Demandent à vous suivre',
    followRequestsSentTitle: 'En attente d’approbation',
    followRequestsCount: 'Demandes : {count}',
    approveFollowRequest: 'Approuver {username}',
    declineFollowRequest: 'Refuser {username}',
    followRequestApproveError: 'Cette demande n’a pas pu être approuvée. Veuillez réessayer.',
    followersByApproval: 'Abonnés sur approbation',
    followersByApprovalDescription:
      'Les nouveaux abonnés demandent d’abord, et seuls ceux que vous approuvez lisent vos entrées publiques : les autres n’en voient que le jour et le titre. Vos abonnés actuels restent. Approuvez ou refusez les demandes dans l’onglet Abonnements du fil ; personne n’est averti d’un refus.',
    followApprovalLoadError: 'Les abonnés sur approbation n’ont pas pu être chargés.',
    followApprovalSaveError: 'Les abonnés sur approbation n’ont pas pu être modifiés. Veuillez réessayer.',
    followApprovalTurnedOn: 'Les abonnés sur approbation sont activés.',
    followApprovalTurnedOff: 'Les abonnés sur approbation sont désactivés.',
    followApprovalApproved_one: 'Les abonnés sur approbation sont désactivés : {count} demande en attente a été approuvée.',
    followApprovalApproved_other: 'Les abonnés sur approbation sont désactivés : {count} demandes en attente ont été approuvées.',
    followApprovalOffTitle: 'Désactiver les abonnés sur approbation ?',
    followApprovalOffMessage_one:
      'La {count} demande encore en attente sera approuvée, et tout le monde pourra vous suivre et lire vos entrées publiques.',
    followApprovalOffMessage_other:
      'Les {count} demandes encore en attente seront approuvées, et tout le monde pourra vous suivre et lire vos entrées publiques.',
    followApprovalOffConfirm: 'Désactiver et approuver',
    notificationFollowRequest: '{username} demande à vous suivre. Approuvez ou refusez dans l’onglet Abonnements du fil',
  },
};
