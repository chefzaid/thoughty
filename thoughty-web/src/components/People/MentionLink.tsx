import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { personJournalPath } from '../../utils/mentions';

interface MentionLinkProps {
    readonly personId: number;
    readonly children: ReactNode;
    /** Hover text naming the person, such as "Entries that mention Marie". */
    readonly title?: string;
}

/** A mention in the writer's own entry: a link to the journal of every entry that mentions the person. */
export default function MentionLink({ personId, children, title }: MentionLinkProps) {
    return (
        <Link
            to={personJournalPath(personId)}
            className="entry-mention-link"
            title={title}
            // An entry card may react to clicks; the link only navigates
            onClick={(event: MouseEvent) => event.stopPropagation()}
        >
            {children}
        </Link>
    );
}
