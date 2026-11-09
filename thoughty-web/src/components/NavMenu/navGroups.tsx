import type { ReactNode } from 'react';
import type { ViewType } from '../../types';

export type NavGroupId = 'journaling' | 'social' | 'insights' | 'data';

export interface NavGroupItem {
    readonly view: ViewType;
    readonly label: string;
    readonly icon: ReactNode;
}

export interface NavGroupDefinition {
    readonly id: NavGroupId;
    readonly label: string;
    readonly icon: ReactNode;
    readonly items: readonly NavGroupItem[];
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

function codicon(name: string): ReactNode {
    return <span className={`codicon codicon-${name}`} aria-hidden="true" />;
}

const journalIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
);

const tagsIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="nav-tags-icon" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 4 7 20" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M17 4 15 20" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M4 9h14" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M3 15h14" />
    </svg>
);

const statsIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const importExportIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
);

/**
 * The main navigation's groups, in order: writing, other people, looking back, and what moves or
 * holds the data itself (the diaries, import and export, the recycle bin).
 */
export function buildNavGroups(t: Translate): readonly NavGroupDefinition[] {
    return [
        {
            id: 'journaling',
            label: t('navGroupJournaling'),
            icon: codicon('edit'),
            items: [
                { view: 'journal', label: t('journal'), icon: journalIcon },
                { view: 'memoir', label: t('memoir'), icon: codicon('history') },
                { view: 'tasks', label: t('openTasksNav'), icon: codicon('checklist') },
                { view: 'tags', label: t('tags'), icon: tagsIcon },
            ],
        },
        {
            id: 'social',
            label: t('navGroupSocial'),
            icon: codicon('comment-discussion'),
            items: [
                { view: 'feed', label: t('feed'), icon: codicon('rss') },
                { view: 'people', label: t('people'), icon: codicon('organization') },
            ],
        },
        {
            id: 'insights',
            label: t('navGroupInsights'),
            icon: codicon('graph'),
            items: [
                { view: 'stats', label: t('stats'), icon: statsIcon },
                { view: 'review', label: t('navYearInReview'), icon: codicon('calendar') },
            ],
        },
        {
            id: 'data',
            label: t('navGroupData'),
            icon: codicon('database'),
            items: [
                { view: 'diaries', label: t('manageDiaries'), icon: codicon('library') },
                { view: 'importExport', label: t('importExport'), icon: importExportIcon },
                { view: 'recycleBin', label: t('recycleBin'), icon: codicon('trash') },
            ],
        },
    ];
}

