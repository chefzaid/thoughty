import { useCallback, useRef, useState as useLocalState } from 'react';
import type { RephraseMode } from '../../services/api/aiService';
import type { TranslationFunction as TranslationFn } from '../../types';
import {
    IconActionButton,
    MenuActionButton,
} from './EntryActionPrimitives';
import useDismissibleMenu from './useDismissibleMenu';

interface EntryRephraseButtonProps {
    isDark: boolean;
    disabled: boolean;
    loading: boolean;
    onRephrase?: (mode: RephraseMode) => Promise<void>;
    t: TranslationFn;
}

export default function EntryRephraseButton({
    isDark,
    disabled,
    loading,
    onRephrase,
    t,
}: Readonly<EntryRephraseButtonProps>) {
    const [menuOpen, setMenuOpen] = useLocalState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const secondaryActionClass = isDark
        ? 'text-gray-200 hover:bg-gray-700'
        : 'text-gray-700 hover:bg-gray-100';

    const closeMenu = useCallback(() => {
        setMenuOpen(false);
    }, [setMenuOpen]);

    useDismissibleMenu(menuOpen, menuRef, closeMenu);

    const handleSelectMode = useCallback(async (mode: RephraseMode) => {
        if (!onRephrase || disabled) {
            return;
        }

        closeMenu();
        await onRephrase(mode);
    }, [closeMenu, disabled, onRephrase]);

    if (!onRephrase) {
        return null;
    }

    return (
        <div className="relative" ref={menuRef}>
            <IconActionButton
                onClick={() => {
                    if (disabled) {
                        return;
                    }
                    setMenuOpen((current) => !current);
                }}
                className={`p-1.5 ${disabled ? 'cursor-wait text-indigo-300 bg-indigo-500/10' : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'}`}
                title={loading ? t('rephrasingEntry') : t('rephraseEntry')}
                ariaLabel={loading ? t('rephrasingEntry') : t('rephraseEntry')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.9 4.7L18 9.6l-4.1 1.7L12 16l-1.9-4.7L6 9.6l4.1-1.9L12 3zm6 12l.95 2.05L21 18l-2.05.95L18 21l-.95-2.05L15 18l2.05-.95L18 15zM5 14l.7 1.8L7.5 16.5l-1.8.7L5 19l-.7-1.8L2.5 16.5l1.8-.7L5 14z" />
                </svg>
            </IconActionButton>
            {menuOpen && !disabled && (
                <div
                    role="menu"
                    aria-label={t('rephraseEntry')}
                    className={`absolute right-0 top-full z-20 mt-2 min-w-[240px] rounded-xl border py-1 shadow-xl ${isDark ? 'border-gray-700 bg-gray-800/95' : 'border-gray-200 bg-white/95'}`}
                >
                    <MenuActionButton
                        onClick={() => void handleSelectMode('grammar')}
                        className={secondaryActionClass}
                        title={t('rephraseGrammarOnly')}
                    >
                        <span>{t('rephraseGrammarOnly')}</span>
                    </MenuActionButton>
                    <MenuActionButton
                        onClick={() => void handleSelectMode('polish')}
                        className={secondaryActionClass}
                        title={t('rephraseStyleLight')}
                    >
                        <span>{t('rephraseStyleLight')}</span>
                    </MenuActionButton>
                    <MenuActionButton
                        onClick={() => void handleSelectMode('rewrite')}
                        className={secondaryActionClass}
                        title={t('rephraseCompleteRewrite')}
                    >
                        <span>{t('rephraseCompleteRewrite')}</span>
                    </MenuActionButton>
                </div>
            )}
        </div>
    );
}
