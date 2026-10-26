import type { Language } from './translations';

export type LandingTranslationKey =
  | 'landingNavLabel'
  | 'landingNavFeatures'
  | 'landingNavMemoir'
  | 'landingNavPrivacy'
  | 'landingNavBlog'
  | 'landingEyebrow'
  | 'landingHeroTitle'
  | 'landingHeroTitleAccent'
  | 'landingSubtitle'
  | 'landingStart'
  | 'landingExplore'
  | 'landingHeroNote'
  | 'landingOpenJournal'
  | 'landingVisualLabel'
  | 'landingVisualDate'
  | 'landingVisualTitle'
  | 'landingVisualMood'
  | 'landingVisualFeelings'
  | 'landingVisualBody'
  | 'landingVisualTaskDone'
  | 'landingVisualTaskOpen'
  | 'landingVisualTagFamily'
  | 'landingVisualTagSummer'
  | 'landingVisualMemoirLabel'
  | 'landingVisualMemoirQuestion'
  | 'landingVisualMemoirVoice'
  | 'landingVisualBookTitle'
  | 'landingVisualBookMeta'
  | 'landingProofPrivateTitle'
  | 'landingProofPrivateBody'
  | 'landingProofAiTitle'
  | 'landingProofAiBody'
  | 'landingProofExportTitle'
  | 'landingProofExportBody'
  | 'landingProofAccessTitle'
  | 'landingProofAccessBody'
  | 'landingPathsKicker'
  | 'landingPathsHeading'
  | 'landingPathJournalLabel'
  | 'landingPathJournalTitle'
  | 'landingPathJournalBody'
  | 'landingPathMemoirLabel'
  | 'landingPathMemoirTitle'
  | 'landingPathMemoirBody'
  | 'landingPathBookLabel'
  | 'landingPathBookTitle'
  | 'landingPathBookBody'
  | 'landingWritingKicker'
  | 'landingWritingTitle'
  | 'landingWritingBody'
  | 'landingWritingPoint1'
  | 'landingWritingPoint2'
  | 'landingWritingPoint3'
  | 'landingWritingVisualText1'
  | 'landingWritingVisualText2'
  | 'landingMemoirKicker'
  | 'landingMemoirTitle'
  | 'landingMemoirBody'
  | 'landingMemoirPoint1'
  | 'landingMemoirPoint2'
  | 'landingMemoirPoint3'
  | 'landingMemoirVisualProgress'
  | 'landingMemoirVisualStats'
  | 'landingChapterChildhood'
  | 'landingChapterGrowingUp'
  | 'landingChapterFamily'
  | 'landingChapterLove'
  | 'landingChapterWork'
  | 'landingLookBackKicker'
  | 'landingLookBackTitle'
  | 'landingLookBackBody'
  | 'landingLookBackPoint1'
  | 'landingLookBackPoint2'
  | 'landingLookBackPoint3'
  | 'landingLookBackVisualMood'
  | 'landingLookBackVisualStreak'
  | 'landingLookBackVisualStreakValue'
  | 'landingLookBackVisualOnThisDay'
  | 'landingLookBackVisualMemory'
  | 'landingBooksKicker'
  | 'landingBooksTitle'
  | 'landingBooksBody'
  | 'landingBooksPoint1'
  | 'landingBooksPoint2'
  | 'landingBooksPoint3'
  | 'landingBooksVisualContents'
  | 'landingPrivacyKicker'
  | 'landingPrivacyTitle'
  | 'landingPrivacyEntriesTitle'
  | 'landingPrivacyEntriesBody'
  | 'landingPrivacyAiTitle'
  | 'landingPrivacyAiBody'
  | 'landingPrivacyExportTitle'
  | 'landingPrivacyExportBody'
  | 'landingImportTitle'
  | 'landingImportBody'
  | 'landingMoreKicker'
  | 'landingMoreHeading'
  | 'landingMoreDiariesTitle'
  | 'landingMoreDiariesBody'
  | 'landingMoreSearchTitle'
  | 'landingMoreSearchBody'
  | 'landingMoreLinksTitle'
  | 'landingMoreLinksBody'
  | 'landingMoreMediaTitle'
  | 'landingMoreMediaBody'
  | 'landingMoreCloudTitle'
  | 'landingMoreCloudBody'
  | 'landingMoreHistoryTitle'
  | 'landingMoreHistoryBody'
  | 'landingMoreAccessTitle'
  | 'landingMoreAccessBody'
  | 'landingMoreLanguageTitle'
  | 'landingMoreLanguageBody'
  | 'landingCtaKicker'
  | 'landingCtaTitle'
  | 'landingCtaBody';

