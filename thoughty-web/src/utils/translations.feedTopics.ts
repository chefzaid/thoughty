import type { Language } from './translations';

/** Topics in the feed: a tag's public entries, following the topic, and the feed's word search. */
export type FeedTopicsTranslationKey =
  | 'feedSearchLabel'
  | 'feedSearchPlaceholder'
  | 'feedSearchSubmit'
  | 'feedSearchClear'
  | 'feedOpenTopic'
  | 'feedTopicHeading'
  | 'feedCloseTopic'
  | 'feedEmptyFiltered'
  | 'followTopic'
  | 'followingTopic'
  | 'unfollowTopic'
  | 'followedTopicsTitle';

export const feedTopicsTranslations: Record<Language, Record<FeedTopicsTranslationKey, string>> = {
  en: {
    feedSearchLabel: 'Search public entries',
    feedSearchPlaceholder: 'Search the feed...',
    feedSearchSubmit: 'Search',
    feedSearchClear: 'Clear the search',
    feedOpenTopic: 'Show the public entries tagged {tag}',
    feedTopicHeading: 'Topic',
    feedCloseTopic: 'Show every topic',
    feedEmptyFiltered: 'No public entries in this view match this topic or search.',
    followTopic: 'Follow the topic',
    followingTopic: 'Following the topic',
    unfollowTopic: 'Unfollow the topic {tag}',
    followedTopicsTitle: 'Topics you follow',
  },
  fr: {
    feedSearchLabel: 'Rechercher dans les entrées publiques',
    feedSearchPlaceholder: 'Rechercher dans le fil...',
    feedSearchSubmit: 'Rechercher',
    feedSearchClear: 'Effacer la recherche',
    feedOpenTopic: 'Afficher les entrées publiques avec le tag {tag}',
    feedTopicHeading: 'Sujet',
    feedCloseTopic: 'Afficher tous les sujets',
    feedEmptyFiltered: 'Aucune entrée publique de cette vue ne correspond à ce sujet ou à cette recherche.',
    followTopic: 'Suivre le sujet',
    followingTopic: 'Sujet suivi',
    unfollowTopic: 'Ne plus suivre le sujet {tag}',
    followedTopicsTitle: 'Sujets que vous suivez',
  },
};
