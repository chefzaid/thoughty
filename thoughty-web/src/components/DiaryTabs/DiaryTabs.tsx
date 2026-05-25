import type { CSSProperties } from 'react';
import './DiaryTabs.css';
import { resolveDiaryColor, withAlpha } from '../../utils/diaryColors';

interface Diary {
    id: number;
    name: string;
    icon?: string;
    color?: string | null;
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

function DiaryTabs({ diaries, currentDiaryId, onDiaryChange, onManageDiaries, theme, t }: DiaryTabsProps) {
    const isLight = theme === 'light';
    const allDiariesAccent = isLight ? '#64748B' : '#94A3B8';

    return (
        <div className={`diary-tabs ${isLight ? 'light' : 'dark'}`}>
            <div className="diary-tabs-scroll">
                {/* All Diaries Option */}
                <button
                    type="button"
                    className={`diary-tab ${currentDiaryId === null ? 'active' : ''}`}
                    onClick={() => { onDiaryChange(null); }}
                    title={t('allDiaries')}
                    style={{
                        '--diary-accent': allDiariesAccent,
                        '--diary-accent-soft': withAlpha(allDiariesAccent, currentDiaryId === null ? 0.22 : 0.12),
                    } as CSSProperties}
                >
                    <span className="diary-icon">📚</span>
                    <span className="diary-accent-dot" />
                    <span className="diary-name">{t('allDiaries')}</span>
                </button>

                {/* Individual Diary Tabs */}
                {diaries.map(diary => {
                    const diaryAccent = resolveDiaryColor(diary);

                    return (
                        <button
                            key={diary.id}
                            type="button"
                            className={`diary-tab ${currentDiaryId === diary.id ? 'active' : ''} ${diary.is_default ? 'default' : ''}`}
                            onClick={() => { onDiaryChange(diary.id); }}
                            title={diary.name}
                            style={{
                                '--diary-accent': diaryAccent,
                                '--diary-accent-soft': withAlpha(diaryAccent, currentDiaryId === diary.id ? 0.22 : 0.12),
                            } as CSSProperties}
                        >
                            <span className="diary-icon">{diary.icon || '📓'}</span>
                            <span className="diary-accent-dot" />
                            <span className="diary-name">{diary.name}</span>
                            {diary.is_default && <span className="default-badge">★</span>}
                        </button>
                    );
                })}

                {/* Manage Diaries Button */}
                <button
                    type="button"
                    className="diary-tab manage-btn"
                    onClick={onManageDiaries}
                    title="Manage Diaries"
                    aria-label="Manage Diaries"
                >
                    <span className="codicon codicon-settings-gear manage-icon" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

export default DiaryTabs;
