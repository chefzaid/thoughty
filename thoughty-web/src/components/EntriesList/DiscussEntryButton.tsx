import { useCallback, useRef, useState } from 'react';

import type { Entry, TranslationFunction as TranslationFn } from '../../types';
import type { Language } from '../../utils/translations';
import DiscussWithSomeoneDialog from '../Messages/DiscussWithSomeoneDialog';
import { IconActionButton, MenuActionButton } from './EntryActionPrimitives';
import useDismissibleMenu from './useDismissibleMenu';

interface DiscussEntryButtonProps {
    readonly entry: Entry;
    readonly isDark: boolean;
    readonly language: Language;
    /** Opens the AI chat about the entry; absent while AI is off or the entry's diary keeps it out. */
    readonly onDiscussWithAi?: () => void;
    /** Whether the entry can be shared with a writer in a message (public sharing is on). */
    readonly withSomeone: boolean;
    readonly t: TranslationFn;
}

/**
 * The entry card's Discuss button. With both choices it opens a menu: "With AI" (the entry's AI chat) and "With
 * someone" (a message to a writer who follows you back, sharing the entry). With one, the button is that choice.
 */
export default function DiscussEntryButton({ entry, isDark, language, onDiscussWithAi, withSomeone, t }: DiscussEntryButtonProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    useDismissibleMenu(menuOpen, menuRef, closeMenu);

    if (!onDiscussWithAi && !withSomeone) return null;

    const both = Boolean(onDiscussWithAi) && withSomeone;
    // The menu item goes with the menu, so focus moves to the Discuss button first and the dialog returns it there
    const openDialog = () => {
        triggerRef.current?.focus();
        setMenuOpen(false);
        setDialogOpen(true);
    };
    const discussWithAi = () => {
        triggerRef.current?.focus();
        setMenuOpen(false);
        onDiscussWithAi?.();
    };
    let title = t('discussWithSomeoneTitle');
    let onClick = openDialog;
    if (both) {
        title = t('discussThisEntry');
        onClick = () => setMenuOpen((current) => !current);
    } else if (onDiscussWithAi) {
        title = t('discussEntry');
        onClick = discussWithAi;
    }
    const itemClass = isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100';

    return (
        <div className="relative" ref={menuRef}>
            <IconActionButton
                buttonRef={triggerRef}
                onClick={onClick}
                className={`p-1.5 ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'} hover:bg-cyan-500/10`}
                title={title}
                ariaExpanded={both ? menuOpen : undefined}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </IconActionButton>
            {menuOpen && (
                <div
                    role="menu"
                    aria-label={t('discussThisEntry')}
                    className={`absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-xl border py-1 shadow-xl ${isDark ? 'border-gray-700 bg-gray-800/95' : 'border-gray-200 bg-white/95'}`}
                >
                    <MenuActionButton onClick={discussWithAi} className={itemClass} title={t('discussEntry')}>
                        <span className="codicon codicon-sparkle" aria-hidden="true" />
                        <span>{t('discussWithAi')}</span>
                    </MenuActionButton>
                    <MenuActionButton onClick={openDialog} className={itemClass} title={t('discussWithSomeoneTitle')}>
                        <span className="codicon codicon-mail" aria-hidden="true" />
                        <span>{t('discussWithSomeone')}</span>
                    </MenuActionButton>
                </div>
            )}
            {dialogOpen && (
                <DiscussWithSomeoneDialog
                    entry={entry}
                    isDark={isDark}
                    language={language}
                    onClose={() => setDialogOpen(false)}
                    t={t}
                />
            )}
        </div>
    );
}
