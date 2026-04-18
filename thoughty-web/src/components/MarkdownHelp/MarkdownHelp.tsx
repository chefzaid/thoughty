import { useState, useRef, useEffect } from 'react';

interface MarkdownHelpProps {
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string) => string;
}

const CHEATSHEET_ROWS = [
    { syntax: '**bold**', shortcut: 'Ctrl+B', key: 'bold' },
    { syntax: '_italic_', shortcut: 'Ctrl+I', key: 'italic' },
    { syntax: '~~strikethrough~~', shortcut: '', key: 'strikethrough' },
    { syntax: '# Heading 1', shortcut: '', key: 'heading1' },
    { syntax: '## Heading 2', shortcut: '', key: 'heading2' },
    { syntax: '### Heading 3', shortcut: '', key: 'heading3' },
    { syntax: '- item', shortcut: '', key: 'bulletList' },
    { syntax: '1. item', shortcut: '', key: 'numberedList' },
    { syntax: '> quote', shortcut: '', key: 'blockquote' },
    { syntax: '`code`', shortcut: 'Ctrl+K', key: 'inlineCode' },
    { syntax: '```code block```', shortcut: '', key: 'codeBlock' },
    { syntax: '[text](url)', shortcut: '', key: 'link' },
    { syntax: '---', shortcut: '', key: 'horizontalRule' },
];

function MarkdownHelp({ theme, t }: MarkdownHelpProps) {
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isDark = theme !== 'light';

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`flex items-center justify-center px-3 py-2 rounded-lg border transition-all ${
                    isDark
                        ? 'border-gray-600 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-500'
                        : 'border-gray-300 bg-gray-50 text-gray-500 hover:text-gray-700 hover:border-gray-400'
                }`}
                title={t('markdownHelp')}
                aria-label={t('markdownHelp')}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className={`absolute right-0 mt-2 w-72 rounded-lg shadow-xl border z-50 p-4 ${
                        isDark
                            ? 'bg-gray-800 border-gray-700 text-gray-200'
                            : 'bg-white border-gray-200 text-gray-800'
                    }`}
                >
                    <h3 className="text-sm font-semibold mb-3">{t('markdownHelp')}</h3>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                <th className="text-left pb-1 font-medium">{t('markdownHelpSyntax')}</th>
                                <th className="text-left pb-1 font-medium">{t('markdownHelpResult')}</th>
                                <th className="text-right pb-1 font-medium">{t('markdownHelpShortcut')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CHEATSHEET_ROWS.map((row) => (
                                <tr key={row.key} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                                    <td className="py-1 font-mono text-[11px]">{row.syntax}</td>
                                    <td className="py-1">{t(row.key)}</td>
                                    <td className="py-1 text-right">
                                        {row.shortcut && (
                                            <kbd className={`px-1 py-0.5 rounded text-[10px] ${
                                                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {row.shortcut}
                                            </kbd>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default MarkdownHelp;
