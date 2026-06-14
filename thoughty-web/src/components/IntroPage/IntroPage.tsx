import './IntroPage.css';

interface IntroPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onSignIn: () => void;
  readonly onSignUp: () => void;
}

const FEATURE_ITEMS = [
  ['landingFeaturePrivateTitle', 'landingFeaturePrivateBody'],
  ['landingFeatureOrganizeTitle', 'landingFeatureOrganizeBody'],
  ['landingFeatureExportTitle', 'landingFeatureExportBody'],
  ['landingFeatureInsightTitle', 'landingFeatureInsightBody'],
] as const;

const SCREENSHOT_ITEMS = [
  {
    label: 'landingScreenshotJournalTitle',
    body: 'landingScreenshotJournalBody',
    className: 'journal-shot',
  },
  {
    label: 'landingScreenshotStatsTitle',
    body: 'landingScreenshotStatsBody',
    className: 'stats-shot',
  },
  {
    label: 'landingScreenshotExportTitle',
    body: 'landingScreenshotExportBody',
    className: 'export-shot',
  },
] as const;

function ProductScene({ t }: Readonly<Pick<IntroPageProps, 't'>>) {
  return (
    <div className="intro-product-scene" aria-label={t('landingScreenshotAlt')} role="img">
      <div className="scene-topbar">
        <span />
        <span />
        <span />
      </div>
      <div className="scene-sidebar">
        <strong>Thoughty</strong>
        <span>{t('journal')}</span>
        <span>{t('stats')}</span>
        <span>{t('importExport')}</span>
      </div>
      <div className="scene-entry">
        <div className="scene-entry-date">2026-06-14</div>
        <div className="scene-entry-title">{t('landingSceneEntryTitle')}</div>
        <p>{t('landingSceneEntryBody')}</p>
        <div className="scene-tags">
          <span>reflection</span>
          <span>work</span>
          <span>{t('private')}</span>
        </div>
      </div>
      <div className="scene-stats">
        <span>{t('landingSceneStatsLabel')}</span>
        <strong>184</strong>
        <small>{t('avgWordsPerEntry')}</small>
      </div>
    </div>
  );
}

function ScreenshotPreview({
  className,
  label,
  body,
  t,
}: Readonly<{
  className: string;
  label: string;
  body: string;
  t: IntroPageProps['t'];
}>) {
  return (
    <article className={`landing-screenshot ${className}`}>
      <div className="screenshot-frame" aria-hidden="true">
        <div className="screenshot-toolbar">
          <span />
          <span />
          <span />
        </div>
        <div className="screenshot-content">
          <span className="line strong" />
          <span className="line" />
          <span className="line short" />
          <div className="mini-grid">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <h3>{t(label)}</h3>
      <p>{t(body)}</p>
    </article>
  );
}

function IntroPage({ theme, t, onSignIn, onSignUp }: IntroPageProps) {
  const isLight = theme === 'light';

  return (
    <main className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <section className="landing-hero">
        <ProductScene t={t} />
        <div className="hero-copy">
          <p className="intro-eyebrow">{t('landingEyebrow')}</p>
          <h1>Thoughty</h1>
          <p className="intro-subtitle">{t('landingSubtitle')}</p>
          <div className="intro-actions">
            <button type="button" className="intro-btn primary" onClick={onSignUp}>
              {t('signUp')}
            </button>
            <button type="button" className="intro-btn secondary" onClick={onSignIn}>
              {t('signIn')}
            </button>
          </div>
        </div>
      </section>

      <section className="landing-proof">
        <div>
          <span>{t('landingProofPrivacyMetric')}</span>
          <strong>{t('landingProofPrivacyLabel')}</strong>
        </div>
        <div>
          <span>{t('landingProofExportMetric')}</span>
          <strong>{t('landingProofExportLabel')}</strong>
        </div>
        <div>
          <span>{t('landingProofInsightMetric')}</span>
          <strong>{t('landingProofInsightLabel')}</strong>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-heading">
          <p className="section-kicker">{t('landingFeatureSection')}</p>
          <h2>{t('landingFeatureHeading')}</h2>
        </div>
        <div className="feature-list">
          {FEATURE_ITEMS.map(([titleKey, bodyKey]) => (
            <article className="feature-item" key={titleKey}>
              <h3>{t(titleKey)}</h3>
              <p>{t(bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section screenshots-section">
        <div className="section-heading">
          <p className="section-kicker">{t('landingScreenshotsKicker')}</p>
          <h2>{t('landingScreenshotsHeading')}</h2>
        </div>
        <div className="screenshot-grid">
          {SCREENSHOT_ITEMS.map((item) => (
            <ScreenshotPreview
              key={item.label}
              label={item.label}
              body={item.body}
              className={item.className}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <p className="section-kicker">{t('landingCtaKicker')}</p>
        <h2>{t('landingCtaTitle')}</h2>
        <p>{t('landingCtaBody')}</p>
        <div className="intro-actions compact">
          <button type="button" className="intro-btn primary" onClick={onSignUp}>
            {t('signUp')}
          </button>
          <button type="button" className="intro-btn secondary" onClick={onSignIn}>
            {t('signIn')}
          </button>
        </div>
      </section>
    </main>
  );
}

export default IntroPage;
