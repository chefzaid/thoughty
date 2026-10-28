import { createContext } from 'react';
import type { Attachment, TranslationFunction } from '../../types';

/** A file an entry's text can place: the journal knows its storage key, a share link only its ID. */
export type InlineImageAttachment = Pick<Attachment, 'id' | 'original_filename' | 'mimetype' | 'size'>
    & Partial<Pick<Attachment, 'stored_filename'>>;

/** What the journal knows to show an entry's inline images: its attachments, the theme and the words. */
export interface InlineImageScope {
    readonly attachments: readonly InlineImageAttachment[];
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
    /**
     * Where a private share link serves the entry's files, by attachment ID. Without it, as in the
     * journal, they are loaded with the writer's session.
     */
    readonly fileUrlOf?: (attachmentId: number) => string;
}

/**
 * Set around an entry's text in the journal and on a private share link's page. Without it (the
 * public feed, highlights, previews), inline images show their alt text only: attachments are private.
 */
export const InlineImageContext = createContext<InlineImageScope | null>(null);
