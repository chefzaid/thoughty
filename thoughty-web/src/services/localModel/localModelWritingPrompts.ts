import { LOCAL_MODEL_PROMPTS } from '../../generated/localModelPrompts';
import type { LocalModelMessage } from './localModelClient';
import { jsonCandidate, untrustedBlock } from './localModelPrompts';

/**
 * The messages of the prompts a diary on the writer's own model asks for while writing, sent from this browser:
 * Get Inspired's question and the memoir's follow-up questions. Their instructions and limits are the server's
 * (`generated/localModelPrompts.ts`); how each request is put together and read follows thoughty-server's
 * `src/modules/ai/inspiration.ts` and `memoir-follow-ups.ts`, kept in step by hand.
 */

const INSPIRATION = LOCAL_MODEL_PROMPTS.inspirationLimits;
const FOLLOW_UPS = LOCAL_MODEL_PROMPTS.memoirFollowUpLimits;
const CLINICAL_TERMS = new RegExp(LOCAL_MODEL_PROMPTS.clinicalTerms.source, LOCAL_MODEL_PROMPTS.clinicalTerms.flags);

export interface InspirationTheme {
  readonly tag: string;
  readonly count: number;
}

/** The tags most used across entries (newest first) and those of the most recent entries, as Get Inspired sends them. */
export function summarizeThemes(entryTags: readonly (readonly string[])[]): { themes: InspirationTheme[]; recentThemes: string[] } {
  const counts = new Map<string, number>();
  for (const tags of entryTags.slice(0, INSPIRATION.taggedEntries)) {
    for (const tag of new Set(tags.map((value) => value.trim()).filter(Boolean))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const themes = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, INSPIRATION.themes);
  const recentThemes = [...new Set(entryTags.slice(0, INSPIRATION.recentEntries).flat().map((value) => value.trim()).filter(Boolean))]
    .slice(0, INSPIRATION.recentThemes);
  return { themes, recentThemes };
}

/** How many entries, newest first, Get Inspired reads the tags of. */
export const INSPIRATION_ENTRY_WINDOW = INSPIRATION.taggedEntries;

export function inspirationMessages(themes: readonly InspirationTheme[], recentThemes: readonly string[]): LocalModelMessage[] {
  return [
    { role: 'system', content: LOCAL_MODEL_PROMPTS.inspiration },
    { role: 'user', content: JSON.stringify({ themes, recentThemes }) },
  ];
}

/** The question of an answer, without the fences and quotes a model may put around it. */
export function parseInspiration(raw: string): string {
  return raw
    .trim()
    .replace(/^```\w*\s*|\s*```$/g, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
    .slice(0, INSPIRATION.questionLength);
}

export interface FollowUpRequest {
  readonly question: string;
  readonly answer: string;
  readonly asked: readonly string[];
}

/** The answer as the model reads it: whole when it fits, else its opening and its most recent part. */
function readableAnswer(answer: string): string {
  const text = answer.trim();
  if (text.length <= FOLLOW_UPS.answerLength) return text;
  const recent = FOLLOW_UPS.answerLength - FOLLOW_UPS.answerOpeningLength;
  return `${text.slice(0, FOLLOW_UPS.answerOpeningLength).trimEnd()}\n…\n${text.slice(-recent).trimStart()}`;
}

export function followUpMessages({ question, answer, asked }: FollowUpRequest): LocalModelMessage[] {
  return [
    { role: 'system', content: LOCAL_MODEL_PROMPTS.memoirFollowUps },
    {
      role: 'user',
      content: [
        untrustedBlock('memoir_question', question),
        untrustedBlock('memoir_answer', readableAnswer(answer)),
        untrustedBlock('already_asked', asked.map((item) => `- ${item}`).join('\n')),
      ].join('\n'),
    },
  ];
}

/** A question on one line, without the emphasis and code marks that would break the bold it is added in. */
const oneLine = (value: unknown): string => (typeof value === 'string'
  ? value.replaceAll(/[*`]/g, '').replaceAll(/\s+/g, ' ').trim().slice(0, FOLLOW_UPS.questionLength).trim()
  : '');

const sameQuestion = (value: string) => value.toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The follow-up questions of an answer, as the server reads them: each on one line, none already asked, repeated
 * or reading as a diagnosis, at most three. Null when the answer is not the JSON asked for.
 */
export function parseFollowUps(raw: string, asked: readonly string[]): string[] | null {
  const candidate = jsonCandidate(raw, '{');
  if (!candidate) return null;
  let parsed: { questions?: unknown };
  try {
    parsed = JSON.parse(candidate) as { questions?: unknown };
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.questions)) return null;
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
  return questions.slice(0, FOLLOW_UPS.questions);
}
