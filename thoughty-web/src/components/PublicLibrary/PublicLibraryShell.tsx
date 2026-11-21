import type { ReactNode } from 'react';

import { usePageMeta } from '../../hooks/usePageMeta';
import type { TranslationFunction } from '../../types';
import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';
import './PublicLibrary.css';

interface PublicLibraryShellProps {
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly meta: { readonly title: string; readonly description: string };
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  /** Signing up, or opening the app for a signed-in visitor. */
  readonly action: { readonly label: string; readonly onClick: () => void };
  readonly onBackHome: () => void;
  /** The closing call to action, and the link to the other public library page. */
  readonly closing: { readonly title: string; readonly body: string; readonly linkHref: string; readonly linkLabel: string };
  readonly children: ReactNode;
}

/** The frame of the public pages that show what Thoughty offers to write: hero, content, call to action, footer. */
function PublicLibraryShell({ theme, t, meta, eyebrow, title, subtitle, action, onBackHome, closing, children }: Readonly<PublicLibraryShellProps>) {
  usePageMeta(meta.title, meta.description);
  const actionButton = (
    <button type="button" className="intro-btn primary" onClick={action.onClick}>
      {action.label}
    </button>
  );

  return (
    <div className={`intro-page ${theme === 'light' ? 'light' : 'dark'}`}>
      <main className="library-page">
        <header className="library-hero">
          <p className="intro-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className="intro-actions">
            {actionButton}
            <button type="button" className="intro-btn secondary" onClick={onBackHome}>
              {t('back')}
            </button>
          </div>
        </header>

        {children}

        <section className="library-closing" aria-labelledby="library-closing-heading">
          <h2 id="library-closing-heading">{closing.title}</h2>
          <p>{closing.body}</p>
          <div className="intro-actions">{actionButton}</div>
          <a className="library-cross-link" href={closing.linkHref}>{closing.linkLabel}</a>
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default PublicLibraryShell;
