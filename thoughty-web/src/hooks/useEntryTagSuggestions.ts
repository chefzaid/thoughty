import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { createAiService } from '../services/api/aiService';
import { isDiaryAiOffRefusal } from '../utils/diaryAi';

type AiTagService = Pick<ReturnType<typeof createAiService>, 'suggestTags'>;

export const useEntryTagSuggestions = (
  aiService: AiTagService,
  content: string,
  tags: string[],
  setTags: Dispatch<SetStateAction<string[]>>,
  maxTags: number,
  setFormError: Dispatch<SetStateAction<string>>,
  /** The diary the text is written in, which the server checks for AI off. */
  diaryId?: number,
  /** Hears that the server refused the diary for AI off, so the diaries are loaded again. */
  onDiaryAiOff?: () => void,
) => {
  const [suggestingTags, setSuggestingTags] = useState(false);

  const handleSuggestTags = useCallback(async () => {
    if (!content.trim()) {
      setFormError('suggestTagsNeedsText');
      return false;
    }

    setFormError('');
    setSuggestingTags(true);
    const { data: suggestedTags, refusal } = await aiService.suggestTags(content, tags, maxTags || 5, diaryId);
    setSuggestingTags(false);

    if (suggestedTags === null) {
      setFormError(refusal ?? 'suggestTagsFailed');
      if (isDiaryAiOffRefusal(refusal)) onDiaryAiOff?.();
      return false;
    }
    if (suggestedTags.length === 0) {
      setFormError('suggestTagsEmpty');
      return false;
    }

    setTags((current) => [...new Set([...current, ...suggestedTags])]);
    return true;
  }, [aiService, content, diaryId, maxTags, onDiaryAiOff, setFormError, setTags, tags]);

  return {
    suggestingTags,
    handleSuggestTags,
  };
};
