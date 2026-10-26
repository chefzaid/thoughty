import type { Language } from './translations';

/** The public About, Privacy, Terms, Contact, Feedback and Blog pages. */
export type PublicPagesTranslationKey =
  | "aboutEyebrow"
  | "aboutTitle"
  | "aboutSubtitle"
  | "aboutNoteLabel"
  | "aboutNoteDate"
  | "aboutNoteTitle"
  | "aboutNoteBody"
  | "aboutStoryKicker"
  | "aboutStoryTitle"
  | "aboutStoryBody"
  | "aboutMissionKicker"
  | "aboutMissionTitle"
  | "aboutValuePrivacyTitle"
  | "aboutValuePrivacyBody"
  | "aboutValueOwnershipTitle"
  | "aboutValueOwnershipBody"
  | "aboutValueCalmTitle"
  | "aboutValueCalmBody"
  | "aboutTeamKicker"
  | "aboutTeamTitle"
  | "aboutTeamBody"
  | "legalUpdatedLabel"
  | "privacyTitle"
  | "privacySubtitle"
  | "privacyIntroTitle"
  | "privacyIntroBody"
  | "privacyDataTitle"
  | "privacyDataBody"
  | "privacyControlTitle"
  | "privacyControlBody"
  | "privacySecurityTitle"
  | "privacySecurityBody"
  | "termsTitle"
  | "termsSubtitle"
  | "termsUseTitle"
  | "termsUseBody"
  | "termsAccountTitle"
  | "termsAccountBody"
  | "termsContentTitle"
  | "termsContentBody"
  | "termsLimitsTitle"
  | "termsLimitsBody"
  | "contactEyebrow"
  | "contactTitle"
  | "contactSubtitle"
  | "contactFormTitle"
  | "contactNameLabel"
  | "contactEmailLabel"
  | "contactTopicLabel"
  | "contactTopicSupport"
  | "contactTopicAccount"
  | "contactTopicBilling"
  | "contactTopicPrivacy"
  | "contactTopicFeedback"
  | "contactMessageLabel"
  | "contactSubmit"
  | "contactSuccessTitle"
  | "contactSuccessBody"
  | "contactGuidesKicker"
  | "contactGuidesTitle"
  | "contactGuideStartTitle"
  | "contactGuideStartBody"
  | "contactGuideImportTitle"
  | "contactGuideImportBody"
  | "contactGuidePrivacyTitle"
  | "contactGuidePrivacyBody"
  | "contactFaqKicker"
  | "contactFaqTitle"
  | "contactFaqDataTitle"
  | "contactFaqDataBody"
  | "contactFaqAiTitle"
  | "contactFaqAiBody"
  | "contactFaqExportTitle"
  | "contactFaqExportBody"
  | "feedbackEyebrow"
  | "feedbackTitle"
  | "feedbackSubtitle"
  | "feedbackFormTitle"
  | "feedbackTitleLabel"
  | "feedbackDetailsLabel"
  | "feedbackSubmit"
  | "feedbackSuccess"
  | "feedbackBoardKicker"
  | "feedbackBoardTitle"
  | "feedbackStatusPlanned"
  | "feedbackStatusReviewing"
  | "feedbackStatusOpen"
  | "feedbackVote"
  | "feedbackVoted"
  | "feedbackVoteAria"
  | "feedbackLoading"
  | "feedbackLoadError"
  | "feedbackEmpty"
  | "feedbackSubmitError"
  | "feedbackVoteError"
  | "feedbackSignInToSubmit"
  | "feedbackSignInToVote"
  | "blogEyebrow"
  | "blogTitle"
  | "blogSubtitle"
  | "blogIndexKicker"
  | "blogIndexTitle"
  | "blogCategoryUpdate"
  | "blogCategoryTips"
  | "blogCategoryInspiration"
  | "blogUpdateTitle"
  | "blogUpdateExcerpt"
  | "blogUpdateBody"
  | "blogUpdateDate"
  | "blogTipsTitle"
  | "blogTipsExcerpt"
  | "blogTipsBody"
  | "blogTipsDate"
  | "blogInspirationTitle"
  | "blogInspirationExcerpt"
  | "blogInspirationBody"
  | "blogInspirationDate"
  | "blogRead"
  | "blogReading";

