import { useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createShareLinksService } from '../../services/api';
import type { Entry } from '../../types';
import { useMentionPeople } from '../People/PeopleContext';
import { usePeopleCheck } from '../PeopleCheck/usePeopleCheck';
import { entryTexts, rewriteOutcome, useRewriteEntries } from '../PeopleCheck/useRewriteEntries';
import ShareLinkDialog, { type ShareLinkDialogProps } from './ShareLinkDialog';

type AuthenticatedShareLinkDialogProps = Omit<ShareLinkDialogProps, 'service' | 'isOpen' | 'beforeCreate' | 'notice'> & {
    /** The entry shared, whose people are checked before each link is made. */
    readonly entry?: Entry;
};

/**
 * The share link dialog with the signed-in session's service; rendered only while it is open. For an entry,
 * each link waits for the people check, whose **Replace** saves the entry's new words without making a link.
 */
export default function AuthenticatedShareLinkDialog({ entry, ...props }: AuthenticatedShareLinkDialogProps) {
    const service = useAuthenticatedService(createShareLinksService);
    const { people } = useMentionPeople();
    const { check, dialog } = usePeopleCheck({ people, theme: props.isDark ? 'dark' : 'light', language: props.language, t: props.t });
    const rewrite = useRewriteEntries();
    const [notice, setNotice] = useState<string | null>(null);

    const beforeCreate = (create: () => Promise<boolean>) => new Promise<boolean>((resolve) => {
        if (!entry) {
            void create().then(resolve);
            return;
        }
        setNotice(null);
        check({
            texts: entryTexts([entry]),
            mode: 'saved',
            share: () => void create().then(resolve),
            replace: (rewritten) => {
                resolve(false);
                void rewrite([entry], rewritten).then((outcome) => setNotice(rewriteOutcome(outcome, props.t, props.language)));
            },
            cancel: () => resolve(false),
        });
    });

    return (
        <>
            <ShareLinkDialog {...props} isOpen service={service} beforeCreate={beforeCreate} notice={notice} />
            {dialog}
        </>
    );
}
