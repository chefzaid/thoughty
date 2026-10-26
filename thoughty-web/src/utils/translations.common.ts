import type { Language } from './translations';

/** Words shared across the app: the shell, footer, pagination, dialogs and generic actions. */
export type CommonTranslationKey =
  | "journal"
  | "loadMoreEntries"
  | "stats"
  | "whatsOnYourMind"
  | "save"
  | "public"
  | "private"
  | "publicTooltip"
  | "privateTooltip"
  | "copyright"
  | "madeWithLove"
  | "about"
  | "privacy"
  | "terms"
  | "contact"
  | "skipToContent"
  | "goToFirst"
  | "go"
  | "previous"
  | "next"
  | "first"
  | "last"
  | "page"
  | "ofTotal"
  | "close"
  | "closeDialog"
  | "backToTop"
  | "enabled"
  | "disabled"
  | "sending"
  | "verifying"
  | "disabling"
  | "cancel"
  | "entries"
  | "tags"
  | "delete"
  | "edit"
  | "loading"
  | "retry"
  | "tryAgain"
  | "loadingEntries"
  | "selectAll"
  | "apply";

export const commonTranslations: Record<Language, Record<CommonTranslationKey, string>> = {
  en: {
    journal: "Journal",
    loadMoreEntries: "Load more entries",
    stats: "Stats",
    whatsOnYourMind: "What's on your mind?",
    save: "Save",
    public: "Public",
    private: "Private",
    publicTooltip: "Public - visible to everyone",
    privateTooltip: "Private - only you can see",
    copyright: "© {year} Thoughty. All rights reserved.",
    madeWithLove: "Made with ❤️ in Paris",
    about: "About",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    contact: "Contact Us",
    skipToContent: "Skip to content",
    goToFirst: "Go to first entry",
    go: "Go",
    previous: "Previous",
    next: "Next",
    first: "First",
    last: "Last",
    page: "Page",
    ofTotal: "of {total}",
    close: "Close",
    closeDialog: "Close dialog",
    backToTop: "Back to top",
    enabled: "Enabled",
    disabled: "Disabled",
    sending: "Sending...",
    verifying: "Verifying...",
    disabling: "Disabling...",
    cancel: "Cancel",
    entries: "Entries",
    tags: "Tags",
    delete: "Delete",
    edit: "Edit",
    loading: "Loading",
    retry: "Retry",
    tryAgain: "Try again",
    loadingEntries: "Loading entries...",
    selectAll: "Select all",
    apply: "Apply",
  },
  fr: {
    journal: "Journal",
    loadMoreEntries: "Charger plus d'entrées",
    stats: "Statistiques",
    whatsOnYourMind: "Qu'avez-vous à l'esprit ?",
    save: "Enregistrer",
    public: "Public",
    private: "Privé",
    publicTooltip: "Public - visible par tous",
    privateTooltip: "Privé - visible uniquement par vous",
    copyright: "© {year} Thoughty. Tous droits réservés.",
    madeWithLove: "Fait avec ❤️ à Paris",
    about: "À propos",
    privacy: "Politique de confidentialité",
    terms: "Conditions d'utilisation",
    contact: "Nous contacter",
    skipToContent: "Aller au contenu",
    goToFirst: "Aller à la première entrée",
    go: "Aller",
    previous: "Précédent",
    next: "Suivant",
    first: "Premier",
    last: "Dernier",
    page: "Page",
    ofTotal: "sur {total}",
    close: "Fermer",
    closeDialog: "Fermer la fenêtre",
    backToTop: "Retour en haut",
    enabled: "Activée",
    disabled: "Désactivée",
    sending: "Envoi...",
    verifying: "Vérification...",
    disabling: "Désactivation...",
    cancel: "Annuler",
    entries: "Entrées",
    tags: "Tags",
    delete: "Supprimer",
    edit: "Modifier",
    loading: "Chargement",
    retry: "Réessayer",
    tryAgain: "Réessayer",
    loadingEntries: "Chargement des entrées...",
    selectAll: "Tout sélectionner",
    apply: "Appliquer",
  },
};
