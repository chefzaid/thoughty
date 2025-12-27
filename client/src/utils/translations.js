export const translations = {
    en: {
        // App
        journal: 'Journal',
        stats: 'Stats',
        settings: 'Settings',
        myJournal: 'My Journal',
        whatsOnYourMind: "What's on your mind?",
        save: 'Save',
        public: 'Public',
        private: 'Private',
        publicTooltip: 'Public - visible to everyone',
        privateTooltip: 'Private - only you can see',
        copyright: '© {year} Thoughty. All rights reserved.',
        madeWithLove: 'Made with ❤️ in Paris',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        contact: 'Contact Us',
        searchPlaceholder: 'Search content...',
        filterTagsPlaceholder: 'Filter by tags...',
        filterDatePlaceholder: 'Filter by date',
        resetFilters: 'Reset Filters',
        pageInfo: 'Page {page} of {totalPages}',
        previous: 'Previous',
        next: 'Next',
        first: 'First',
        last: 'Last',
        page: 'Page',
        ofTotal: 'of {total}',
        close: 'Close',
        backToTop: 'Back to top',

        // Settings
        profileName: 'Name',
        theme: 'Theme',
        entriesPerPage: 'Entries per page',
        defaultVisibility: 'Default Visibility',
        language: 'Language',
        cancel: 'Cancel',
        saveSettings: 'Save',

        // Confirm Modal
        deleteEntryTitle: 'Delete Entry',
        deleteEntryMessage: 'Are you sure you want to delete this entry? This action cannot be undone.',
        delete: 'Delete',

        // Entries List
        noEntriesFound: 'No entries found',
        edit: 'Edit',
        readMore: 'Read more',
        showLess: 'Show less',

        // Stats
        totalEntries: 'Total Entries',
        currentStreak: 'Current Streak',
        topTags: 'Top Tags',
        entriesOverTime: 'Entries Over Time',
        tagDistribution: 'Tag Distribution',

        // Auth & Profile
        user: 'User',
        logout: 'Logout'
    },
    fr: {
        // App
        journal: 'Journal',
        stats: 'Statistiques',
        settings: 'Paramètres',
        myJournal: 'Mon Journal',
        whatsOnYourMind: "Qu'avez-vous à l'esprit ?",
        save: 'Enregistrer',
        public: 'Public',
        private: 'Privé',
        publicTooltip: 'Public - visible par tous',
        privateTooltip: 'Privé - visible uniquement par vous',
        copyright: '© {year} Thoughty. Tous droits réservés.',
        madeWithLove: 'Fait avec ❤️ à Paris',
        privacy: 'Politique de confidentialité',
        terms: 'Conditions d\'utilisation',
        contact: 'Nous contacter',
        searchPlaceholder: 'Rechercher...',
        filterTagsPlaceholder: 'Filtrer par tags...',
        filterDatePlaceholder: 'Filtrer par date',
        resetFilters: 'Réinitialiser',
        pageInfo: 'Page {page} sur {totalPages}',
        previous: 'Précédent',
        next: 'Suivant',
        first: 'Premier',
        last: 'Dernier',
        page: 'Page',
        ofTotal: 'sur {total}',
        close: 'Fermer',
        backToTop: 'Retour en haut',

        // Settings
        profileName: 'Nom',
        theme: 'Thème',
        entriesPerPage: 'Entrées par page',
        defaultVisibility: 'Visibilité par défaut',
        language: 'Langue',
        cancel: 'Annuler',
        saveSettings: 'Enregistrer',

        // Confirm Modal
        deleteEntryTitle: 'Supprimer l\'entrée',
        deleteEntryMessage: 'Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action est irréversible.',
        delete: 'Supprimer',

        // Entries List
        noEntriesFound: 'Aucune entrée trouvée',
        edit: 'Modifier',
        readMore: 'Lire la suite',
        showLess: 'Voir moins',

        // Stats
        totalEntries: 'Total des entrées',
        currentStreak: 'Série actuelle',
        topTags: 'Tags populaires',
        entriesOverTime: 'Entrées au fil du temps',
        tagDistribution: 'Distribution des tags',

        // Auth & Profile
        user: 'Utilisateur',
        logout: 'Déconnexion'
    }
};

export const getTranslation = (lang, key, params = {}) => {
    const language = translations[lang] || translations['en'];
    let text = language[key] || key;

    Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, params[param]);
    });

    return text;
};
