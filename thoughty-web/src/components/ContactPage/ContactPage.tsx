import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';
import './ContactPage.css';

interface ContactPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
  readonly onOpenFeedback: () => void;
}

const GUIDE_ITEMS = [
  ['contactGuideStartTitle', 'contactGuideStartBody'],
  ['contactGuideImportTitle', 'contactGuideImportBody'],
  ['contactGuidePrivacyTitle', 'contactGuidePrivacyBody'],
] as const;

const FAQ_ITEMS = [
  ['contactFaqDataTitle', 'contactFaqDataBody'],
  ['contactFaqAiTitle', 'contactFaqAiBody'],
  ['contactFaqExportTitle', 'contactFaqExportBody'],
] as const;

/**
 * The support page: guides, answers, and where to write. No address receives messages yet (see TODO.md ›
 * Needs Input), so instead of a form whose messages would go nowhere it says so and points to the
 * feedback board, which does keep what is posted, and to the guides and answers below.
 */
function ContactPage({ theme, t, onBackHome, onOpenFeedback }: Readonly<ContactPageProps>) {
  const isLight = theme === 'light';

  return (
    <div className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <main className="contact-page">
        <section className="contact-hero">
          <div className="contact-copy">
            <p className="intro-eyebrow">{t('contactEyebrow')}</p>
            <h1>{t('contactTitle')}</h1>
            <p>{t('contactSubtitle')}</p>
            <button type="button" className="intro-btn secondary" onClick={onBackHome}>
              {t('back')}
            </button>
          </div>

          <section className="contact-panel" aria-labelledby="contact-closed-title">
            <h2 id="contact-closed-title">{t('contactClosedTitle')}</h2>
            <p>{t('contactClosedBody')}</p>
            <button type="button" className="intro-btn primary" onClick={onOpenFeedback}>
              {t('contactOpenFeedback')}
            </button>
          </section>
        </section>

        <section className="landing-section contact-guides">
          <div className="section-heading">
            <p className="section-kicker">{t('contactGuidesKicker')}</p>
            <h2>{t('contactGuidesTitle')}</h2>
          </div>
          <div className="feature-list about-values">
            {GUIDE_ITEMS.map(([titleKey, bodyKey]) => (
              <article className="feature-item" key={titleKey}>
                <h3>{t(titleKey)}</h3>
                <p>{t(bodyKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section contact-faq">
          <div className="section-heading">
            <p className="section-kicker">{t('contactFaqKicker')}</p>
            <h2>{t('contactFaqTitle')}</h2>
          </div>
          <div className="legal-sections" aria-label={t('contactFaqTitle')}>
            {FAQ_ITEMS.map(([titleKey, bodyKey]) => (
              <article className="legal-section" key={titleKey}>
                <h2>{t(titleKey)}</h2>
                <p>{t(bodyKey)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default ContactPage;
