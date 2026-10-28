import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedContent, type SharedContentResult } from '../../services/api/shareLinksService';
import { getTranslation, type Language } from '../../utils/translations';
import SharedBookView from './SharedBookView';
import SharedEntryView from './SharedEntryView';
import { readerLanguage, readerTheme, useSharedPageDocument } from './sharedPageDocument';
import { formatShareDate } from '../ShareLinks/shareLinkText';

interface SharedLinkPageProps {
    readonly token: string;
    readonly language?: Language;
    readonly theme?: 'light' | 'dark';
    readonly fetchImpl?: typeof fetch;
}

type PageState = SharedContentResult | { readonly status: 'loading' };

/**
 * The page a private share link opens (`/s/<token>`), for a reader who is not signed in: only what the
 * link shares, with none of the app around it and nothing loaded with a session. A link that does not
 * work says so the same way whatever the reason.
 */
export default function SharedLinkPage({ token, language = readerLanguage(), theme = readerTheme(), fetchImpl }: SharedLinkPageProps) {
    const t = useCallback((key: string, params?: Record<string, string | number>) => getTranslation(language, key, params), [language]);
    const [state, setState] = useState<PageState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const mountedRef = useRef(true);
    // Opening an entry counts a view: each attempt asks once, also when React runs the effect twice in development
    const requestedRef = useRef<string | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const request = `${token}#${attempt}`;
        if (requestedRef.current === request) return;
        requestedRef.current = request;
        setState({ status: 'loading' });
        void fetchSharedContent(token, fetchImpl).then((result) => {
            if (mountedRef.current) setState(result);
        });
    }, [attempt, fetchImpl, token]);

    const title = useMemo(() => {
        if (state.status !== 'ready') return `${t('sharedPageLabel')} · Thoughty`;
        const { entry, bookVersion } = state.content;
        return `${entry?.title?.trim() || bookVersion?.title || t('sharedPageLabel')} · Thoughty`;
    }, [state, t]);
    useSharedPageDocument(title, language, theme);

    const isLight = theme === 'light';
    const mutedClass = isLight ? 'text-gray-600' : 'text-gray-300';

    return (
        <div className={`min-h-screen ${isLight ? 'bg-gray-50 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
            <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
                <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>{t('sharedPageLabel')}</p>
                {state.status === 'loading' && <p role="status" className={mutedClass}>{t('sharedLoading')}</p>}
                {state.status === 'unavailable' && (
                    <section className="space-y-2">
                        <h1 className="text-2xl font-semibold">{t('sharedUnavailableTitle')}</h1>
                        <p className={mutedClass}>{t('sharedUnavailableText')}</p>
                    </section>
                )}
                {state.status === 'failed' && (
                    <section className="space-y-3" role="alert">
                        <h1 className="text-2xl font-semibold">{t('sharedFailedTitle')}</h1>
                        <p className={mutedClass}>{t('sharedFailedText')}</p>
                        <button
                            type="button"
                            onClick={() => setAttempt((current) => current + 1)}
                            className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
                        >
                            {t('tryAgain')}
                        </button>
                    </section>
                )}
                {state.status === 'ready' && (
                    <>
                        {state.content.entry && <SharedEntryView token={token} entry={state.content.entry} theme={theme} language={language} t={t} />}
                        {state.content.bookVersion && (
                            <SharedBookView
                                token={token}
                                book={state.content.bookVersion}
                                theme={theme}
                                fetchImpl={fetchImpl}
                                onUnavailable={() => setState({ status: 'unavailable' })}
                                t={t}
                            />
                        )}
                        <footer className={`border-t pt-4 text-sm ${isLight ? 'border-gray-200' : 'border-gray-700'} ${mutedClass}`}>
                            {t('sharedExpiresOn', { date: formatShareDate(state.content.expiresAt, language, true) })}
                        </footer>
                    </>
                )}
            </main>
        </div>
    );
}
