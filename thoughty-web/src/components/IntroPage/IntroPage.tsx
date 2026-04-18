import './IntroPage.css';

interface IntroPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onSignIn: () => void;
  readonly onSignUp: () => void;
}

function IntroPage({ theme, t, onSignIn, onSignUp }: IntroPageProps) {
  const isLight = theme === 'light';

  return (
    <main className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <div className="intro-shell">
        <section className="intro-hero">
          <p className="intro-eyebrow">{t('landingEyebrow')}</p>
          <h1>{t('landingTitle')}</h1>
          <p className="intro-subtitle">{t('landingSubtitle')}</p>

          <div className="intro-actions">
            <button type="button" className="intro-btn primary" onClick={onSignUp}>
              {t('signUp')}
            </button>
            <button type="button" className="intro-btn secondary" onClick={onSignIn}>
              {t('signIn')}
            </button>
          </div>

          <div className="intro-pulse-card">
            <span className="pulse-label">{t('landingPulseLabel')}</span>
            <strong>{t('landingPulseTitle')}</strong>
            <p>{t('landingPulseBody')}</p>
          </div>
        </section>

        <section className="intro-grid" aria-label={t('landingFeatureSection')}>
          <article className="intro-card accent-coral">
            <span className="intro-card-kicker">01</span>
            <h2>{t('landingFeaturePrivateTitle')}</h2>
            <p>{t('landingFeaturePrivateBody')}</p>
          </article>

          <article className="intro-card accent-gold">
            <span className="intro-card-kicker">02</span>
            <h2>{t('landingFeatureOrganizeTitle')}</h2>
            <p>{t('landingFeatureOrganizeBody')}</p>
          </article>

          <article className="intro-card accent-teal wide">
            <span className="intro-card-kicker">03</span>
            <h2>{t('landingFeatureExportTitle')}</h2>
            <p>{t('landingFeatureExportBody')}</p>
          </article>

          <article className="intro-card accent-ink wide">
            <span className="intro-card-kicker">04</span>
            <h2>{t('landingFeatureInsightTitle')}</h2>
            <p>{t('landingFeatureInsightBody')}</p>
          </article>
        </section>
      </div>
    </main>
  );
}

export default IntroPage;