import './LandingHeader.css';

/** What the landing page's buttons need: the visitor's state and where each button leads. */
export interface LandingActionProps {
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly isAuthenticated?: boolean;
  readonly onOpenJournal: () => void;
  readonly onSignIn: () => void;
  readonly onSignUp: () => void;
}

/** The sticky landing header: brand, section links and the sign-in or open-journal buttons. */
export default function LandingHeader(props: Readonly<LandingActionProps>) {
  const { isAuthenticated, onOpenJournal, onSignIn, onSignUp, t } = props;

  return (
    <header className="landing-header">
      <span className="landing-brand">
        <img src="/thoughty-logo.svg" alt="" />
        <span className="landing-brand-name">Thoughty</span>
      </span>
      <nav className="landing-nav" aria-label={t('landingNavLabel')}>
        <a href="#features">{t('landingNavFeatures')}</a>
        <a href="#memoir">{t('landingNavMemoir')}</a>
        <a href="#privacy">{t('landingNavPrivacy')}</a>
        <a href="/blog">{t('landingNavBlog')}</a>
      </nav>
      <div className="landing-header-actions">
        {isAuthenticated ? (
          <button type="button" className="intro-btn primary" onClick={onOpenJournal}>
            {t('landingOpenJournal')}
          </button>
        ) : (
          <>
            <button type="button" className="intro-btn ghost" onClick={onSignIn}>
              {t('signIn')}
            </button>
            <button type="button" className="intro-btn primary" onClick={onSignUp}>
              {t('signUp')}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
