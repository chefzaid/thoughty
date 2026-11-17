import { useState } from 'react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { TranslationFunction } from '../../types';
import { useContentLock } from './contentLockContext';

interface DiaryLockButtonProps {
    readonly diary: { readonly id: number; readonly name: string; readonly isLocked?: boolean };
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

/**
 * Locks a diary, and every entry in it, behind the PIN, after a confirmation (it makes the diary private);
 * lifting the lock asks for the PIN when the tab is not unlocked. A pressed toggle in Manage Diaries.
 */
export default function DiaryLockButton({ diary, theme, t }: DiaryLockButtonProps) {
    const contentLock = useContentLock();
    const [confirming, setConfirming] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    if (!contentLock) return null;
    const locked = Boolean(diary.isLocked);

    const change = async (next: boolean) => {
        if (await contentLock.setDiaryLocked(diary.id, next)) {
            setAnnouncement(t(next ? 'diaryLockOnAnnouncement' : 'diaryLockOffAnnouncement'));
        }
    };

    return (
        <>
            <button
                type="button"
                aria-pressed={locked}
                onClick={() => (locked ? void change(false) : setConfirming(true))}
                className={`action-btn lock ${locked ? 'locked' : ''}`}
                title={`${t('diaryLock')}. ${t('diaryLockHint')}`}
                aria-label={`${t('diaryLock')}: ${diary.name}`}
            >
                <span className={`codicon codicon-${locked ? 'lock' : 'unlock'}`} aria-hidden="true" />
            </button>
            <span role="status" className="sr-only">{announcement}</span>
            <ConfirmModal
                isOpen={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={() => {
                    setConfirming(false);
                    void change(true);
                }}
                title={t('diaryLockTitle')}
                message={t('diaryLockMessage', { name: diary.name })}
                confirmLabel={t('entryLockConfirm')}
                theme={theme}
                t={t}
            />
        </>
    );
}
