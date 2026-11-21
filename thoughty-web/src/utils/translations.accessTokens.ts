import type { Language } from './translations';

/** Personal access tokens for the public API, in Profile › Access tokens. */
export type AccessTokensTranslationKey =
  | 'accessTokens'
  | 'accessTokensIntro'
  | 'accessTokensUsage'
  | 'accessTokensCount'
  | 'accessTokensLoading'
  | 'accessTokensLoadFailed'
  | 'accessTokensEmpty'
  | 'accessTokensLimitReached'
  | 'accessTokenNewTitle'
  | 'accessTokenName'
  | 'accessTokenNamePlaceholder'
  | 'accessTokenNameRequired'
  | 'accessTokenScopes'
  | 'accessTokenScopeWrite'
  | 'accessTokenScopeRead'
  | 'accessTokenNeedsScope'
  | 'accessTokenLifetime'
  | 'accessTokenLifetime30'
  | 'accessTokenLifetime90'
  | 'accessTokenLifetime365'
  | 'accessTokenLifetimeNever'
  | 'accessTokenCreate'
  | 'accessTokenCreating'
  | 'accessTokenCreateFailed'
  | 'accessTokenCreatedTitle'
  | 'accessTokenCreatedNote'
  | 'accessTokenValue'
  | 'accessTokenCopy'
  | 'accessTokenCopied'
  | 'accessTokenCopyFailed'
  | 'accessTokenDone'
  | 'accessTokenCreatedOn'
  | 'accessTokenLastUsed'
  | 'accessTokenNeverUsed'
  | 'accessTokenExpiresOn'
  | 'accessTokenNoExpiry'
  | 'accessTokenRevoke'
  | 'accessTokenRevokeLabel'
  | 'accessTokenRevokeTitle'
  | 'accessTokenRevokeMessage'
  | 'accessTokenRevokeFailed'
  | 'accessTokenRevoked';

