import { useDisplayLanguage } from '../../contexts/displayLanguage';
import { getPublicPathForView, type PublicViewType } from '../../types';
import { mutedTextClass } from '../../utils/tintedText';

/** The public pages the footer leads to, with the label of each link. */
const FOOTER_LINKS: readonly (readonly [PublicViewType, string])[] = [
    ['about', 'about'],
    ['memoirQuestions', 'footerMemoirQuestions'],
    ['journalTemplates', 'footerJournalTemplates'],
    ['privacy', 'privacy'],
    ['terms', 'terms'],
    ['contact', 'contact'],
];

interface FooterProps {
    t: (key: string, params?: Record<string, string | number>) => string;
    theme: 'light' | 'dark';
}

function Footer({ t, theme }: Readonly<FooterProps>) {
    const year = new Date().getFullYear();
    const isLight = theme === 'light';
    // The pages it leads to open in the language being read
    const language = useDisplayLanguage();

    return (
        <footer className={`mt-12 py-8 border-t transition-colors ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-gray-800 bg-gray-900/50'}`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex flex-col items-center gap-6">
                <div className={`text-sm ${mutedTextClass(!isLight)} flex flex-col items-center text-center gap-1`}>
                    <span>{t('copyright', { year })}</span>
                    <span>{t('madeWithLove')}</span>
                </div>

                <div className="flex flex-wrap justify-center gap-6">
                    {FOOTER_LINKS.map(([view, labelKey]) => (
                        <a key={view} href={getPublicPathForView(view, language)} className={`text-sm hover:underline transition-colors ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-gray-100'}`}>
                            {t(labelKey)}
                        </a>
                    ))}
                </div>
            </div>
        </footer>
    );
}

export default Footer;