export const landingTranslations: Record<Language, Record<LandingTranslationKey, string>> = {
  en: {
    landingNavLabel: 'Page sections',
    landingNavFeatures: 'Features',
    landingNavMemoir: 'Memoir',
    landingNavPrivacy: 'Privacy',
    landingNavBlog: 'Blog',
    landingEyebrow: 'Private journal · Guided memoir · Your own book',
    landingHeroTitle: 'A private journal that',
    landingHeroTitleAccent: 'becomes your life story.',
    landingSubtitle:
      'Write in a calm, focused space. Answer one life-story question a week, in writing or out loud. Thoughty keeps every word private, finds it again in seconds, and turns it into a book you can print and keep.',
    landingStart: 'Start your journal',
    landingExplore: 'See how it works',
    landingHeroNote: 'Free to start · English and French · Export everything, anytime',
    landingOpenJournal: 'Open your journal',
    landingVisualLabel: 'Thoughty preview: a journal entry, a memoir question, and a finished book',
    landingVisualDate: 'Sunday, June 14',
    landingVisualTitle: 'The first swim of summer',
    landingVisualMood: 'Mood: good',
    landingVisualFeelings: 'grateful · calm',
    landingVisualBody:
      'Cold water, warm sand, and Lea laughing on the jetty. I want to remember how easy today felt.',
    landingVisualTaskDone: 'Call Grandma',
    landingVisualTaskOpen: 'Print the photos',
    landingVisualTagFamily: 'family',
    landingVisualTagSummer: 'summer',
    landingVisualMemoirLabel: 'Memoir · Week 12 of 52',
    landingVisualMemoirQuestion: 'What did your childhood home sound like in the morning?',
    landingVisualMemoirVoice: 'Answer out loud',
    landingVisualBookTitle: 'My life, so far',
    landingVisualBookMeta: '7 chapters · 214 pages',
    landingProofPrivateTitle: 'Private by default',
    landingProofPrivateBody: 'Nothing is shared unless you choose to share it.',
    landingProofAiTitle: 'AI only when you ask',
    landingProofAiBody: 'Every AI feature is optional, with your own key if you prefer.',
    landingProofExportTitle: 'Never locked in',
    landingProofExportBody: 'Import from Day One and Journey, export to seven formats.',
    landingProofAccessTitle: 'Made for everyone',
    landingProofAccessBody: 'Phone or desktop, light or dark, tested against WCAG 2.2 AA.',
    landingPathsKicker: 'What Thoughty does',
    landingPathsHeading: 'One place for everything you want to remember.',
    landingPathJournalLabel: 'Journal',
    landingPathJournalTitle: 'Write today',
    landingPathJournalBody:
      'A calm composer with Markdown, 13 templates, moods and feelings, task lists, photos, and voice notes.',
    landingPathMemoirLabel: 'Memoir',
    landingPathMemoirTitle: 'Tell your story',
    landingPathMemoirBody:
      'Fifty-two questions across seven chapters of a life, one a week. Answer in writing or simply talk.',
    landingPathBookLabel: 'Book',
    landingPathBookTitle: 'Keep it forever',
    landingPathBookBody:
      'Turn a diary, a year, or your memoir into a book with chapters and a cover, as PDF or EPUB.',
    landingWritingKicker: 'Writing',
    landingWritingTitle: 'A quiet page that gets out of the way',
    landingWritingBody:
      'Focus mode leaves nothing on screen but your words, with typewriter scrolling, a live word count, and a goal for the session. Start from a template for gratitude, a weekly review, or a hard decision, or just write.',
    landingWritingPoint1: '13 templates, or save your own',
    landingWritingPoint2: 'Several entries a day, each with its own time and title',
    landingWritingPoint3: 'Every edit kept in the revision history',
    landingWritingVisualText1: 'Some days the words come easily.',
    landingWritingVisualText2: 'Today I want to get it all down before it fades: the light, the noise, what she said at the door.',
    landingMemoirKicker: 'Guided memoir',
    landingMemoirTitle: 'Your life story, one question a week',
    landingMemoirBody:
      'Pick a weekday and a new question arrives at 9:00, by email if you like, from childhood to the lessons you would pass on. Each answer goes into a private memoir diary, chapter by chapter, ready to become a book.',
    landingMemoirPoint1: '52 questions in 7 chapters of a life',
    landingMemoirPoint2: 'Answer out loud, and let AI turn the recording into text',
    landingMemoirPoint3: 'Watch the words and pages add up',
    landingMemoirVisualProgress: '18 of 52 questions answered',
    landingMemoirVisualStats: '9,420 words · about 38 pages',
    landingChapterChildhood: 'Childhood',
    landingChapterGrowingUp: 'Growing up',
    landingChapterFamily: 'Family',
    landingChapterLove: 'Love and friendship',
    landingChapterWork: 'Work',
    landingLookBackKicker: 'Look back',
    landingLookBackTitle: 'See your year, not just your entries',
    landingLookBackBody:
      'On This Day brings back what you wrote in past years. Stats, a mood chart, and the links between your tags show patterns without any AI. Each year ends with a review you can print as a booklet.',
    landingLookBackPoint1: 'Activity heatmap and writing streaks',
    landingLookBackPoint2: 'Average mood by month and by weekday',
    landingLookBackPoint3: 'A year in review compared with the year before',
    landingLookBackVisualMood: 'Mood this year',
    landingLookBackVisualStreak: 'Longest streak',
    landingLookBackVisualStreakValue: '{count} days',
    landingLookBackVisualOnThisDay: 'On this day in 2023',
    landingLookBackVisualMemory: 'Moved into the flat on Rue Oberkampf. Boxes everywhere, pizza on the floor.',
    landingBooksKicker: 'Books',
    landingBooksTitle: 'From journal to a real book',
    landingBooksBody:
      'Choose a diary, a date range, and the tags that become chapters, or make a yearbook by year or month. With AI, entries are woven into flowing first-person prose, and strict mode adds nothing that is not in your words.',
    landingBooksPoint1: 'A cover with your own photo',
    landingBooksPoint2: 'PDF, EPUB, HTML, or Markdown',
    landingBooksPoint3: 'Save a new version as your story grows',
    landingBooksVisualContents: 'Contents',
    landingPrivacyKicker: 'Privacy',
    landingPrivacyTitle: 'Private by design, helpful when you ask.',
    landingPrivacyEntriesTitle: 'Your words stay yours',
    landingPrivacyEntriesBody:
      'Entries stay private unless you publish one. Add a sign-in code by email, review your active sessions, and download all your data whenever you want.',
    landingPrivacyAiTitle: 'AI on your terms',
    landingPrivacyAiBody:
      'Tagging, rephrasing, summaries, chat, and meaning search are all optional. Bring your own OpenRouter key, pick a model for each task, and follow usage and cost over 30 days.',
    landingPrivacyExportTitle: 'Leave with everything',
    landingPrivacyExportBody:
      'Export to TXT, JSON, Markdown, CSV, PDF, EPUB, or HTML, or as a folder of Markdown files that opens as is in Obsidian.',
    landingImportTitle: 'Coming from Day One or Journey?',
    landingImportBody:
      'Bring your entries with their titles, tags, favorites, and photos. Import the same file again and Thoughty skips what is already there.',
    landingMoreKicker: 'And more',
    landingMoreHeading: 'Everything a lifelong journal needs.',
    landingMoreDiariesTitle: 'A diary for each part of life',
    landingMoreDiariesBody: 'Separate diaries with their own emoji and color, or read them all together.',
    landingMoreSearchTitle: 'Search that understands you',
    landingMoreSearchBody:
      'Full-text search in English and French with exact phrases, exclusions, and OR, or search by meaning with AI.',
    landingMoreLinksTitle: 'Entries that link up',
    landingMoreLinksBody: 'Link to any day with [[2024-01-15]] and see which entries point back.',
    landingMoreMediaTitle: 'Photos and voice notes',
    landingMoreMediaBody: 'Attach images, audio, and PDFs to any entry, and transcribe recordings with AI.',
    landingMoreCloudTitle: 'Backups to your cloud',
    landingMoreCloudBody: 'Scheduled sync to Google Drive, OneDrive, or Dropbox.',
    landingMoreHistoryTitle: 'Nothing lost by accident',
    landingMoreHistoryBody:
      'Every edit keeps the previous version, and deleted entries wait 30 days in the recycle bin.',
    landingMoreAccessTitle: 'Accessible to everyone',
    landingMoreAccessBody: 'Works with the keyboard, screen readers, and high contrast.',
    landingMoreLanguageTitle: 'Your language, your look',
    landingMoreLanguageBody: 'English or French, light or dark, with the font and size you like.',
    landingCtaKicker: 'Start today',
    landingCtaTitle: 'Your future self will want to read this.',
    landingCtaBody:
      'Write your first entry tonight or answer the first memoir question. It takes a minute, and it stays private.',
  },
  fr: {
    landingNavLabel: 'Sections de la page',
    landingNavFeatures: 'Fonctionnalités',
    landingNavMemoir: 'Mémoires',
    landingNavPrivacy: 'Confidentialité',
    landingNavBlog: 'Blog',
    landingEyebrow: 'Journal privé · Mémoires guidées · Votre propre livre',
    landingHeroTitle: 'Un journal privé qui',
    landingHeroTitleAccent: 'devient l’histoire de votre vie.',
    landingSubtitle:
      'Écrivez dans un espace calme et concentré. Répondez chaque semaine à une question sur votre vie, par écrit ou à voix haute. Thoughty garde chaque mot privé, le retrouve en quelques secondes et en fait un livre à imprimer et à garder.',
    landingStart: 'Commencer mon journal',
    landingExplore: 'Voir comment ça marche',
    landingHeroNote: 'Gratuit pour commencer · Français et anglais · Tout exporter, à tout moment',
    landingOpenJournal: 'Ouvrir votre journal',
    landingVisualLabel: 'Aperçu de Thoughty : une entrée de journal, une question de mémoires et un livre terminé',
    landingVisualDate: 'Dimanche 14 juin',
    landingVisualTitle: 'Première baignade de l’été',
    landingVisualMood: 'Humeur : bonne',
    landingVisualFeelings: 'gratitude · calme',
    landingVisualBody:
      'L’eau froide, le sable chaud, et Léa qui riait sur la jetée. Je veux me souvenir de cette journée si légère.',
    landingVisualTaskDone: 'Appeler mamie',
    landingVisualTaskOpen: 'Imprimer les photos',
    landingVisualTagFamily: 'famille',
    landingVisualTagSummer: 'été',
    landingVisualMemoirLabel: 'Mémoires · Semaine 12 sur 52',
    landingVisualMemoirQuestion: 'Quels bruits entendait-on le matin dans la maison de votre enfance ?',
    landingVisualMemoirVoice: 'Répondre à voix haute',
    landingVisualBookTitle: 'Ma vie, jusqu’ici',
    landingVisualBookMeta: '7 chapitres · 214 pages',
    landingProofPrivateTitle: 'Privé par défaut',
    landingProofPrivateBody: 'Rien n’est partagé sans que vous le choisissiez.',
    landingProofAiTitle: 'L’IA seulement à la demande',
    landingProofAiBody: 'Chaque fonction d’IA est facultative, avec votre propre clé si vous préférez.',
    landingProofExportTitle: 'Libre de partir',
    landingProofExportBody: 'Importez depuis Day One et Journey, exportez en sept formats.',
    landingProofAccessTitle: 'Pensé pour tous',
    landingProofAccessBody: 'Mobile ou ordinateur, clair ou sombre, testé selon WCAG 2.2 AA.',
    landingPathsKicker: 'Ce que fait Thoughty',
    landingPathsHeading: 'Un seul endroit pour tout ce que vous voulez garder.',
    landingPathJournalLabel: 'Journal',
    landingPathJournalTitle: 'Écrire aujourd’hui',
    landingPathJournalBody:
      'Un éditeur apaisant avec Markdown, 13 modèles, humeurs et émotions, listes de tâches, photos et notes vocales.',
    landingPathMemoirLabel: 'Mémoires',
    landingPathMemoirTitle: 'Raconter votre histoire',
    landingPathMemoirBody:
      'Cinquante-deux questions sur sept chapitres d’une vie, une par semaine. Répondez par écrit ou simplement à voix haute.',
    landingPathBookLabel: 'Livre',
    landingPathBookTitle: 'Le garder pour toujours',
    landingPathBookBody:
      'Transformez un journal, une année ou vos mémoires en livre avec chapitres et couverture, en PDF ou en EPUB.',
    landingWritingKicker: 'Écriture',
    landingWritingTitle: 'Une page calme qui s’efface devant vos mots',
    landingWritingBody:
      'Le mode concentration ne laisse à l’écran que vos mots, avec défilement machine à écrire, compteur de mots en direct et objectif de séance. Partez d’un modèle (gratitude, bilan de la semaine, décision difficile) ou écrivez librement.',
    landingWritingPoint1: '13 modèles, ou enregistrez les vôtres',
    landingWritingPoint2: 'Plusieurs entrées par jour, chacune avec son heure et son titre',
    landingWritingPoint3: 'Chaque modification conservée dans l’historique',
    landingWritingVisualText1: 'Certains jours, les mots viennent tout seuls.',
    landingWritingVisualText2: 'Aujourd’hui, je veux tout noter avant que ça s’efface : la lumière, le bruit, ce qu’elle a dit sur le pas de la porte.',
    landingMemoirKicker: 'Mémoires guidées',
    landingMemoirTitle: 'L’histoire de votre vie, une question par semaine',
    landingMemoirBody:
      'Choisissez un jour : une nouvelle question arrive à 9 h, par e-mail si vous le souhaitez, de l’enfance aux leçons que vous aimeriez transmettre. Chaque réponse rejoint un journal de mémoires privé, chapitre par chapitre, prêt à devenir un livre.',
    landingMemoirPoint1: '52 questions en 7 chapitres de vie',
    landingMemoirPoint2: 'Répondez à voix haute, et l’IA transcrit l’enregistrement',
    landingMemoirPoint3: 'Voyez les mots et les pages s’accumuler',
    landingMemoirVisualProgress: '18 questions sur 52 répondues',
    landingMemoirVisualStats: '9 420 mots · environ 38 pages',
    landingChapterChildhood: 'Enfance',
    landingChapterGrowingUp: 'Grandir',
    landingChapterFamily: 'Famille',
    landingChapterLove: 'Amour et amitié',
    landingChapterWork: 'Travail',
    landingLookBackKicker: 'Regarder en arrière',
    landingLookBackTitle: 'Voir votre année, pas seulement vos entrées',
    landingLookBackBody:
      '« Ce jour-là » fait remonter ce que vous écriviez les années passées. Les statistiques, la courbe d’humeur et les liens entre vos tags révèlent des tendances, sans IA. Chaque année se termine par un bilan à imprimer en livret.',
    landingLookBackPoint1: 'Carte d’activité et séries d’écriture',
    landingLookBackPoint2: 'Humeur moyenne par mois et par jour de la semaine',
    landingLookBackPoint3: 'Un bilan annuel comparé à l’année précédente',
    landingLookBackVisualMood: 'Humeur cette année',
    landingLookBackVisualStreak: 'Plus longue série',
    landingLookBackVisualStreakValue: '{count} jours',
    landingLookBackVisualOnThisDay: 'Ce jour-là, en 2023',
    landingLookBackVisualMemory: 'Emménagement rue Oberkampf. Des cartons partout, une pizza par terre.',
    landingBooksKicker: 'Livres',
    landingBooksTitle: 'Du journal à un vrai livre',
    landingBooksBody:
      'Choisissez un journal, une période et les tags qui deviennent des chapitres, ou créez un album par année ou par mois. Avec l’IA, vos entrées deviennent un récit fluide à la première personne, et le mode strict n’ajoute rien qui ne vienne de vous.',
    landingBooksPoint1: 'Une couverture avec votre propre photo',
    landingBooksPoint2: 'PDF, EPUB, HTML ou Markdown',
    landingBooksPoint3: 'Une nouvelle version à chaque étape de votre histoire',
    landingBooksVisualContents: 'Sommaire',
    landingPrivacyKicker: 'Confidentialité',
    landingPrivacyTitle: 'Privé par conception, utile quand vous le demandez.',
    landingPrivacyEntriesTitle: 'Vos mots restent à vous',
    landingPrivacyEntriesBody:
      'Les entrées restent privées sauf si vous en publiez une. Ajoutez un code de connexion par e-mail, gérez vos sessions actives et téléchargez toutes vos données quand vous le voulez.',
    landingPrivacyAiTitle: 'L’IA selon vos règles',
    landingPrivacyAiBody:
      'Tags automatiques, reformulation, résumés, discussion et recherche par le sens sont tous facultatifs. Utilisez votre propre clé OpenRouter, choisissez un modèle par tâche et suivez l’usage et le coût sur 30 jours.',
    landingPrivacyExportTitle: 'Partez avec tout',
    landingPrivacyExportBody:
      'Exportez en TXT, JSON, Markdown, CSV, PDF, EPUB ou HTML, ou en dossier de fichiers Markdown qui s’ouvre tel quel dans Obsidian.',
    landingImportTitle: 'Vous venez de Day One ou de Journey ?',
    landingImportBody:
      'Importez vos entrées avec leurs titres, tags, favoris et photos. Si vous importez à nouveau le même fichier, Thoughty ignore ce qui est déjà là.',
    landingMoreKicker: 'Et aussi',
    landingMoreHeading: 'Tout ce qu’il faut à un journal pour la vie.',
    landingMoreDiariesTitle: 'Un journal pour chaque part de votre vie',
    landingMoreDiariesBody: 'Des journaux séparés, chacun avec son emoji et sa couleur, ou tous réunis.',
    landingMoreSearchTitle: 'Une recherche qui vous comprend',
    landingMoreSearchBody:
      'Recherche plein texte en français et en anglais, avec phrases exactes, exclusions et OU, ou recherche par le sens avec l’IA.',
    landingMoreLinksTitle: 'Des entrées reliées',
    landingMoreLinksBody: 'Liez n’importe quel jour avec [[2024-01-15]] et voyez quelles entrées y renvoient.',
    landingMoreMediaTitle: 'Photos et notes vocales',
    landingMoreMediaBody: 'Joignez images, audio et PDF à une entrée, et transcrivez vos enregistrements avec l’IA.',
    landingMoreCloudTitle: 'Sauvegardes dans votre cloud',
    landingMoreCloudBody: 'Synchronisation planifiée vers Google Drive, OneDrive ou Dropbox.',
    landingMoreHistoryTitle: 'Rien de perdu par mégarde',
    landingMoreHistoryBody:
      'Chaque modification garde la version précédente, et les entrées supprimées attendent 30 jours dans la corbeille.',
    landingMoreAccessTitle: 'Accessible à tous',
    landingMoreAccessBody: 'Utilisable au clavier, avec un lecteur d’écran et en contraste élevé.',
    landingMoreLanguageTitle: 'Votre langue, votre style',
    landingMoreLanguageBody: 'Français ou anglais, clair ou sombre, avec la police et la taille de votre choix.',
    landingCtaKicker: 'Commencez aujourd’hui',
    landingCtaTitle: 'Dans dix ans, vous aurez plaisir à relire ces lignes.',
    landingCtaBody:
      'Écrivez votre première entrée ce soir ou répondez à la première question de vos mémoires. Cela prend une minute, et tout reste privé.',
  },
};
