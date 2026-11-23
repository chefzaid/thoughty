import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { createAiService } from '../services/api/aiService';
import { isDiaryAiModeRefusal } from '../utils/diaryAi';
import { confirmAiRequest, consentDetails, type AiRequestDiary } from '../components/DiaryAi/aiConsent';

type AiTagService = Pick<ReturnType<typeof createAiService>, 'suggestTags'>;

const ANY_DIARY: AiRequestDiary = { mode: 'on' };

export const useEntryTagSuggestions = (
  aiService: AiTagService,
  content: string,
  tags: string[],
  setTags: Dispatch<SetStateAction<string[]>>,
  maxTags: number,
  setFormError: Dispatch<SetStateAction<string>>,
  /** The diary the text is written in, which the server checks for AI off, and asks consent for when it asks each time. */
  diary: AiRequestDiary = ANY_DIARY,
) => {
  const [suggestingTags, setSuggestingTags] = useState(false);
  const { diaryId, mode, requestConsent, onModeRefused } = diary;

  const handleSuggestTags = useCallback(async () => {
    if (!content.trim()) {
      setFormError('suggestTagsNeedsText');
      return false;
    }

    setFormError('');
    const consent = await confirmAiRequest(mode, requestConsent, {
      text: content,
      details: consentDetails([{ label: 'aiConsentTags', value: tags.join(', ') }]),
      task: 'tag',
    });
    if (!consent.send) return false;

    setSuggestingTags(true);
    const { data: suggestedTags, refusal } = await aiService.suggestTags(content, tags, maxTags || 5, diaryId, consent.aiConsent);
    setSuggestingTags(false);

    if (suggestedTags === null) {
      setFormError(refusal ?? 'suggestTagsFailed');
      if (isDiaryAiModeRefusal(refusal)) onModeRefused?.();
      return false;
    }
    if (suggestedTags.length === 0) {
      setFormError('suggestTagsEmpty');
      return false;
    }

    setTags((current) => [...new Set([...current, ...suggestedTags])]);
    return true;
  }, [aiService, content, diaryId, maxTags, mode, onModeRefused, requestConsent, setFormError, setTags, tags]);

  return {
    suggestingTags,
    handleSuggestTags,
  };
};
