import type { Language } from './translations';

/** The AI writing helpers (tags, rephrasing, summaries, inspiration, chat) and duplicate review. */
export type AiWritingTranslationKey =
  | "suggestTags"
  | "suggestingTags"
  | "autoTagDescription"
  | "fixWriting"
  | "fixingWriting"
  | "discussEntry"
  | "rephraseEntry"
  | "rephrasingEntry"
  | "rephraseGrammarOnly"
  | "rephraseStyleLight"
  | "rephraseCompleteRewrite"
  | "summarizeEntry"
  | "entrySummary"
  | "summaryIncludeDetails"
  | "summaryIncludeDetailsPlaceholder"
  | "summaryExcludeDetails"
  | "summaryExcludeDetailsPlaceholder"
  | "generateSummary"
  | "regenerateSummary"
  | "generatingSummary"
  | "summaryError"
  | "copySummary"
  | "summaryCopied"
  | "getInspired"
  | "getInspiredDescription"
  | "inspirationTitle"
  | "findingInspiration"
  | "askAnotherQuestion"
  | "writeAboutThis"
  | "inspirationError"
  | "findDuplicates"
  | "duplicateScanTitle"
  | "duplicateScanDescription"
  | "scanningDuplicates"
  | "duplicateScanError"
  | "noDuplicatesFound"
  | "duplicateScanCount_one"
  | "duplicateScanCount_other"
  | "duplicateScanLimited"
  | "duplicateConfidence"
  | "openDuplicateEntry"
  | "deleteDuplicateEntry"
  | "aiChat"
  | "aiThinking"
  | "aiLoadingHistory"
  | "aiChatPlaceholder"
  | "aiChatError"
  | "exportChatHistory";

