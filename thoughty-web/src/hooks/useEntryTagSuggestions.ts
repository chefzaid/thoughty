import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { createAiService } from '../services/api/aiService';

type AiTagService = Pick<ReturnType<typeof createAiService>, 'suggestTags'>;

export const useEntryTagSuggestions = (
  aiService: AiTagService,
  content: string,
  tags: string[],
  setTags: Dispatch<SetStateAction<string[]>>,
  maxTags: number,
  setFormError: Dispatch<SetStateAction<string>>,
) => {
  const [suggestingTags, setSuggestingTags] = useState(false);

  const handleSuggestTags = useCallback(async () => {
    if (!content.trim()) {
      setFormError('suggestTagsNeedsText');
      return false;
    }

    setFormError('');
    setSuggestingTags(true);
    const suggestedTags = await aiService.suggestTags(content, tags, maxTags || 5);
    setSuggestingTags(false);

    if (suggestedTags === null) {
      setFormError('suggestTagsFailed');
      return false;
    }
    if (suggestedTags.length === 0) {
      setFormError('suggestTagsEmpty');
      return false;
    }

    setTags((current) => [...new Set([...current, ...suggestedTags])]);
    return true;
  }, [aiService, content, maxTags, setFormError, setTags, tags]);

  return {
    suggestingTags,
    handleSuggestTags,
  };
};
