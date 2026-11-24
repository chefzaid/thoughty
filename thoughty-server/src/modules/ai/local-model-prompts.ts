import { INSPIRATION_LIMITS } from './inspiration';
import {
  MAX_MEMOIR_FOLLOW_UP_ANSWER_LENGTH,
  MAX_MEMOIR_FOLLOW_UP_LENGTH,
  MAX_MEMOIR_FOLLOW_UPS,
  MEMOIR_FOLLOW_UP_ANSWER_OPENING_LENGTH,
  MEMOIR_FOLLOW_UPS_INSTRUCTIONS,
} from './memoir-follow-ups';
import {
  ENTRY_CHAT_INSTRUCTION,
  ENTRY_SUMMARY_INSTRUCTION,
  FIX_WRITING_INSTRUCTIONS,
  INSPIRATION_INSTRUCTION,
  TAG_SUGGESTIONS_INSTRUCTION,
} from './prompt-instructions';
import { CLINICAL_TERMS } from './year-mood-analysis';

/**
 * The prompts and limits of the AI actions a diary on the writer's own model runs from the browser, which sends
 * them straight to that model: the same as this server's, so those diaries get the same answers. Written into the
 * web app as `thoughty-web/src/generated/localModelPrompts.ts` by `npm run prompts:export` (part of the root
 * `npm run api:sync`); `local-model-prompts.spec.ts` fails while that file differs.
 */
export const LOCAL_MODEL_PROMPTS = {
  fixWriting: FIX_WRITING_INSTRUCTIONS,
  tagSuggestions: TAG_SUGGESTIONS_INSTRUCTION,
  entrySummary: ENTRY_SUMMARY_INSTRUCTION,
  entryChat: ENTRY_CHAT_INSTRUCTION,
  inspiration: INSPIRATION_INSTRUCTION,
  inspirationLimits: INSPIRATION_LIMITS,
  memoirFollowUps: MEMOIR_FOLLOW_UPS_INSTRUCTIONS,
  memoirFollowUpLimits: {
    questions: MAX_MEMOIR_FOLLOW_UPS,
    questionLength: MAX_MEMOIR_FOLLOW_UP_LENGTH,
    answerLength: MAX_MEMOIR_FOLLOW_UP_ANSWER_LENGTH,
    answerOpeningLength: MEMOIR_FOLLOW_UP_ANSWER_OPENING_LENGTH,
  },
  /** The words that make a follow-up read as a diagnosis, which is then left out (a `RegExp`'s source and flags). */
  clinicalTerms: { source: CLINICAL_TERMS.source, flags: CLINICAL_TERMS.flags },
};

/** Where `npm run prompts:export` writes the prompts, from this server's folder. */
export const LOCAL_MODEL_PROMPTS_WEB_PATH = '../thoughty-web/src/generated/localModelPrompts.ts';

/** The web app's module of the prompts, as `npm run prompts:export` writes it. */
export function renderLocalModelPromptsModule(): string {
  return [
    '// Written by `npm run prompts:export` in thoughty-server from its prompts',
    '// (src/modules/ai/local-model-prompts.ts); never edit it by hand.',
    `export const LOCAL_MODEL_PROMPTS = ${JSON.stringify(LOCAL_MODEL_PROMPTS, null, 2)} as const;`,
    '',
  ].join('\n');
}
