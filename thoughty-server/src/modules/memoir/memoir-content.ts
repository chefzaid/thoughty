import { replaceInlineImages } from '@/common/utils';

/** An answer entry opens with its question as a heading so the memoir reads on its own and in books. */
export function composeAnswerContent(question: string, answer: string): string {
  return answer ? `### ${question}\n\n${answer}` : `### ${question}`;
}

/** Words of an answer entry, leaving out the question heading it starts with and the photos it places. */
export function countAnswerWords(content: string): number {
  const body = replaceInlineImages(content.replace(/^#{1,6} [^\n]*(\n|$)/, ''), () => ' ').trim();
  return body ? body.split(/\s+/).length : 0;
}
