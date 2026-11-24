import { extractJsonCandidate } from '@/common/utils/json-content.util';
import { UNTRUSTED_CONTENT_INSTRUCTION, untrustedBlock } from './untrusted-content';
import { CLINICAL_TERMS } from './year-mood-analysis';

/** At most this many follow-up questions are offered at once. */
export const MAX_MEMOIR_FOLLOW_UPS = 3;
/** Each follow-up question is kept up to this many characters. */
export const MAX_MEMOIR_FOLLOW_UP_LENGTH = 200;
/** An answer is read up to this many characters: its opening and, past that, its most recent part. */
export const MAX_MEMOIR_FOLLOW_UP_ANSWER_LENGTH = 12_000;
/** How much of the opening of a long answer the model reads, before its most recent part. */
export const MEMOIR_FOLLOW_UP_ANSWER_OPENING_LENGTH = 4000;

export interface MemoirFollowUpRequest {
  /** The memoir question, in the writer's language. */
  readonly question: string;
  /** The answer written so far. */
  readonly answer: string;
  /** Follow-ups already offered for this answer, not to be asked again. */
  readonly asked: readonly string[];
}

/** The rules of book weaving: nothing that is not in the writer's words. */
export const MEMOIR_FOLLOW_UPS_INSTRUCTIONS = [
  'You help a person write their memoir by asking follow-up questions about their answer to a memoir question, like a warm, careful interviewer.',
  'Return only JSON shaped as {"questions":["..."]} with up to three questions, the most fruitful first.',
  'Each question picks one person, place, moment, object or feeling the writer named in the answer and invites them to tell more about it:',
  'what it looked, sounded or smelled like, what happened before or after, who else was there, what it meant to them then or means now.',
  'Stay strictly grounded in the answer: never assume, invent or introduce a fact, name, event, place, relationship, date or feeling that the answer does not contain,',
  'never put words in the writer\'s mouth, and ask nothing the answer already tells.',
  'Each question is open, under 25 words, asks one thing, gives no advice or judgement, does not diagnose or act as a therapist, and uses no markdown.',
  'Address the writer as "you" and write in the language of the answer.',
  'Do not repeat or rephrase any question in the <already_asked> block.',
  'When the answer is too short or too vague to ground a question, return {"questions":[]}.',
  'The memoir question is the <memoir_question> block and the answer is the <memoir_answer> block.',
  UNTRUSTED_CONTENT_INSTRUCTION,
].join(' ');

/** The answer as the model reads it: whole when it fits, else its opening and its most recent part. */
function readableAnswer(answer: string): string {
  const text = answer.trim();
  if (text.length <= MAX_MEMOIR_FOLLOW_UP_ANSWER_LENGTH) {
    return text;
  }
  const recent = MAX_MEMOIR_FOLLOW_UP_ANSWER_LENGTH - MEMOIR_FOLLOW_UP_ANSWER_OPENING_LENGTH;
  return `${text.slice(0, MEMOIR_FOLLOW_UP_ANSWER_OPENING_LENGTH).trimEnd()}\n…\n${text.slice(-recent).trimStart()}`;
}

export function buildMemoirFollowUpsPrompt({ question, answer, asked }: MemoirFollowUpRequest): string {
  return [
    untrustedBlock('memoir_question', question),
    untrustedBlock('memoir_answer', readableAnswer(answer)),
    untrustedBlock('already_asked', asked.map((item) => `- ${item}`).join('\n')),
  ].join('\n');
}

/** A question on one line, without the emphasis and code marks that would break the bold it is added in. */
const oneLine = (value: unknown): string =>
  typeof value === 'string'
    ? value.replaceAll(/[*`]/g, '').replaceAll(/\s+/g, ' ').trim().slice(0, MAX_MEMOIR_FOLLOW_UP_LENGTH).trim()
    : '';

const sameQuestion = (value: string) => value.toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The follow-up questions of an answer, each on one line and cut to its limit, at most three: questions already
 * asked, repeated ones and any that reads as a diagnosis are left out. Null when the answer is not the JSON asked for.
 */
export function parseMemoirFollowUps(rawContent: string, asked: readonly string[]): string[] | null {
  const candidate = extractJsonCandidate(rawContent, '{');
  if (!candidate) {
    return null;
  }
  try {
    const parsed = JSON.parse(candidate) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) {
      return null;
    }
    const seen = new Set(asked.map(sameQuestion));
    const questions: string[] = [];
    for (const item of parsed.questions) {
      const question = oneLine(item);
      const key = sameQuestion(question);
      if (key && !seen.has(key) && !CLINICAL_TERMS.test(question)) {
        seen.add(key);
        questions.push(question);
      }
    }
    return questions.slice(0, MAX_MEMOIR_FOLLOW_UPS);
  } catch {
    return null;
  }
}