export const accessTokensTranslations: Record<Language, Record<AccessTokensTranslationKey, string>> = {
  en: {
    accessTokens: 'Access tokens',
    accessTokensIntro:
      'A personal access token lets your own scripts, iOS Shortcuts or Zapier write entries in your journal, or read it, without your password. Each token can only do what you allow, and you can revoke it at any time.',
    accessTokensUsage:
      'Send the token as “Authorization: Bearer <token>” to {url}: POST /entries writes a private entry (for today in this browser’s time zone unless you send a date), GET /entries lists your entries and GET /diaries lists your diaries.',
    accessTokensCount: '{count} of {limit}',
    accessTokensLoading: 'Loading your access tokens...',
    accessTokensLoadFailed: 'Your access tokens could not be loaded.',
    accessTokensEmpty: 'You have no access tokens.',
    accessTokensLimitReached: 'You hold {limit} tokens, the most you can. Revoke one to create another.',
    accessTokenNewTitle: 'New access token',
    accessTokenName: 'Name',
    accessTokenNamePlaceholder: 'iPhone Shortcut',
    accessTokenNameRequired: 'Give the token a name.',
    accessTokenScopes: 'What it may do',
    accessTokenScopeWrite: 'Write new entries',
    accessTokenScopeRead: 'Read entries',
    accessTokenNeedsScope: 'Choose at least one thing the token may do.',
    accessTokenLifetime: 'Expires',
    accessTokenLifetime30: 'In 30 days',
    accessTokenLifetime90: 'In 90 days',
    accessTokenLifetime365: 'In a year',
    accessTokenLifetimeNever: 'Never',
    accessTokenCreate: 'Create token',
    accessTokenCreating: 'Creating...',
    accessTokenCreateFailed: 'The token could not be created. Please try again.',
    accessTokenCreatedTitle: 'Copy your new token now',
    accessTokenCreatedNote:
      'This is the only time it is shown. Keep it somewhere safe, such as your password manager: anyone who holds it can do what it allows.',
    accessTokenValue: 'Your new access token',
    accessTokenCopy: 'Copy',
    accessTokenCopied: 'Copied',
    accessTokenCopyFailed: 'The token could not be copied. Select it and copy it by hand.',
    accessTokenDone: 'Done',
    accessTokenCreatedOn: 'Created {date}',
    accessTokenLastUsed: 'Last used {date}',
    accessTokenNeverUsed: 'Never used',
    accessTokenExpiresOn: 'Expires {date}',
    accessTokenNoExpiry: 'Never expires',
    accessTokenRevoke: 'Revoke',
    accessTokenRevokeLabel: 'Revoke {name}',
    accessTokenRevokeTitle: 'Revoke this token?',
    accessTokenRevokeMessage: '“{name}” stops working at once. Anything that uses it will need a new token.',
    accessTokenRevokeFailed: 'The token could not be revoked. Please try again.',
    accessTokenRevoked: '“{name}” was revoked.',
  },
  fr: {
    accessTokens: 'Jetons d’accès',
    accessTokensIntro:
      'Un jeton d’accès personnel permet à vos propres scripts, Raccourcis iOS ou Zapier d’écrire des entrées dans votre journal, ou de le lire, sans votre mot de passe. Chaque jeton ne peut faire que ce que vous autorisez, et vous pouvez le révoquer à tout moment.',
    accessTokensUsage:
      'Envoyez le jeton sous la forme « Authorization: Bearer <jeton> » à {url} : POST /entries écrit une entrée privée (pour aujourd’hui dans le fuseau horaire de ce navigateur, sauf si vous envoyez une date), GET /entries liste vos entrées et GET /diaries liste vos journaux.',
    accessTokensCount: '{count} sur {limit}',
    accessTokensLoading: 'Chargement de vos jetons d’accès...',
    accessTokensLoadFailed: 'Vos jetons d’accès n’ont pas pu être chargés.',
    accessTokensEmpty: 'Vous n’avez aucun jeton d’accès.',
    accessTokensLimitReached: 'Vous détenez {limit} jetons, le maximum. Révoquez-en un pour en créer un autre.',
    accessTokenNewTitle: 'Nouveau jeton d’accès',
    accessTokenName: 'Nom',
    accessTokenNamePlaceholder: 'Raccourci iPhone',
    accessTokenNameRequired: 'Donnez un nom au jeton.',
    accessTokenScopes: 'Ce qu’il peut faire',
    accessTokenScopeWrite: 'Écrire de nouvelles entrées',
    accessTokenScopeRead: 'Lire les entrées',
    accessTokenNeedsScope: 'Choisissez au moins une chose que le jeton peut faire.',
    accessTokenLifetime: 'Expire',
    accessTokenLifetime30: 'Dans 30 jours',
    accessTokenLifetime90: 'Dans 90 jours',
    accessTokenLifetime365: 'Dans un an',
    accessTokenLifetimeNever: 'Jamais',
    accessTokenCreate: 'Créer le jeton',
    accessTokenCreating: 'Création...',
    accessTokenCreateFailed: 'Le jeton n’a pas pu être créé. Veuillez réessayer.',
    accessTokenCreatedTitle: 'Copiez votre nouveau jeton maintenant',
    accessTokenCreatedNote:
      'C’est la seule fois où il s’affiche. Gardez-le en lieu sûr, par exemple dans votre gestionnaire de mots de passe : quiconque le détient peut faire ce qu’il autorise.',
    accessTokenValue: 'Votre nouveau jeton d’accès',
    accessTokenCopy: 'Copier',
    accessTokenCopied: 'Copié',
    accessTokenCopyFailed: 'Le jeton n’a pas pu être copié. Sélectionnez-le et copiez-le à la main.',
    accessTokenDone: 'Terminé',
    accessTokenCreatedOn: 'Créé le {date}',
    accessTokenLastUsed: 'Dernière utilisation le {date}',
    accessTokenNeverUsed: 'Jamais utilisé',
    accessTokenExpiresOn: 'Expire le {date}',
    accessTokenNoExpiry: 'N’expire jamais',
    accessTokenRevoke: 'Révoquer',
    accessTokenRevokeLabel: 'Révoquer {name}',
    accessTokenRevokeTitle: 'Révoquer ce jeton ?',
    accessTokenRevokeMessage: '« {name} » cesse de fonctionner immédiatement. Tout ce qui l’utilise aura besoin d’un nouveau jeton.',
    accessTokenRevokeFailed: 'Le jeton n’a pas pu être révoqué. Veuillez réessayer.',
    accessTokenRevoked: '« {name} » a été révoqué.',
  },
};
