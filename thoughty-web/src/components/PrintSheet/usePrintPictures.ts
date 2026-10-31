import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Entry } from '../../types';
import { getAttachmentUrl, isImageAttachment, isVideoAttachment } from '../../utils/attachments';

export interface PrintPictures {
    /** Each loaded picture or video frame, by its stored file name, as a local URL. */
    readonly urls: ReadonlyMap<string, string>;
    /** True once every picture has loaded or failed to. */
    readonly ready: boolean;
}

/** The stored files a print shows as pictures: the entries' images and their videos' poster frames. */
export function printedPictureFiles(entries: readonly Entry[]): string[] {
    const files = entries.flatMap((entry) => (entry.attachments ?? []).flatMap((attachment) => {
        if (isImageAttachment(attachment.mimetype)) return [attachment.stored_filename];
        if (isVideoAttachment(attachment.mimetype) && attachment.poster_filename) return [attachment.poster_filename];
        return [];
    }));
    return [...new Set(files)];
}

const NONE: ReadonlyMap<string, string> = new Map();

/**
 * Fetches the pictures of the printed entries with the session, all at once (a print cannot wait for
 * them to come into view), and frees them when the print view goes away. A picture that cannot be
 * loaded is left out rather than holding up the print.
 */
export function usePrintPictures(entries: readonly Entry[]): PrintPictures {
    const { authFetch } = useAuth();
    const filesKey = printedPictureFiles(entries).join('\n');
    const files = useMemo(() => (filesKey ? filesKey.split('\n') : []), [filesKey]);
    const [pictures, setPictures] = useState<PrintPictures>({ urls: NONE, ready: false });

    useEffect(() => {
        let active = true;
        const created: string[] = [];
        setPictures({ urls: NONE, ready: false });

        void Promise.all(files.map(async (file): Promise<[string, string] | null> => {
            try {
                const response = await authFetch(getAttachmentUrl(file));
                if (!response.ok) return null;
                const url = URL.createObjectURL(await response.blob());
                if (!active) {
                    URL.revokeObjectURL(url);
                    return null;
                }
                created.push(url);
                return [file, url];
            } catch {
                return null;
            }
        })).then((loaded) => {
            if (active) {
                setPictures({ urls: new Map(loaded.filter((pair) => pair !== null)), ready: true });
            }
        });

        return () => {
            active = false;
            for (const url of created) URL.revokeObjectURL(url);
        };
    }, [authFetch, files]);

    return pictures;
}
