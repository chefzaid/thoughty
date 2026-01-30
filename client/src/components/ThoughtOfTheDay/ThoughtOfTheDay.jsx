import React, { useState, useEffect, useCallback } from 'react';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import './ThoughtOfTheDay.css';

function ThoughtOfTheDay({ isOpen, onClose, theme, t, diaryId, onNavigateToEntry }) {
    const [highlights, setHighlights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchHighlights = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId);
            const response = await fetch(`/api/entries/highlights?${params}`);
            if (!response.ok) throw new Error('Failed to fetch highlights');
            const data = await response.json();
            setHighlights(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching highlights:', err);
            setError(t('highlightsError', { defaultValue: 'Failed to load highlights' }));
        } finally {
            setLoading(false);
        }
    }, [diaryId, t]);

    useEffect(() => {
        if (isOpen) {
            fetchHighlights();
        }
    }, [isOpen, fetchHighlights]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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

    const handleRefresh = () => {
        fetchHighlights();
    };

    const handleEntryClick = (entry) => {
        if (onNavigateToEntry) {
            let dateStr = entry.date;
            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
            onNavigateToEntry(dateStr, entry.index);
            onClose();
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
        return dateStr;
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const themeClass = theme === 'light' ? 'light' : 'dark';
    const hasRandomEntry = highlights?.randomEntry;
    const hasOnThisDay = highlights?.onThisDay && Object.keys(highlights.onThisDay).length > 0;

    return (
        <div className={`thought-of-day-overlay ${themeClass}`} onClick={handleOverlayClick}>
            <div className={`thought-of-day-modal ${themeClass}`}>
                <div className="thought-of-day-header">
                    <h2 className="thought-of-day-title">
                        <svg className="sparkle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
                        </svg>
                        {t('highlightsTitle', { defaultValue: 'Highlights' })}
                    </h2>
                    <div className="thought-of-day-actions">
                        <button
                            onClick={handleRefresh}
                            className="action-button refresh"
                            title={t('refreshRandom', { defaultValue: 'Get a new random thought' })}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="action-button close"
                            title={t('close', { defaultValue: 'Close' })}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="thought-of-day-body">
                    {loading ? (
                        <div className="thought-of-day-loading">
                            <div className="spinner"></div>
                            <p>{t('loading', { defaultValue: 'Loading...' })}</p>
                        </div>
                    ) : error ? (
                        <div className="thought-of-day-error">
                            <p>{error}</p>
                            <button onClick={handleRefresh} className="refresh-button">
                                {t('tryAgain', { defaultValue: 'Try again' })}
                            </button>
                        </div>
                    ) : !hasRandomEntry && !hasOnThisDay ? (
                        <div className="thought-of-day-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p>{t('noHighlights', { defaultValue: 'No highlights available yet. Start writing entries to see them here!' })}</p>
                        </div>
                    ) : (
                        <div className="thought-of-day-content">
                            {/* Random Thought of the Day */}
                            {hasRandomEntry && (
                                <div className="highlight-section random-thought">
                                    <h3 className="section-title">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        {t('randomThought', { defaultValue: 'Random Thought' })}
                                    </h3>
                                    <div
                                        className="highlight-entry clickable"
                                        onClick={() => handleEntryClick(highlights.randomEntry)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleEntryClick(highlights.randomEntry)}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className="entry-meta">
                                            <span className="entry-date">{formatDate(highlights.randomEntry.date)}</span>
                                            {highlights.randomEntry.diary_name && (
                                                <span className="entry-diary">
                                                    {highlights.randomEntry.diary_icon} {highlights.randomEntry.diary_name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="entry-content">
                                            <EntryContentRenderer content={highlights.randomEntry.content} maxLength={300} />
                                        </div>
                                        {highlights.randomEntry.tags && highlights.randomEntry.tags.length > 0 && (
                                            <div className="entry-tags">
                                                {highlights.randomEntry.tags.slice(0, 5).map((tag) => (
                                                    <span key={tag} className="tag">{tag}</span>
                                                ))}
                                                {highlights.randomEntry.tags.length > 5 && (
                                                    <span className="tag more">+{highlights.randomEntry.tags.length - 5}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* On This Day in Previous Years */}
                            {hasOnThisDay && (
                                <div className="highlight-section on-this-day">
                                    <h3 className="section-title">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        {t('onThisDay', { defaultValue: 'On This Day' })}
                                    </h3>
                                    <div className="on-this-day-entries">
                                        {Object.keys(highlights.onThisDay)
                                            .sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
                                            .map((yearsAgo) => (
                                                <div key={yearsAgo} className="year-group">
                                                    <div className="year-badge">
                                                        {t('yearsAgo', { years: yearsAgo, defaultValue: `${yearsAgo} ${Number.parseInt(yearsAgo) === 1 ? 'year' : 'years'} ago` })}
                                                    </div>
                                                    {highlights.onThisDay[yearsAgo].map((entry) => (
                                                        <div
                                                            key={entry.id}
                                                            className="highlight-entry clickable compact"
                                                            onClick={() => handleEntryClick(entry)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleEntryClick(entry)}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            <div className="entry-meta">
                                                                <span className="entry-date">{formatDate(entry.date)}</span>
                                                                {entry.diary_name && (
                                                                    <span className="entry-diary">
                                                                        {entry.diary_icon} {entry.diary_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="entry-content">
                                                                <EntryContentRenderer content={entry.content} maxLength={200} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ThoughtOfTheDay;
