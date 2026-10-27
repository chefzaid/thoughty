import { createContext } from 'react';
import type { Attachment, TranslationFunction } from '../../types';

/** What the journal knows to show an entry's inline images: its attachments, the theme and the words. */
export interface InlineImageScope {
    readonly attachments: readonly Attachment[];
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

/**
 * Set around an entry's text in the journal. Without it (the public feed, highlights, previews),
 * inline images show their alt text only: attachments are private.
 */
export const InlineImageContext = createContext<InlineImageScope | null>(null);
