import type { Language } from './translations';

/** AI settings: the OpenRouter key, usage dashboard and model choices. */
export type AiSettingsTranslationKey =
  | "aiConfiguration"
  | "openRouterApiKey"
  | "personalKeyActive"
  | "serverKeyActive"
  | "aiUnavailable"
  | "openRouterKeyPlaceholder"
  | "saveApiKey"
  | "replaceApiKey"
  | "removeApiKey"
  | "showApiKey"
  | "hideApiKey"
  | "apiKeySaved"
  | "apiKeyRemoved"
  | "apiKeySaveError"
  | "apiKeyRemoveError"
  | "createOpenRouterKey"
  | "usageDashboard"
  | "refreshUsage"
  | "thoughtyUsagePeriod"
  | "totalTokens"
  | "promptTokens"
  | "completionTokens"
  | "reasoningTokens"
  | "requests"
  | "thoughtyCost"
  | "openRouterKeyUsage"
  | "allTimeCost"
  | "monthlyCost"
  | "dailyCost"
  | "remainingLimit"
  | "unlimited"
  | "usageUnavailable"
  | "openRouterModel"
  | "openRouterTaskModels"
  | "openRouterTaskModelsDescription"
  | "openRouterTagModel"
  | "openRouterWritingModel"
  | "openRouterChatModel"
  | "openRouterToneModel"
  | "openRouterSummaryModel"
  | "openRouterPromptModel"
  | "openRouterBookModel"
  | "inheritDefaultModel"
  | "searchModels"
  | "noModelsFound"
  | "loadingModels"
  | "autoTagMaxTags";

export const aiSettingsTranslations: Record<Language, Record<AiSettingsTranslationKey, string>> = {
  en: {
    aiConfiguration: "AI Configuration",
    openRouterApiKey: "OpenRouter API key",
    personalKeyActive: "Personal key active",
    serverKeyActive: "Using the server key",
    aiUnavailable: "No API key available",
    openRouterKeyPlaceholder: "sk-or-v1-...",
    saveApiKey: "Save key",
    replaceApiKey: "Replace key",
    removeApiKey: "Remove key",
    showApiKey: "Show API key",
    hideApiKey: "Hide API key",
    apiKeySaved: "API key saved",
    apiKeyRemoved: "API key removed",
    apiKeySaveError: "Could not save API key",
    apiKeyRemoveError: "Could not remove API key",
    createOpenRouterKey: "OpenRouter keys",
    usageDashboard: "Usage dashboard",
    refreshUsage: "Refresh usage",
    thoughtyUsagePeriod: "Thoughty activity over the last {days} days",
    totalTokens: "Total tokens",
    promptTokens: "Prompt tokens",
    completionTokens: "Completion tokens",
    reasoningTokens: "Reasoning tokens",
    requests: "Requests",
    thoughtyCost: "Thoughty cost",
    openRouterKeyUsage: "OpenRouter key usage",
    allTimeCost: "All-time spend",
    monthlyCost: "This month",
    dailyCost: "Today",
    remainingLimit: "Limit remaining",
    unlimited: "Unlimited",
    usageUnavailable: "Usage is temporarily unavailable",
    openRouterModel: "Model",
    openRouterTaskModels: "Task-specific models",
    openRouterTaskModelsDescription:
      "Optional overrides for AI tasks. Leave blank to use the default model above.",
    openRouterTagModel: "Tags",
    openRouterWritingModel: "Writing fixes",
    openRouterChatModel: "Entry chat",
    openRouterToneModel: "Tone analysis",
    openRouterSummaryModel: "Entry summaries",
    openRouterPromptModel: "Get Inspired",
    openRouterBookModel: "Book weaving",
    inheritDefaultModel: "Use default model",
    searchModels: "Search models...",
    noModelsFound: "No models found",
    loadingModels: "Loading models...",
    autoTagMaxTags: "Automatic Tag Limit",
  },
  fr: {
    aiConfiguration: "Configuration IA",
    openRouterApiKey: "Clé API OpenRouter",
    personalKeyActive: "Clé personnelle active",
    serverKeyActive: "Clé du serveur utilisée",
    aiUnavailable: "Aucune clé API disponible",
    openRouterKeyPlaceholder: "sk-or-v1-...",
    saveApiKey: "Enregistrer la clé",
    replaceApiKey: "Remplacer la clé",
    removeApiKey: "Supprimer la clé",
    showApiKey: "Afficher la clé API",
    hideApiKey: "Masquer la clé API",
    apiKeySaved: "Clé API enregistrée",
    apiKeyRemoved: "Clé API supprimée",
    apiKeySaveError: "Impossible d'enregistrer la clé API",
    apiKeyRemoveError: "Impossible de supprimer la clé API",
    createOpenRouterKey: "Clés OpenRouter",
    usageDashboard: "Tableau d'utilisation",
    refreshUsage: "Actualiser l'utilisation",
    thoughtyUsagePeriod: "Activité Thoughty des {days} derniers jours",
    totalTokens: "Total de tokens",
    promptTokens: "Tokens d'entrée",
    completionTokens: "Tokens de réponse",
    reasoningTokens: "Tokens de raisonnement",
    requests: "Requêtes",
    thoughtyCost: "Coût Thoughty",
    openRouterKeyUsage: "Utilisation de la clé OpenRouter",
    allTimeCost: "Dépenses totales",
    monthlyCost: "Ce mois-ci",
    dailyCost: "Aujourd'hui",
    remainingLimit: "Limite restante",
    unlimited: "Illimitée",
    usageUnavailable: "L'utilisation est temporairement indisponible",
    openRouterModel: "Modèle",
    openRouterTaskModels: "Modèles par tâche",
    openRouterTaskModelsDescription:
      "Remplacements facultatifs pour les tâches IA. Laissez vide pour utiliser le modèle par défaut ci-dessus.",
    openRouterTagModel: "Tags",
    openRouterWritingModel: "Corrections d'écriture",
    openRouterChatModel: "Chat d'entrée",
    openRouterToneModel: "Analyse du ton",
    openRouterSummaryModel: "Résumés d'entrées",
    openRouterPromptModel: "S'inspirer",
    openRouterBookModel: "Tissage du livre",
    inheritDefaultModel: "Utiliser le modèle par défaut",
    searchModels: "Rechercher des modèles...",
    noModelsFound: "Aucun modèle trouvé",
    loadingModels: "Chargement des modèles...",
    autoTagMaxTags: "Limite de tags automatiques",
  },
};
