import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { createAiService, TagSuggestionStyle } from '../services/api/aiService';

type AiTagService = Pick<ReturnType<typeof createAiService>, 'suggestTags'>;

export const useEntryTagSuggestions = (
  aiService: AiTagService,
  content: string,
  tags: string[],
  setTags: Dispatch<SetStateAction<string[]>>,
  maxTags: number,
  setFormError: Dispatch<SetStateAction<string>>,
) => {
  const [suggestingTagStyle, setSuggestingTagStyle] = useState<TagSuggestionStyle | null>(null);

  const handleSuggestTags = useCallback(async (style?: TagSuggestionStyle) => {
    if (!content.trim()) {
      setFormError('Write a thought before asking for tag suggestions');
      return false;
    }

    setFormError('');
    setSuggestingTagStyle(style ?? 'specific');
    const suggestedTags = await aiService.suggestTags(content, tags, maxTags || 5, style);
    setSuggestingTagStyle(null);

    if (suggestedTags === null) {
      setFormError('Unable to suggest tags. Check your OpenRouter API key and try again.');
      return false;
    }
    if (suggestedTags.length === 0) {
      setFormError('No tag suggestions were returned. Try adding more detail.');
      return false;
    }

    setTags((current) => [...new Set([...current, ...suggestedTags])]);
    return true;
  }, [aiService, content, maxTags, setFormError, setTags, tags]);

  return {
    suggestingTags: suggestingTagStyle !== null,
    suggestingTagStyle,
    handleSuggestTags,
  };
};
