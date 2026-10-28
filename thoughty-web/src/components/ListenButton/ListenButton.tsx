import { useState, useRef, useEffect, type FocusEvent, type KeyboardEvent } from 'react';

import { mutedTextClass } from '../../utils/tintedText';

interface ListenButtonProps {
  entryId: number;
  speaking: boolean;
  activeEntryId: number | null;
  onListenOne: () => void;
  onListenFrom: () => void;
  onStop: () => void;
  theme?: 'light' | 'dark';
  /** Accessible name naming the entry (for example its author); defaults to the plain "Listen" label. */
  label?: string;
  /** Which edge of the button the menu lines up with; `start` opens it towards the end of the line. */
  menuAlign?: 'start' | 'end';
  t: (key: string) => string;
}

function ListenButton({
  entryId,
  speaking,
  activeEntryId,
  onListenOne,
  onListenFrom,
  onStop,
  theme,
  label,
  menuAlign = 'end',
  t,
}: Readonly<ListenButtonProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isActive = speaking && activeEntryId === entryId;
  const isPlaying = speaking && activeEntryId !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!menuRef.current?.contains(event.relatedTarget as Node | null)) setMenuOpen(false);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  };

  const handleClick = () => {
    if (speaking) {
      onStop();
      return;
    }
    setMenuOpen((prev) => !prev);
  };

  const handleListenOne = () => {
    setMenuOpen(false);
    onListenOne();
  };

  const handleListenFrom = () => {
    setMenuOpen(false);
    onListenFrom();
  };

  const isDark = theme !== 'light';

  const getButtonClass = (): string => {
    if (isActive) return `${isDark ? 'text-orange-500' : 'text-orange-600'} hover:bg-orange-500/10 animate-pulse`;
    if (isPlaying) return `${mutedTextClass(isDark)} hover:bg-gray-500/10`;
    return `${mutedTextClass(isDark)} ${isDark ? 'hover:text-blue-400' : 'hover:text-blue-700'} hover:bg-blue-500/10`;
  };

  return (
    <div
      className="relative"
      ref={menuRef}
      onKeyDown={menuOpen ? handleMenuKeyDown : undefined}
      onBlur={menuOpen ? handleMenuBlur : undefined}
    >
      <button type="button"
        ref={triggerRef}
        onClick={handleClick}
        className={`p-1.5 rounded transition-colors ${getButtonClass()}`}
        title={speaking ? t('stopListening') : t('listen')}
        aria-label={speaking ? t('stopListening') : label ?? t('listen')}
        aria-pressed={isActive}
        aria-haspopup={speaking ? undefined : 'menu'}
        aria-expanded={speaking ? undefined : menuOpen}
      >
        {isActive ? (
          <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8v6.4a.8.8 0 00.8.8h2.4l3.6 3.6V5.2L9.7 8.8H7.3a.8.8 0 00-.8.8z" />
          </svg>
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label={label ?? t('listen')}
          className={`absolute ${menuAlign === 'start' ? 'left-0' : 'right-0'} top-full mt-1 z-50 rounded-lg shadow-lg border py-1 min-w-[200px] ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <button type="button"
            role="menuitem"
            onClick={handleListenOne}
            className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              isDark
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            {t('listenThisEntry')}
          </button>
          <button type="button"
            role="menuitem"
            onClick={handleListenFrom}
            className={`w-full text-left px-4 py-2 text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
              isDark
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('listenFromHere')}
          </button>
        </div>
      )}
    </div>
  );
}

export default ListenButton;
