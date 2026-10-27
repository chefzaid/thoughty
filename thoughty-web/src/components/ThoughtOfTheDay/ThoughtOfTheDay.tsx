import { useState, useEffect, useCallback, useId, useRef } from 'react';
import HighlightCard from './HighlightCard';
import OpenedCapsulesSection from './OpenedCapsulesSection';
import OnThisDaySection from './OnThisDaySection';
import type { Language } from '../../utils/translations';
import './ThoughtOfTheDay.css';
import { useAuth } from '../../contexts/AuthContext';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { components } from '../../generated/openapi';

/** What `GET /api/entries/highlights` returns. */
type Highlights = components['schemas']['EntryHighlightsResponseDto'];
type Entry = components['schemas']['EntryResponseDto'];

interface SourceEntryInfo {
    id: number;
    date: string;
    index: number;
}

interface ThoughtOfTheDayProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly diaryId?: number | null;
    readonly onNavigateToEntry?: (date: string, index: number, sourceEntry?: SourceEntryInfo | null) => void;
    readonly language?: Language;
}

function ThoughtOfTheDay({ isOpen, onClose, theme, t, diaryId, onNavigateToEntry, language = 'en' }: ThoughtOfTheDayProps) {
    const { authFetch } = useAuth();
    const modalRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const titleId = useId();
    const [highlights, setHighlights] = useState<Highlights | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHighlights = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId.toString());
            const response = await authFetch(`/api/entries/highlights?${params}`);
            if (!response.ok) throw new Error('Failed to fetch highlights');
            setHighlights(await response.json() as Highlights);
            setError(null);
        } catch (err) {
            console.error('Error fetching highlights:', err);
            setError(t('highlightsError'));
        } finally {
            setLoading(false);
        }
    }, [authFetch, diaryId, t]);

    useEffect(() => {
        if (isOpen) {
            fetchHighlights();
        }
    }, [isOpen, fetchHighlights]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleDocumentMouseDown = (event: globalThis.MouseEvent): void => {
            const modalElement = modalRef.current;
            if (!modalElement) {
                return;
            }

            if (event.target instanceof Node && !modalElement.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleDocumentMouseDown);

        return () => {
            document.removeEventListener('mousedown', handleDocumentMouseDown);
        };
    }, [isOpen, onClose]);

    useDialogFocus({ isOpen, dialogRef: modalRef, initialFocusRef: closeButtonRef, onClose });

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleRefresh = (): void => {
        fetchHighlights();
    };

    const handleEntryClick = (entry: Entry): void => {
        if (onNavigateToEntry) {
            let dateStr = entry.date;
            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0] ?? dateStr;
            onNavigateToEntry(dateStr, entry.index || 1, null);
            onClose();
        }
    };

    const formatDate = (dateStr: string): string => {
        if (!dateStr) return '';
        if (dateStr.includes('T')) return dateStr.split('T')[0] ?? dateStr;
        return dateStr;
    };

    const renderBodyContent = () => {
        if (loading) {
            return (
                <div className="thought-of-day-loading">
                    <div className="spinner"></div>
                    <p>{t('loading')}</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="thought-of-day-error">
                    <p>{error}</p>
                    <button type="button" onClick={handleRefresh} className="refresh-button">
                        {t('tryAgain')}
                    </button>
                </div>
            );
        }

        if (!hasRandomEntry && !hasOnThisDay && openedCapsules.length === 0) {
            return (
                <div className="thought-of-day-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p>{t('noHighlights')}</p>
                </div>
            );
        }

        return (
            <div className="thought-of-day-content">
                {openedCapsules.length > 0 && (
                    <OpenedCapsulesSection
                        capsules={openedCapsules}
                        language={language}
                        formatDate={formatDate}
                        onSelectEntry={handleEntryClick}
                        t={t}
                    />
                )}
                {hasRandomEntry && randomEntry && (
                    <div className="highlight-section random-thought">
                        <h3 className="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('randomThought')}
                            <button type="button"
                                onClick={handleRefresh}
                                className="action-button refresh inline-refresh"
                                title={t('randomize')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                </svg>
                            </button>
                        </h3>
                        <HighlightCard
                            entry={randomEntry}
                            formattedDate={formatDate(randomEntry.date)}
                            maxLength={300}
                            onOpen={() => handleEntryClick(randomEntry)}
                        >
                            {randomEntry.tags && randomEntry.tags.length > 0 && (
                                <div className="entry-tags">
                                    {randomEntry.tags.slice(0, 5).map((tag) => (
                                        <span key={tag} className="tag">{tag}</span>
                                    ))}
                                    {randomEntry.tags.length > 5 && (
                                        <span className="tag more">+{randomEntry.tags.length - 5}</span>
                                    )}
                                </div>
                            )}
                        </HighlightCard>
                    </div>
                )}

                {hasOnThisDay && highlights?.onThisDay && (
                    <OnThisDaySection
                        onThisDay={highlights.onThisDay}
                        t={t}
                        formatDate={formatDate}
                        onSelectEntry={handleEntryClick}
                    />
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    const themeClass = theme === 'light' ? 'light' : 'dark';
    const randomEntry = highlights?.randomEntry ?? null;
    const hasRandomEntry = randomEntry !== null;
    const hasOnThisDay = highlights?.onThisDay && Object.keys(highlights.onThisDay).length > 0;
    const openedCapsules = highlights?.openedCapsules ?? [];

    return (
        <div className={`thought-of-day-overlay ${themeClass}`}>
            <div
                ref={modalRef}
                className={`thought-of-day-modal ${themeClass}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="thought-of-day-header">
                    <h2 id={titleId} className="thought-of-day-title">
                        <svg className="sparkle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
                        </svg>
                        {t('highlightsTitle')}
                    </h2>
                    <div className="thought-of-day-actions">
                        <button type="button"
                            ref={closeButtonRef}
                            onClick={onClose}
                            className="action-button close"
                            title={t('close')}
                            aria-label={t('close')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="thought-of-day-body">{renderBodyContent()}</div>
            </div>
        </div>
    );
}

export default ThoughtOfTheDay;