export const aiWritingTranslations: Record<Language, Record<AiWritingTranslationKey, string>> = {
  en: {
    suggestTags: "Auto Tag",
    suggestingTags: "Tagging...",
    autoTagDescription: "Suggest tags for what this entry is about and what it means",
    fixWriting: "Rephrase",
    fixingWriting: "Rephrasing...",
    discussEntry: "Discuss with AI",
    rephraseEntry: "Rephrase entry",
    rephrasingEntry: "Rephrasing entry...",
    rephraseGrammarOnly: "Grammar/form only",
    rephraseStyleLight: "Slight style improvements",
    rephraseCompleteRewrite: "Complete rewrite",
    summarizeEntry: "Summarize entry",
    entrySummary: "Entry summary",
    summaryIncludeDetails: "Emphasize",
    summaryIncludeDetailsPlaceholder: "Optional details or topics to highlight",
    summaryExcludeDetails: "Leave out",
    summaryExcludeDetailsPlaceholder: "Optional details or topics to omit",
    generateSummary: "Generate summary",
    regenerateSummary: "Regenerate",
    generatingSummary: "Generating...",
    summaryError:
      "Unable to summarize this entry. Check your OpenRouter API key and try again.",
    copySummary: "Copy summary",
    summaryCopied: "Summary copied",
    getInspired: "Get Inspired",
    getInspiredDescription: "Get a reflective question based on your tags",
    inspirationTitle: "A question for you",
    findingInspiration: "Finding a question...",
    askAnotherQuestion: "Ask another question",
    writeAboutThis: "Write about this",
    inspirationError:
      "Inspiration needs a few tagged entries and a configured OpenRouter API key.",
    findDuplicates: "Find duplicates",
    duplicateScanTitle: "Similar entries",
    duplicateScanDescription:
      "Review high-confidence matches before deciding whether to remove an entry.",
    scanningDuplicates: "Comparing recent entries...",
    duplicateScanError:
      "Unable to compare entries. Check your OpenRouter API key and try again.",
    noDuplicatesFound: "No high-confidence duplicates were found.",
    duplicateScanCount_one: "Analyzed {analyzed} of {count} entry.",
    duplicateScanCount_other: "Analyzed {analyzed} of {count} entries.",
    duplicateScanLimited:
      "Only the 40 newest entries were analyzed. Select a diary to narrow the scan.",
    duplicateConfidence: "{confidence}% confidence",
    openDuplicateEntry: "Open entry",
    deleteDuplicateEntry: "Delete duplicate entry",
    aiChat: "AI Chat",
    aiThinking: "Thinking...",
    aiLoadingHistory: "Loading chat history...",
    aiChatPlaceholder: "Ask something about this entry...",
    aiChatError:
      "Unable to get a response. Check your OpenRouter API key and try again.",
    exportChatHistory: "Export Chat",
  },
  fr: {
    suggestTags: "Auto Tag",
    suggestingTags: "Tagging...",
    autoTagDescription: "Suggérer des tags sur le sujet de cette entrée et ce qu'elle signifie",
    fixWriting: "Reformuler",
    fixingWriting: "Reformulation...",
    discussEntry: "Discuter avec l'IA",
    rephraseEntry: "Reformuler l'entrée",
    rephrasingEntry: "Reformulation en cours...",
    rephraseGrammarOnly: "Grammaire et forme seulement",
    rephraseStyleLight: "Légères améliorations de style",
    rephraseCompleteRewrite: "Réécriture complète",
    summarizeEntry: "Résumer l'entrée",
    entrySummary: "Résumé de l'entrée",
    summaryIncludeDetails: "Mettre en avant",
    summaryIncludeDetailsPlaceholder:
      "Détails ou sujets facultatifs à souligner",
    summaryExcludeDetails: "Exclure",
    summaryExcludeDetailsPlaceholder: "Détails ou sujets facultatifs à omettre",
    generateSummary: "Générer le résumé",
    regenerateSummary: "Regénérer",
    generatingSummary: "Génération...",
    summaryError:
      "Impossible de résumer cette entrée. Vérifiez votre clé API OpenRouter et réessayez.",
    copySummary: "Copier le résumé",
    summaryCopied: "Résumé copié",
    getInspired: "S'inspirer",
    getInspiredDescription: "Recevoir une question de réflexion basée sur vos tags",
    inspirationTitle: "Une question pour vous",
    findingInspiration: "Recherche d'une question...",
    askAnotherQuestion: "Poser une autre question",
    writeAboutThis: "Écrire à ce sujet",
    inspirationError:
      "L'inspiration nécessite quelques entrées taguées et une clé API OpenRouter configurée.",
    findDuplicates: "Rechercher les doublons",
    duplicateScanTitle: "Entrées similaires",
    duplicateScanDescription:
      "Examinez les correspondances fiables avant de supprimer une entrée.",
    scanningDuplicates: "Comparaison des entrées récentes...",
    duplicateScanError:
      "Impossible de comparer les entrées. Vérifiez votre clé API OpenRouter et réessayez.",
    noDuplicatesFound: "Aucun doublon suffisamment fiable n’a été trouvé.",
    duplicateScanCount_one: "{analyzed} sur {count} entrée analysée.",
    duplicateScanCount_other: "{analyzed} sur {count} entrées analysées.",
    duplicateScanLimited:
      "Seules les 40 entrées les plus récentes ont été analysées. Sélectionnez un journal pour affiner la recherche.",
    duplicateConfidence: "Confiance : {confidence} %",
    openDuplicateEntry: "Ouvrir l’entrée",
    deleteDuplicateEntry: "Supprimer l’entrée en double",
    aiChat: "Chat IA",
    aiThinking: "Réflexion...",
    aiLoadingHistory: "Chargement de l'historique du chat...",
    aiChatPlaceholder: "Posez une question sur cette entrée...",
    aiChatError:
      "Impossible d'obtenir une réponse. Vérifiez votre clé API OpenRouter et réessayez.",
    exportChatHistory: "Exporter le chat",
  },
};
