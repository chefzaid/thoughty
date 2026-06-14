import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';

interface AboutPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
  readonly onSignUp: () => void;
}

const ABOUT_VALUES = [
  ['aboutValuePrivacyTitle', 'aboutValuePrivacyBody'],
  ['aboutValueOwnershipTitle', 'aboutValueOwnershipBody'],
  ['aboutValueCalmTitle', 'aboutValueCalmBody'],
] as const;

function AboutPage({ theme, t, onBackHome, onSignUp }: Readonly<AboutPageProps>) {
  const isLight = theme === 'light';

  return (
    <div className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <main className="about-page">
        <section className="about-hero">
          <div className="about-copy">
            <p className="intro-eyebrow">{t('aboutEyebrow')}</p>
            <h1>{t('aboutTitle')}</h1>
            <p>{t('aboutSubtitle')}</p>
            <div className="intro-actions">
              <button type="button" className="intro-btn primary" onClick={onSignUp}>
                {t('signUp')}
              </button>
              <button type="button" className="intro-btn secondary" onClick={onBackHome}>
                {t('back')}
              </button>
            </div>
          </div>

          <div className="about-note" aria-label={t('aboutNoteLabel')}>
            <span>{t('aboutNoteDate')}</span>
            <strong>{t('aboutNoteTitle')}</strong>
            <p>{t('aboutNoteBody')}</p>
          </div>
        </section>

        <section className="landing-section about-story">
          <div className="section-heading">
            <p className="section-kicker">{t('aboutStoryKicker')}</p>
            <h2>{t('aboutStoryTitle')}</h2>
          </div>
          <p>{t('aboutStoryBody')}</p>
        </section>

        <section className="landing-section">
          <div className="section-heading">
            <p className="section-kicker">{t('aboutMissionKicker')}</p>
            <h2>{t('aboutMissionTitle')}</h2>
          </div>
          <div className="feature-list about-values">
            {ABOUT_VALUES.map(([titleKey, bodyKey]) => (
              <article className="feature-item" key={titleKey}>
                <h3>{t(titleKey)}</h3>
                <p>{t(bodyKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section about-team">
          <div className="section-heading">
            <p className="section-kicker">{t('aboutTeamKicker')}</p>
            <h2>{t('aboutTeamTitle')}</h2>
          </div>
          <p>{t('aboutTeamBody')}</p>
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default AboutPage;