export const publicPagesTranslations: Record<Language, Record<PublicPagesTranslationKey, string>> = {
  en: {
    aboutEyebrow: "About Thoughty",
    aboutTitle: "A quieter home for the thoughts worth keeping.",
    aboutSubtitle:
      "Thoughty exists for people who want reflection to stay personal, searchable, and portable without becoming another noisy productivity system.",
    aboutNoteLabel: "A sample Thoughty note",
    aboutNoteDate: "Mission note",
    aboutNoteTitle: "Useful journaling should respect the writer.",
    aboutNoteBody:
      "The product is shaped around private defaults, clear ownership, and tools that help after the writing without getting in the way during it.",
    aboutStoryKicker: "The story",
    aboutStoryTitle: "Built from the need to keep a life searchable.",
    aboutStoryBody:
      "Thoughty began as a practical journal: a place to write plainly, split life into diaries, import old notes, export everything, and find ideas again months later. The app keeps that origin close by treating portability and calm organization as core features, not add-ons.",
    aboutMissionKicker: "Mission",
    aboutMissionTitle:
      "Make personal writing easier to keep, revisit, and trust.",
    aboutValuePrivacyTitle: "Privacy first",
    aboutValuePrivacyBody:
      "Entries are private by default, visibility is explicit, and personal data remains downloadable.",
    aboutValueOwnershipTitle: "Ownership always",
    aboutValueOwnershipBody:
      "Import and export paths keep journals useful outside the app, from backups to books.",
    aboutValueCalmTitle: "Calm utility",
    aboutValueCalmBody:
      "Thoughty favors focused workflows, reusable organization, and AI only where it helps reflection.",
    aboutTeamKicker: "Team",
    aboutTeamTitle: "Small, product-led, and close to the writing.",
    aboutTeamBody:
      "Thoughty is developed as a focused independent product with a simple standard: every new feature should make the journal more trustworthy, more useful, or easier to leave with your work intact.",
    legalUpdatedLabel: "Last updated August 2026",
    privacyTitle: "Privacy Policy",
    privacySubtitle:
      "Thoughty is built for private journaling. This policy explains what the app needs to run and how your data stays under your control.",
    privacyIntroTitle: "Private by design",
    privacyIntroBody:
      "Journal entries are private by default. Public visibility is an explicit entry-level choice. Eligible public entries can appear to signed-in users in the community feed, while platform moderation can hide public content without changing your ownership. Anyone who can see your public entries can follow you; followers are only shown to you as a count.",
    privacyDataTitle: "Data we use",
    privacyDataBody:
      "Thoughty stores account details, profile settings, diaries, entries, tags, attachments, the people you follow, your comments and likes, sync preferences, and subscription records needed to provide the service.",
    privacyControlTitle: "Your controls",
    privacyControlBody:
      "You can edit or delete entries, download your user data, export journals in portable formats, change visibility, and delete your account from the app. A deleted account and all its data are permanently removed within 30 days.",
    privacySecurityTitle: "Security and providers",
    privacySecurityBody:
      "Authentication, cloud sync, storage, payments, and AI features may rely on configured providers. Thoughty keeps those integrations limited to the feature you choose to use.",
    termsTitle: "Terms of Service",
    termsSubtitle:
      "These terms set the basic expectations for using Thoughty respectfully, keeping your account secure, and retaining ownership of your writing.",
    termsUseTitle: "Using Thoughty",
    termsUseBody:
      "Use Thoughty for lawful personal writing, organization, import, export, and reflection. Public entries may appear in the signed-in community feed and may be hidden or removed when they violate service rules. Do not abuse public features, interfere with the service, or try to access another account.",
    termsAccountTitle: "Account responsibility",
    termsAccountBody:
      "You are responsible for keeping your login credentials secure and for the activity that happens through your account.",
    termsContentTitle: "Your content",
    termsContentBody:
      "You keep ownership of your entries, attachments, exports, and profile content. Thoughty processes that content only to operate the features you use.",
    termsLimitsTitle: "Service changes",
    termsLimitsBody:
      "Features, limits, and subscription plans may change as the product evolves. Important user-facing changes should be reflected in the app and supporting documentation.",
    contactEyebrow: "Support",
    contactTitle: "Contact and support",
    contactSubtitle:
      "Send a question, report an account issue, or start with the most common guides for keeping your journal organized and portable.",
    contactFormTitle: "Send a message",
    contactNameLabel: "Name",
    contactEmailLabel: "Email",
    contactTopicLabel: "Topic",
    contactTopicSupport: "Product support",
    contactTopicAccount: "Account access",
    contactTopicBilling: "Billing",
    contactTopicPrivacy: "Privacy and data",
    contactTopicFeedback: "Feedback or feature idea",
    contactMessageLabel: "Message",
    contactSubmit: "Send message",
    contactSuccessTitle: "Message ready",
    contactSuccessBody:
      "Thanks for reaching out. Your message has been captured in this session and the support team can wire it to an inbox next.",
    contactGuidesKicker: "How to",
    contactGuidesTitle: "How to guides",
    contactGuideStartTitle: "Start a focused journal",
    contactGuideStartBody:
      "Create entries with dates, tags, templates, and privacy settings so each thought stays easy to find later.",
    contactGuideImportTitle: "Import existing notes",
    contactGuideImportBody:
      "Use the import preview to detect formats, skip duplicates, and place old journals into the right diary before saving.",
    contactGuidePrivacyTitle: "Manage privacy",
    contactGuidePrivacyBody:
      "Keep entries private by default, make public thoughts explicit, and download or delete your data from Profile.",
    contactFaqKicker: "FAQ",
    contactFaqTitle: "Frequently asked questions",
    contactFaqDataTitle: "Can I export everything?",
    contactFaqDataBody:
      "Yes. Thoughty supports journal exports, stats exports, and a full user-data download from Profile.",
    contactFaqAiTitle: "Does AI read my whole journal?",
    contactFaqAiBody:
      "AI actions are tied to the feature you choose, such as tag suggestions, rephrasing, chat, or tone analysis.",
    contactFaqExportTitle: "Which formats are available?",
    contactFaqExportBody:
      "Entries can move through TXT, JSON, Markdown, CSV, PDF, EPUB, and HTML depending on the export workflow.",
    feedbackEyebrow: "Feedback",
    feedbackTitle: "Shape what Thoughty becomes next.",
    feedbackSubtitle:
      "Share feature ideas, describe the problem behind them, and upvote requests that would make your journal more useful.",
    feedbackFormTitle: "Submit an idea",
    feedbackTitleLabel: "Idea title",
    feedbackDetailsLabel: "What would this improve?",
    feedbackSubmit: "Post idea",
    feedbackSuccess: "Your idea has been added to the community board.",
    feedbackBoardKicker: "Feature requests",
    feedbackBoardTitle: "Ideas from the community",
    feedbackStatusPlanned: "Planned",
    feedbackStatusReviewing: "Reviewing",
    feedbackStatusOpen: "Open",
    feedbackVote: "Vote",
    feedbackVoted: "Voted",
    feedbackVoteAria: "Vote for {title}",
    feedbackLoading: "Loading community ideas...",
    feedbackLoadError: "The community board could not be loaded.",
    feedbackEmpty: "No ideas yet. Be the first to submit one.",
    feedbackSubmitError: "Your idea could not be submitted. Please try again.",
    feedbackVoteError: "Your vote could not be recorded. Please try again.",
    feedbackSignInToSubmit: "Sign in to post",
    feedbackSignInToVote: "Sign in to vote for {title}",
    blogEyebrow: "Thoughty blog",
    blogTitle: "Updates, tips, and journaling inspiration.",
    blogSubtitle:
      "Read product notes, practical writing workflows, and prompts that help Thoughty stay useful after the first week.",
    blogIndexKicker: "Latest posts",
    blogIndexTitle: "From the journal desk",
    blogCategoryUpdate: "Product update",
    blogCategoryTips: "Journaling tips",
    blogCategoryInspiration: "Inspiration",
    blogUpdateTitle: "What changed in Thoughty this month",
    blogUpdateExcerpt:
      "A quick look at public pages, cleaner navigation, and the support surfaces that make the app easier to trust.",
    blogUpdateBody:
      "This month focuses on the public side of Thoughty: clearer About, Privacy, Terms, Contact, Feedback, and Blog pages so people can understand the product before creating an account.",
    blogUpdateDate: "June 2026",
    blogTipsTitle: "A simple weekly review that stays light",
    blogTipsExcerpt:
      "Use tags, favorites, and stats to review a week of writing without turning your journal into a reporting chore.",
    blogTipsBody:
      "Pick three entries from the week: one useful decision, one open question, and one moment worth remembering. Favorite them, tag the theme, then let stats show patterns only after the writing is done.",
    blogTipsDate: "Guide",
    blogInspirationTitle: "Prompts for writing when the day feels noisy",
    blogInspirationExcerpt:
      "Three quiet prompts for getting thoughts out without forcing a perfect entry or a polished conclusion.",
    blogInspirationBody:
      "Try starting with what still has your attention, what can wait until tomorrow, and what you want future-you to remember. A useful entry can be short, unfinished, and still worth keeping.",
    blogInspirationDate: "Prompt set",
    blogRead: "Read",
    blogReading: "Reading",
  },
  fr: {
    aboutEyebrow: "À propos de Thoughty",
    aboutTitle: "Un lieu plus calme pour les pensées qui méritent de rester.",
    aboutSubtitle:
      "Thoughty s’adresse aux personnes qui veulent une réflexion personnelle, retrouvable et portable sans ajouter un système de productivité bruyant.",
    aboutNoteLabel: "Exemple de note Thoughty",
    aboutNoteDate: "Note de mission",
    aboutNoteTitle: "Un bon journal respecte la personne qui écrit.",
    aboutNoteBody:
      "Le produit est construit autour du privé par défaut, de la propriété claire des données et d’outils utiles après l’écriture, sans gêner le moment d’écrire.",
    aboutStoryKicker: "L’histoire",
    aboutStoryTitle: "Né du besoin de garder une vie retrouvable.",
    aboutStoryBody:
      "Thoughty a commencé comme un journal pratique : écrire simplement, séparer les sujets par journaux, importer d’anciennes notes, tout exporter et retrouver des idées plusieurs mois plus tard. L’application garde cette origine en traitant la portabilité et l’organisation calme comme des bases, pas comme des options.",
    aboutMissionKicker: "Mission",
    aboutMissionTitle:
      "Rendre l’écriture personnelle plus facile à garder, relire et faire confiance.",
    aboutValuePrivacyTitle: "Confidentialité d’abord",
    aboutValuePrivacyBody:
      "Les entrées sont privées par défaut, la visibilité est explicite et les données personnelles restent téléchargeables.",
    aboutValueOwnershipTitle: "Propriété toujours",
    aboutValueOwnershipBody:
      "Les imports et exports gardent les journaux utiles hors de l’application, des sauvegardes aux livres.",
    aboutValueCalmTitle: "Utilité calme",
    aboutValueCalmBody:
      "Thoughty privilégie les usages concentrés, l’organisation réutilisable et l’IA seulement quand elle aide la réflexion.",
    aboutTeamKicker: "Équipe",
    aboutTeamTitle: "Petite, orientée produit, proche de l’écriture.",
    aboutTeamBody:
      "Thoughty est développé comme un produit indépendant et ciblé avec une règle simple : chaque nouveauté doit rendre le journal plus fiable, plus utile ou plus facile à quitter avec votre travail intact.",
    legalUpdatedLabel: "Dernière mise à jour août 2026",
    privacyTitle: "Politique de confidentialité",
    privacySubtitle:
      "Thoughty est conçu pour un journal privé. Cette politique explique ce dont l’application a besoin pour fonctionner et comment vos données restent sous votre contrôle.",
    privacyIntroTitle: "Privé par conception",
    privacyIntroBody:
      "Les entrées du journal sont privées par défaut. La visibilité publique est un choix explicite pour chaque entrée. Les entrées publiques éligibles peuvent apparaître aux utilisateurs connectés dans le fil de la communauté, tandis que la modération peut masquer un contenu public sans changer votre propriété. Toute personne qui voit vos entrées publiques peut vous suivre ; vos abonnés ne vous sont présentés que sous forme de nombre.",
    privacyDataTitle: "Données utilisées",
    privacyDataBody:
      "Thoughty stocke les informations de compte, réglages de profil, journaux, entrées, tags, pièces jointes, personnes que vous suivez, vos commentaires et j'aime, préférences de synchronisation et éléments d’abonnement nécessaires au service.",
    privacyControlTitle: "Vos contrôles",
    privacyControlBody:
      "Vous pouvez modifier ou supprimer des entrées, télécharger vos données, exporter vos journaux dans des formats portables, changer la visibilité et supprimer votre compte. Un compte supprimé et toutes ses données sont effacés définitivement sous 30 jours.",
    privacySecurityTitle: "Sécurité et fournisseurs",
    privacySecurityBody:
      "L’authentification, la synchronisation cloud, le stockage, les paiements et les fonctions IA peuvent utiliser des fournisseurs configurés. Thoughty limite ces intégrations à la fonction choisie.",
    termsTitle: "Conditions d'utilisation",
    termsSubtitle:
      "Ces conditions posent les attentes de base pour utiliser Thoughty avec respect, sécuriser votre compte et conserver la propriété de vos écrits.",
    termsUseTitle: "Utiliser Thoughty",
    termsUseBody:
      "Utilisez Thoughty pour une écriture personnelle licite, l’organisation, l’import, l’export et la réflexion. Les entrées publiques peuvent apparaître dans le fil de la communauté connecté et être masquées ou supprimées en cas de violation des règles du service. N’abusez pas des fonctions publiques, ne perturbez pas le service et ne tentez pas d’accéder à un autre compte.",
    termsAccountTitle: "Responsabilité du compte",
    termsAccountBody:
      "Vous êtes responsable de la sécurité de vos identifiants et de l’activité réalisée depuis votre compte.",
    termsContentTitle: "Votre contenu",
    termsContentBody:
      "Vous conservez la propriété de vos entrées, pièces jointes, exports et contenus de profil. Thoughty traite ce contenu uniquement pour faire fonctionner les fonctions utilisées.",
    termsLimitsTitle: "Évolution du service",
    termsLimitsBody:
      "Les fonctionnalités, limites et abonnements peuvent évoluer avec le produit. Les changements importants pour les utilisateurs doivent apparaître dans l’application et la documentation.",
    contactEyebrow: "Support",
    contactTitle: "Contact et support",
    contactSubtitle:
      "Envoyez une question, signalez un problème de compte ou commencez avec les guides les plus courants pour garder votre journal organisé et portable.",
    contactFormTitle: "Envoyer un message",
    contactNameLabel: "Nom",
    contactEmailLabel: "Email",
    contactTopicLabel: "Sujet",
    contactTopicSupport: "Support produit",
    contactTopicAccount: "Accès au compte",
    contactTopicBilling: "Facturation",
    contactTopicPrivacy: "Confidentialité et données",
    contactTopicFeedback: "Avis ou idée de fonctionnalité",
    contactMessageLabel: "Message",
    contactSubmit: "Envoyer le message",
    contactSuccessTitle: "Message prêt",
    contactSuccessBody:
      "Merci pour votre message. Il a été capturé dans cette session et l’équipe support pourra ensuite le relier à une boîte de réception.",
    contactGuidesKicker: "Guides",
    contactGuidesTitle: "Guides pratiques",
    contactGuideStartTitle: "Commencer un journal ciblé",
    contactGuideStartBody:
      "Créez des entrées avec dates, tags, modèles et confidentialité pour retrouver facilement chaque pensée plus tard.",
    contactGuideImportTitle: "Importer des notes existantes",
    contactGuideImportBody:
      "Utilisez l’aperçu d’import pour détecter les formats, éviter les doublons et placer les anciens journaux au bon endroit.",
    contactGuidePrivacyTitle: "Gérer la confidentialité",
    contactGuidePrivacyBody:
      "Gardez les entrées privées par défaut, rendez les pensées publiques explicitement, puis téléchargez ou supprimez vos données depuis le profil.",
    contactFaqKicker: "FAQ",
    contactFaqTitle: "Questions fréquentes",
    contactFaqDataTitle: "Puis-je tout exporter ?",
    contactFaqDataBody:
      "Oui. Thoughty prend en charge les exports de journal, les exports de statistiques et le téléchargement complet des données utilisateur depuis le profil.",
    contactFaqAiTitle: "L’IA lit-elle tout mon journal ?",
    contactFaqAiBody:
      "Les actions IA sont liées à la fonction choisie, comme les suggestions de tags, la reformulation, le chat ou l’analyse de ton.",
    contactFaqExportTitle: "Quels formats sont disponibles ?",
    contactFaqExportBody:
      "Les entrées peuvent passer par TXT, JSON, Markdown, CSV, PDF, EPUB et HTML selon le parcours d’export.",
    feedbackEyebrow: "Feedback",
    feedbackTitle: "Aidez Thoughty à évoluer.",
    feedbackSubtitle:
      "Partagez vos idées, décrivez le problème à résoudre et votez pour les demandes qui rendraient votre journal plus utile.",
    feedbackFormTitle: "Proposer une idée",
    feedbackTitleLabel: "Titre de l’idée",
    feedbackDetailsLabel: "Qu’est-ce que cela améliorerait ?",
    feedbackSubmit: "Publier l’idée",
    feedbackSuccess: "Votre idée a été ajoutée au tableau de la communauté.",
    feedbackBoardKicker: "Demandes de fonctionnalités",
    feedbackBoardTitle: "Idées de la communauté",
    feedbackStatusPlanned: "Prévu",
    feedbackStatusReviewing: "En revue",
    feedbackStatusOpen: "Ouvert",
    feedbackVote: "Voter",
    feedbackVoted: "Voté",
    feedbackVoteAria: "Voter pour {title}",
    feedbackLoading: "Chargement des idées de la communauté...",
    feedbackLoadError: "Le tableau de la communauté n'a pas pu être chargé.",
    feedbackEmpty:
      "Aucune idée pour le moment. Soyez la première personne à en proposer une.",
    feedbackSubmitError:
      "Votre idée n'a pas pu être envoyée. Veuillez réessayer.",
    feedbackVoteError:
      "Votre vote n'a pas pu être enregistré. Veuillez réessayer.",
    feedbackSignInToSubmit: "Se connecter pour publier",
    feedbackSignInToVote: "Se connecter pour voter pour {title}",
    blogEyebrow: "Blog Thoughty",
    blogTitle: "Actualités, conseils et inspiration pour écrire.",
    blogSubtitle:
      "Lisez des notes produit, des méthodes d’écriture pratiques et des prompts pour que Thoughty reste utile après la première semaine.",
    blogIndexKicker: "Derniers articles",
    blogIndexTitle: "Depuis le bureau du journal",
    blogCategoryUpdate: "Actualité produit",
    blogCategoryTips: "Conseils de journal",
    blogCategoryInspiration: "Inspiration",
    blogUpdateTitle: "Ce qui a changé dans Thoughty ce mois-ci",
    blogUpdateExcerpt:
      "Un aperçu des pages publiques, de la navigation plus claire et des espaces de support qui rendent l’application plus fiable.",
    blogUpdateBody:
      "Ce mois-ci se concentre sur la partie publique de Thoughty : des pages À propos, Confidentialité, Conditions, Contact, Feedback et Blog plus claires pour comprendre le produit avant de créer un compte.",
    blogUpdateDate: "Juin 2026",
    blogTipsTitle: "Une revue hebdomadaire simple et légère",
    blogTipsExcerpt:
      "Utilisez tags, favoris et statistiques pour relire une semaine sans transformer votre journal en rapport.",
    blogTipsBody:
      "Choisissez trois entrées de la semaine : une décision utile, une question ouverte et un moment à garder. Ajoutez-les aux favoris, taguez le thème, puis laissez les statistiques montrer les tendances après l’écriture.",
    blogTipsDate: "Guide",
    blogInspirationTitle: "Prompts pour écrire quand la journée est bruyante",
    blogInspirationExcerpt:
      "Trois prompts calmes pour sortir les pensées sans exiger une entrée parfaite ou une conclusion nette.",
    blogInspirationBody:
      "Commencez par ce qui occupe encore votre attention, ce qui peut attendre demain et ce que votre futur vous devrait retenir. Une entrée utile peut être courte, inachevée et quand même précieuse.",
    blogInspirationDate: "Série de prompts",
    blogRead: "Lire",
    blogReading: "En lecture",
  },
};
