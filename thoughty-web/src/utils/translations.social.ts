import type { Language } from './translations';

/** The public feed, follows, comments, likes, the leaderboard, achievements and badges. */
export type SocialTranslationKey =
  | "feed"
  | "feedScope"
  | "feedCommunity"
  | "feedMine"
  | "feedEmptyCommunity"
  | "feedEmptyMine"
  | "feedLoadError"
  | "feedCount_one"
  | "feedCount_other"
  | "feedEnd"
  | "feedFollowing"
  | "feedEmptyFollowing"
  | "followAuthor"
  | "followingAuthor"
  | "followingListTitle"
  | "followingCount"
  | "followersCount"
  | "followingListEmpty"
  | "followsLoadError"
  | "unfollowAuthor"
  | "followUpdateError"
  | "commentsCount"
  | "commentsEmpty"
  | "commentsLoadError"
  | "writeComment"
  | "postComment"
  | "deleteComment"
  | "deleteCommentBy"
  | "deleteCommentConfirm"
  | "commentPostError"
  | "commentDeleteError"
  | "likes"
  | "likesCount"
  | "likeEntryBy"
  | "likeCommentBy"
  | "likeUpdateError"
  | "leaderboard"
  | "leaderboardPeriod"
  | "leaderboardWeek"
  | "leaderboardMonth"
  | "leaderboardYear"
  | "leaderboardAllTime"
  | "leaderboardNote"
  | "leaderboardLoadError"
  | "leaderboardEmpty"
  | "leaderboardMostActive"
  | "leaderboardMostLiked"
  | "leaderboardMostCommented"
  | "leaderboardPublicEntries"
  | "backToFeed"
  | "achievements"
  | "achievementsLoadError"
  | "karma"
  | "karmaExplanation"
  | "badgeEarned"
  | "badgeProgress"
  | "achievementStatLikesReceived"
  | "achievementStatCommentsReceived"
  | "achievementStatFollowers"
  | "achievementStatPublicEntries"
  | "achievementStatLongestStreak"
  | "badgeFirstPublicEntry"
  | "badgeFirstPublicEntryDescription"
  | "badgeStoryteller"
  | "badgeStorytellerDescription"
  | "badgeHundredEntries"
  | "badgeHundredEntriesDescription"
  | "badgeWeekStreak"
  | "badgeWeekStreakDescription"
  | "badgeMonthStreak"
  | "badgeMonthStreakDescription"
  | "badgeWellLiked"
  | "badgeWellLikedDescription"
  | "badgeBeloved"
  | "badgeBelovedDescription"
  | "badgeConversationStarter"
  | "badgeConversationStarterDescription"
  | "badgeCommunityVoice"
  | "badgeCommunityVoiceDescription"
  | "badgeConnector"
  | "badgeConnectorDescription";

