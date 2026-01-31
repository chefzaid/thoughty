import React from 'react';
import './DiaryTabs.css';

interface Diary {
    id: number;
    name: string;
    icon?: string;
    is_default?: boolean;
}

interface DiaryTabsProps {
    readonly diaries: Diary[];
    readonly currentDiaryId: number | null;
    readonly onDiaryChange: (id: number | null) => void;
    readonly onManageDiaries: () => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function DiaryTabs({ diaries, currentDiaryId, onDiaryChange, onManageDiaries, theme, t }: DiaryTabsProps): React.ReactElement {
    const isLight = theme === 'light';

    return (
        <div className={`diary-tabs ${isLight ? 'light' : 'dark'}`}>
            <div className="diary-tabs-scroll">
                {/* All Diaries Option */}
                <button
                    className={`diary-tab ${currentDiaryId === null ? 'active' : ''}`}
                    onClick={() => onDiaryChange(null)}
                    title={t('allDiaries')}
                >
                    <span className="diary-icon">📚</span>
                    <span className="diary-name">{t('allDiaries')}</span>
                </button>

                {/* Individual Diary Tabs */}
                {diaries.map(diary => (
                    <button
                        key={diary.id}
                        className={`diary-tab ${currentDiaryId === diary.id ? 'active' : ''} ${diary.is_default ? 'default' : ''}`}
                        onClick={() => onDiaryChange(diary.id)}
                        title={diary.name}
                    >
                        <span className="diary-icon">{diary.icon || '📓'}</span>
                        <span className="diary-name">{diary.name}</span>
                        {diary.is_default && <span className="default-badge">★</span>}
                    </button>
                ))}

                {/* Manage Diaries Button */}
                <button
                    className="diary-tab manage-btn"
                    onClick={onManageDiaries}
                    title={t('manageDiaries')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="manage-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default DiaryTabs;
