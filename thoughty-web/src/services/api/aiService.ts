import { createAiAccountService } from "./aiAccountService";
import { createAiJournalService } from "./aiJournalService";
import type { AiAuthFetch } from "./aiTypes";
import { createAiWritingService } from "./aiWritingService";

export * from "./aiTypes";

export const createAiService = (authFetch: AiAuthFetch) => {
  const writing = createAiWritingService(authFetch);
  const journal = createAiJournalService(authFetch);
  const account = createAiAccountService(authFetch);

  return {
    suggestTags: writing.suggestTags,
    fixWriting: writing.fixWriting,
    summarizeEntry: writing.summarizeEntry,
    getInspiration: writing.getInspiration,
    findDuplicateEntries: journal.findDuplicateEntries,
    semanticSearch: journal.semanticSearch,
    chat: writing.chat,
    getChatHistory: writing.getChatHistory,
    fetchModels: account.fetchModels,
    getCredentialStatus: account.getCredentialStatus,
    updateCredential: account.updateCredential,
    removeCredential: account.removeCredential,
    getUsageDashboard: account.getUsageDashboard,
    previewJournalRetag: journal.previewJournalRetag,
    applyJournalRetag: journal.applyJournalRetag,
  };
};
