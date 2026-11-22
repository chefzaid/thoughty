import { inlineImageMarkdown } from '@/common/utils';
import type { MemoirLanguage } from './memoir-questions';

/** The question a photo prompt asks, the heading of its story as a memoir answer's question is. */
export const MEMOIR_PHOTO_QUESTION: Readonly<Record<MemoirLanguage, string>> = {
  en: 'What is happening here?',
  fr: 'Que se passe-t-il ici ?',
};

/** The tag, and so the book chapter, of a photo story given no life chapter. */
export const MEMOIR_PHOTO_TAG: Readonly<Record<MemoirLanguage, string>> = {
  en: 'Photos',
  fr: 'Photos',
};

/** A photo story: the question as a heading, then the photo where it stands, then the writer's story. */
export function composePhotoAnswerContent(
  language: MemoirLanguage,
  attachmentId: number,
  caption: string,
  story: string,
): string {
  return `### ${MEMOIR_PHOTO_QUESTION[language]}\n\n${inlineImageMarkdown(attachmentId, caption)}\n\n${story}`;
}
