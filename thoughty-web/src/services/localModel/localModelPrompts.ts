import type { RephraseMode, SummaryGuidance } from '../api/aiTypes';
import { LOCAL_MODEL_PROMPTS } from '../../generated/localModelPrompts';
import type { LocalModelMessage } from './localModelClient';

/**
 * The messages the AI actions on one text of a diary on the writer's own model send from this browser. Their
 * instructions are the server's own (`generated/localModelPrompts.ts`, written from thoughty-server by
 * `npm run api:sync`); how each request is put together follows the server's code for the same action
 * (thoughty-server/src/modules/ai: `ai.service.ts`, `tag-suggestions.ts`, `entry-summary.ts`, `untrusted-content.ts`),
 * kept in step by hand.
 */

/** Encloses writer text in a `<tag>` block, escaping any tag of that name inside it so it cannot close the block. */
export function untrustedBlock(tag: string, content: string): string {
  const escaped = content.replaceAll(new RegExp(`<(/?)(${tag})(?=[\\s/>]|$)`, 'gi'), '&lt;$1$2');
  return `<${tag}>\n${escaped}\n</${tag}>`;
}

/** Drops the `<tag>` block a model sometimes echoes around an answer that should be bare text. */
export function unwrapBlock(tag: string, output: string): string {
  const match = new RegExp(`^<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>$`, 'i').exec(output.trim());
  return match?.[1] ?? output;
}

/** The JSON of an answer opening with `opening`, which a model may wrap in prose, or undefined when it has none. */
export function jsonCandidate(raw: string, opening: '{' | '['): string | undefined {
  const content = raw.trim();
  if (content.startsWith(opening)) return content;
  const start = content.indexOf(opening);
  const end = content.lastIndexOf(opening === '{' ? '}' : ']');
  return start >= 0 && end > start ? content.slice(start, end + 1) : undefined;
}

export function rephraseMessages(content: string, mode: RephraseMode): LocalModelMessage[] {
  return [
    { role: 'system', content: LOCAL_MODEL_PROMPTS.fixWriting[mode] },
    { role: 'user', content: untrustedBlock('text', content) },
  ];
}

export function tagMessages(content: string, existingTags: readonly string[], maxTags: number): LocalModelMessage[] {
  return [
    { role: 'system', content: LOCAL_MODEL_PROMPTS.tagSuggestions },
    { role: 'user', content: JSON.stringify({ maxTags, existingTags, entry: content }) },
  ];
}

/** The new tags of a tagging answer, as the server reads them: lowercase, hyphenated, none the entry has, at most `maxTags`. */
export function parseTagAnswer(raw: string, existingTags: readonly string[], maxTags: number): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate(raw, '[') ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const existing = new Set(existingTags.map((tag) => tag.toLowerCase()));
  const tags = parsed
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().replace(/^#+/, '').toLowerCase().replaceAll(/\s+/g, '-'))
    .filter((tag) => tag && !existing.has(tag));
  return [...new Set(tags)].slice(0, maxTags);
}

export function summaryMessages(content: string, guidance: SummaryGuidance): LocalModelMessage[] {
  return [
    { role: 'system', content: LOCAL_MODEL_PROMPTS.entrySummary },
    {
      role: 'user',
      content: JSON.stringify({
        includeDetails: guidance.includeDetails?.trim() || null,
        excludeDetails: guidance.excludeDetails?.trim() || null,
        entry: content,
      }),
    },
  ];
}

/** An entry chat: the entry in the system message, then the conversation, the writer's newest message last. */
export function chatMessages(entryContent: string, messages: readonly LocalModelMessage[]): LocalModelMessage[] {
  return [
    { role: 'system', content: [LOCAL_MODEL_PROMPTS.entryChat, '', untrustedBlock('journal_entry', entryContent)].join('\n') },
    ...messages.map(({ role, content }) => ({ role, content })),
  ];
}
