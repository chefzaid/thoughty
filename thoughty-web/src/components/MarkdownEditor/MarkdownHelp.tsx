import type { TranslationFunction } from '../../types';

const SYNTAX: ReadonlyArray<readonly [string, string]> = [
    ['**…**', 'markdownHelpBold'],
    ['*…*', 'markdownHelpItalic'],
    ['# …', 'markdownHelpHeading'],
    ['- …', 'markdownHelpList'],
    ['- [ ] …', 'markdownHelpTask'],
    ['- [x] …', 'markdownHelpTaskDone'],
    ['[[2024-01-15]]', 'markdownHelpReference'],
    ['![…](attachment:12)', 'markdownHelpInlineImage'],
];

/** A short Markdown reference under the editor, closed until the writer opens it. */
export default function MarkdownHelp({ theme, t }: Readonly<{ theme?: 'light' | 'dark'; t: TranslationFunction }>) {
    const isLight = theme === 'light';
    return (
        <details className={`markdown-help mt-2 text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            <summary className="cursor-pointer select-none w-fit rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                {t('markdownHelpSummary')}
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {SYNTAX.map(([syntax, description]) => (
                    <div key={syntax} className="contents">
                        <dt>
                            <code className={`rounded px-1 font-mono ${isLight ? 'bg-gray-100 text-gray-800' : 'bg-gray-900 text-gray-200'}`}>{syntax}</code>
                        </dt>
                        <dd>{t(description)}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
}