export const socialTranslations: Record<Language, Record<SocialTranslationKey, string>> = {
  en: {
    feed: "Feed",
    feedScope: "Feed view",
    feedCommunity: "Community",
    feedMine: "My public entries",
    feedEmptyCommunity: "No public entries from the community yet.",
    feedEmptyMine: "You do not have any public entries yet.",
    feedLoadError: "The public feed could not be loaded.",
    feedCount_one: "Showing {count} of {total}",
    feedCount_other: "Showing {count} of {total}",
    feedEnd: "You are all caught up.",
    feedFollowing: "Following",
    feedEmptyFollowing: "No public entries from people you follow yet. Follow writers from the Community feed to see them here.",
    followAuthor: "Follow",
    followingAuthor: "Following",
    followingListTitle: "People you follow",
    followingCount: "Following: {count}",
    followersCount: "Followers: {count}",
    followingListEmpty: "You are not following anyone yet.",
    followsLoadError: "The people you follow could not be loaded.",
    unfollowAuthor: "Unfollow {username}",
    followUpdateError: "The follow could not be updated. Please try again.",
    commentsCount: "Comments ({count})",
    commentsEmpty: "No comments yet. Start the conversation.",
    commentsLoadError: "The comments could not be loaded.",
    writeComment: "Write a comment",
    postComment: "Post",
    deleteComment: "Delete comment",
    deleteCommentBy: "Delete the comment by {username}",
    deleteCommentConfirm: "This comment will be removed for everyone. This cannot be undone.",
    commentPostError: "The comment could not be posted. Please try again.",
    commentDeleteError: "The comment could not be deleted. Please try again.",
    likes: "Likes",
    likesCount: "Likes: {count}",
    likeEntryBy: "Like the entry by {username}",
    likeCommentBy: "Like the comment by {username}",
    likeUpdateError: "The like could not be updated.",
    leaderboard: "Leaderboard",
    leaderboardPeriod: "Leaderboard period",
    leaderboardWeek: "This week",
    leaderboardMonth: "This month",
    leaderboardYear: "This year",
    leaderboardAllTime: "All time",
    leaderboardNote: "Only public entries shown in the feed count. Likes and comments from authors on their own entries are not counted.",
    leaderboardLoadError: "The leaderboard could not be loaded.",
    leaderboardEmpty: "Nothing to rank for this period yet.",
    leaderboardMostActive: "Most active writers",
    leaderboardMostLiked: "Most liked entries",
    leaderboardMostCommented: "Most commented entries",
    leaderboardPublicEntries: "Public entries: {count}",
    backToFeed: "Back to the feed",
    achievements: "Achievements",
    achievementsLoadError: "Your achievements could not be loaded.",
    karma: "Karma",
    karmaExplanation: "Karma adds up the likes and comments other people gave your public entries and comments, plus your followers. Journaling badges use your private entries too, and only you can see this section.",
    badgeEarned: "Earned",
    badgeProgress: "Progress: {progress} of {threshold}",
    achievementStatLikesReceived: "Likes received",
    achievementStatCommentsReceived: "Comments received",
    achievementStatFollowers: "Followers",
    achievementStatPublicEntries: "Public entries",
    achievementStatLongestStreak: "Longest streak (days)",
    badgeFirstPublicEntry: "First public thought",
    badgeFirstPublicEntryDescription: "Share an entry in the public feed.",
    badgeStoryteller: "Storyteller",
    badgeStorytellerDescription: "Have {count} entries in the public feed.",
    badgeHundredEntries: "Dedicated journaler",
    badgeHundredEntriesDescription: "Write {count} journal entries.",
    badgeWeekStreak: "Week-long streak",
    badgeWeekStreakDescription: "Write on {count} days in a row.",
    badgeMonthStreak: "Month-long streak",
    badgeMonthStreakDescription: "Write on {count} days in a row.",
    badgeWellLiked: "Well liked",
    badgeWellLikedDescription: "Receive {count} likes.",
    badgeBeloved: "Beloved",
    badgeBelovedDescription: "Receive {count} likes.",
    badgeConversationStarter: "Conversation starter",
    badgeConversationStarterDescription: "Receive {count} comments from others.",
    badgeCommunityVoice: "Community voice",
    badgeCommunityVoiceDescription: "Write {count} comments.",
    badgeConnector: "Connector",
    badgeConnectorDescription: "Be followed by {count} people.",
  },
  fr: {
    feed: "Fil public",
    feedScope: "Vue du fil public",
    feedCommunity: "Communauté",
    feedMine: "Mes entrées publiques",
    feedEmptyCommunity: "Aucune entrée publique de la communauté pour le moment.",
    feedEmptyMine: "Vous n'avez pas encore d'entrée publique.",
    feedLoadError: "Le fil public n'a pas pu être chargé.",
    feedCount_one: "{count} entrée affichée sur {total}",
    feedCount_other: "{count} entrées affichées sur {total}",
    feedEnd: "Vous êtes à jour.",
    feedFollowing: "Abonnements",
    feedEmptyFollowing: "Aucune entrée publique des personnes que vous suivez pour le moment. Suivez des auteurs depuis le fil Communauté pour les voir ici.",
    followAuthor: "Suivre",
    followingAuthor: "Abonné",
    followingListTitle: "Personnes que vous suivez",
    followingCount: "Abonnements : {count}",
    followersCount: "Abonnés : {count}",
    followingListEmpty: "Vous ne suivez personne pour le moment.",
    followsLoadError: "Les personnes que vous suivez n'ont pas pu être chargées.",
    unfollowAuthor: "Ne plus suivre {username}",
    followUpdateError: "L'abonnement n'a pas pu être mis à jour. Veuillez réessayer.",
    commentsCount: "Commentaires ({count})",
    commentsEmpty: "Aucun commentaire pour le moment. Lancez la conversation.",
    commentsLoadError: "Les commentaires n'ont pas pu être chargés.",
    writeComment: "Écrire un commentaire",
    postComment: "Publier",
    deleteComment: "Supprimer le commentaire",
    deleteCommentBy: "Supprimer le commentaire de {username}",
    deleteCommentConfirm: "Ce commentaire sera supprimé pour tout le monde. Cette action est irréversible.",
    commentPostError: "Le commentaire n'a pas pu être publié. Veuillez réessayer.",
    commentDeleteError: "Le commentaire n'a pas pu être supprimé. Veuillez réessayer.",
    likes: "J'aime",
    likesCount: "J'aime : {count}",
    likeEntryBy: "Aimer l'entrée de {username}",
    likeCommentBy: "Aimer le commentaire de {username}",
    likeUpdateError: "Le j'aime n'a pas pu être mis à jour.",
    leaderboard: "Classement",
    leaderboardPeriod: "Période du classement",
    leaderboardWeek: "Cette semaine",
    leaderboardMonth: "Ce mois-ci",
    leaderboardYear: "Cette année",
    leaderboardAllTime: "Depuis toujours",
    leaderboardNote: "Seules les entrées publiques visibles dans le fil comptent. Les j'aime et commentaires des auteurs sur leurs propres entrées ne sont pas comptés.",
    leaderboardLoadError: "Le classement n'a pas pu être chargé.",
    leaderboardEmpty: "Rien à classer pour cette période.",
    leaderboardMostActive: "Auteurs les plus actifs",
    leaderboardMostLiked: "Entrées les plus aimées",
    leaderboardMostCommented: "Entrées les plus commentées",
    leaderboardPublicEntries: "Entrées publiques : {count}",
    backToFeed: "Retour au fil",
    achievements: "Succès",
    achievementsLoadError: "Vos succès n'ont pas pu être chargés.",
    karma: "Karma",
    karmaExplanation: "Le karma additionne les j'aime et commentaires que d'autres personnes ont laissés sur vos entrées et commentaires publics, ainsi que vos abonnés. Les badges d'écriture utilisent aussi vos entrées privées, et cette section n'est visible que par vous.",
    badgeEarned: "Obtenu",
    badgeProgress: "Progression : {progress} sur {threshold}",
    achievementStatLikesReceived: "J'aime reçus",
    achievementStatCommentsReceived: "Commentaires reçus",
    achievementStatFollowers: "Abonnés",
    achievementStatPublicEntries: "Entrées publiques",
    achievementStatLongestStreak: "Plus longue série (jours)",
    badgeFirstPublicEntry: "Première pensée publique",
    badgeFirstPublicEntryDescription: "Partagez une entrée dans le fil public.",
    badgeStoryteller: "Récits partagés",
    badgeStorytellerDescription: "Ayez {count} entrées dans le fil public.",
    badgeHundredEntries: "Plume assidue",
    badgeHundredEntriesDescription: "Écrivez {count} entrées de journal.",
    badgeWeekStreak: "Une semaine d'affilée",
    badgeWeekStreakDescription: "Écrivez {count} jours de suite.",
    badgeMonthStreak: "Un mois d'affilée",
    badgeMonthStreakDescription: "Écrivez {count} jours de suite.",
    badgeWellLiked: "Pensées appréciées",
    badgeWellLikedDescription: "Recevez {count} j'aime.",
    badgeBeloved: "Pensées adorées",
    badgeBelovedDescription: "Recevez {count} j'aime.",
    badgeConversationStarter: "Source de conversations",
    badgeConversationStarterDescription: "Recevez {count} commentaires d'autres personnes.",
    badgeCommunityVoice: "Voix de la communauté",
    badgeCommunityVoiceDescription: "Écrivez {count} commentaires.",
    badgeConnector: "Esprit fédérateur",
    badgeConnectorDescription: "Ayez {count} abonnés.",
  },
};
