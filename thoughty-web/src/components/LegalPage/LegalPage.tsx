import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';

type LegalPageType = 'privacy' | 'terms';

interface LegalPageProps {
  readonly page: LegalPageType;
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
}

const LEGAL_SECTIONS: Record<LegalPageType, readonly (readonly [string, string])[]> = {
  privacy: [
    ['privacyIntroTitle', 'privacyIntroBody'],
    ['privacyDataTitle', 'privacyDataBody'],
    ['privacyControlTitle', 'privacyControlBody'],
    ['privacySecurityTitle', 'privacySecurityBody'],
  ],
  terms: [
    ['termsUseTitle', 'termsUseBody'],
    ['termsAccountTitle', 'termsAccountBody'],
    ['termsContentTitle', 'termsContentBody'],
    ['termsLimitsTitle', 'termsLimitsBody'],
  ],
};

function LegalPage({ page, theme, t, onBackHome }: Readonly<LegalPageProps>) {
  const isLight = theme === 'light';
  const titleKey = page === 'privacy' ? 'privacyTitle' : 'termsTitle';
  const subtitleKey = page === 'privacy' ? 'privacySubtitle' : 'termsSubtitle';

  return (
    <div className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <main className="legal-page">
        <section className="legal-hero">
          <p className="intro-eyebrow">{t('legalUpdatedLabel')}</p>
          <h1>{t(titleKey)}</h1>
          <p>{t(subtitleKey)}</p>
          <button type="button" className="intro-btn secondary" onClick={onBackHome}>
            {t('back')}
          </button>
        </section>

        <section className="legal-sections" aria-label={t(titleKey)}>
          {LEGAL_SECTIONS[page].map(([sectionTitleKey, sectionBodyKey]) => (
            <article className="legal-section" key={sectionTitleKey}>
              <h2>{t(sectionTitleKey)}</h2>
              <p>{t(sectionBodyKey)}</p>
            </article>
          ))}
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default LegalPage;
