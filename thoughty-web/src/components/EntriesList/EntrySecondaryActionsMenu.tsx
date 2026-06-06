import { useCallback, useEffect, useRef, useState as useLocalState } from 'react';
import type { TranslationFunction as TranslationFn } from '../../types';
import {
    IconActionButton,
    MenuActionButton,
} from './EntryActionPrimitives';
import useDismissibleMenu from './useDismissibleMenu';

interface EntrySecondaryActionsMenuProps {
    isDark: boolean;
    entryPermalink?: string;
    archiveActionLabel: string;
    isArchived: boolean;
    showHistory: boolean;
    onShareEntry?: () => Promise<void>;
    onToggleHistory?: () => Promise<void>;
    onToggleArchived: () => void;
    onDelete: () => void;
    t: TranslationFn;
}

export default function EntrySecondaryActionsMenu({
    isDark,
    entryPermalink,
    archiveActionLabel,
    isArchived,
    showHistory,
    onShareEntry,
    onToggleHistory,
    onToggleArchived,
    onDelete,
    t,
}: Readonly<EntrySecondaryActionsMenuProps>) {
    const [menuOpen, setMenuOpen] = useLocalState(false);
    const [shareReady, setShareReady] = useLocalState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const shareReadyTimeoutRef = useRef<number | null>(null);
    const secondaryActionClass = isDark
        ? 'text-gray-200 hover:bg-gray-700'
        : 'text-gray-700 hover:bg-gray-100';
    const destructiveSecondaryActionClass = isDark
        ? 'text-red-300 hover:bg-red-500/10'
        : 'text-red-600 hover:bg-red-50';

    let menuButtonClass = 'text-gray-500 hover:text-gray-300 hover:bg-gray-500/10';

    if (menuOpen) {
        menuButtonClass = 'text-sky-400 bg-sky-500/10';
    } else if (shareReady) {
        menuButtonClass = 'text-green-400 hover:bg-green-500/10';
    }

    const closeMenu = useCallback(() => {
        setMenuOpen(false);
    }, [setMenuOpen]);

    useDismissibleMenu(menuOpen, menuRef, closeMenu);

    useEffect(() => () => {
        if (shareReadyTimeoutRef.current !== null) {
            globalThis.clearTimeout(shareReadyTimeoutRef.current);
        }
    }, []);

    const toggleMenu = useCallback(() => {
        setMenuOpen((current) => !current);
    }, [setMenuOpen]);

    const handleShare = useCallback(async () => {
        if (!onShareEntry) {
            return;
        }

        await onShareEntry();
        setShareReady(true);
        if (shareReadyTimeoutRef.current !== null) {
            globalThis.clearTimeout(shareReadyTimeoutRef.current);
        }
        shareReadyTimeoutRef.current = globalThis.setTimeout(() => {
            setShareReady(false);
            shareReadyTimeoutRef.current = null;
        }, 2000);
    }, [onShareEntry, setShareReady]);

    const handleToggleHistory = useCallback(async () => {
        if (!onToggleHistory) {
            return;
        }

        closeMenu();
        await onToggleHistory();
    }, [closeMenu, onToggleHistory]);

    const handleToggleArchived = useCallback(() => {
        closeMenu();
        onToggleArchived();
    }, [closeMenu, onToggleArchived]);

    const handleDelete = useCallback(() => {
        closeMenu();
        onDelete();
    }, [closeMenu, onDelete]);

    return (
        <div className="relative" ref={menuRef}>
            <IconActionButton
                onClick={toggleMenu}
                className={`p-1.5 ${menuButtonClass}`}
                title={t('moreActions')}
                ariaLabel={t('moreActions')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5h.01M12 12h.01M12 19h.01" />
                </svg>
            </IconActionButton>
            {menuOpen && (
                <div
                    role="menu"
                    aria-label={t('moreActions')}
                    className={`absolute right-0 top-full z-20 mt-2 min-w-[220px] rounded-xl border py-1 shadow-xl ${isDark ? 'border-gray-700 bg-gray-800/95' : 'border-gray-200 bg-white/95'}`}
                >
                    {entryPermalink && (
                        <a
                            href={entryPermalink}
                            role="menuitem"
                            onClick={closeMenu}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${secondaryActionClass}`}
                            title={t('entryPermalink')}
                            aria-label={t('entryPermalink')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14a3 3 0 004.243 0l3.536-3.536a3 3 0 00-4.243-4.243L11 8m3 8l-2.293 2.293a3 3 0 01-4.243-4.243L11 11" />
                            </svg>
                            <span>{t('entryPermalink')}</span>
                        </a>
                    )}
                    {onShareEntry && (
                        <MenuActionButton
                            onClick={() => void handleShare()}
                            className={shareReady ? 'text-green-400 hover:bg-green-500/10' : secondaryActionClass}
                            title={shareReady ? t('entryLinkCopied') : t('shareEntry')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.882 13.119 9 12.825 9 12.5a2.5 2.5 0 10-2.5 2.5c.325 0 .619-.118.842-.316l8.632 4.316A2.49 2.49 0 0016 19.5a2.5 2.5 0 102.5-2.5c-.325 0-.619.118-.842.316l-8.632-4.316A2.49 2.49 0 009 12.5c0-.325-.118-.619-.316-.842l8.632-4.316A2.49 2.49 0 0018.5 7a2.5 2.5 0 10-2.5-2.5c0 .325.118.619.316.842l-8.632 4.316z" />
                            </svg>
                            <span>{shareReady ? t('entryLinkCopied') : t('shareEntry')}</span>
                        </MenuActionButton>
                    )}
                    {onToggleHistory && (
                        <MenuActionButton
                            onClick={() => void handleToggleHistory()}
                            className={showHistory ? 'text-amber-400 hover:bg-amber-500/10' : secondaryActionClass}
                            title={t('viewHistory')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{t('viewHistory')}</span>
                        </MenuActionButton>
                    )}
                    <MenuActionButton
                        onClick={handleToggleArchived}
                        className={isArchived ? 'text-sky-400 hover:bg-sky-500/10' : secondaryActionClass}
                        title={archiveActionLabel}
                    >
                        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M5 8h14" />
                            <path d="M5 8l1 11h12l1-11" />
                            <path d={isArchived ? 'M9 12h6' : 'M9 12h6m-3-3v6'} />
                        </svg>
                        <span>{archiveActionLabel}</span>
                    </MenuActionButton>
                    <MenuActionButton
                        onClick={handleDelete}
                        className={destructiveSecondaryActionClass}
                        title={t('delete')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>{t('delete')}</span>
                    </MenuActionButton>
                </div>
            )}
        </div>
    );
}
