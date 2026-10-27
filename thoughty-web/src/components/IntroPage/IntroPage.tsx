import Footer from '../Footer/Footer';
// The public page tokens and buttons come before the landing stylesheets, whose rules override them.
import './IntroPage.css';
import HeroCollage from './HeroCollage';
import LandingHeader, { type LandingActionProps } from './LandingHeader';
import {
  BookVisual,
  LandingIcon,
  LookBackVisual,
  MemoirVisual,
  WritingVisual,
  type LandingIconName,
} from './IntroVisuals';
import './IntroLanding.css';

interface IntroPageProps extends LandingActionProps {
  readonly theme?: 'light' | 'dark';
}

const PROOF_ITEMS: readonly (readonly [LandingIconName, string, string])[] = [
  ['lock', 'landingProofPrivateTitle', 'landingProofPrivateBody'],
  ['sparkles', 'landingProofAiTitle', 'landingProofAiBody'],
  ['export', 'landingProofExportTitle', 'landingProofExportBody'],
  ['access', 'landingProofAccessTitle', 'landingProofAccessBody'],
];

const PATH_ITEMS: readonly (readonly [LandingIconName, string, string, string])[] = [
  ['pen', 'landingPathJournalLabel', 'landingPathJournalTitle', 'landingPathJournalBody'],
  ['mic', 'landingPathMemoirLabel', 'landingPathMemoirTitle', 'landingPathMemoirBody'],
  ['book', 'landingPathBookLabel', 'landingPathBookTitle', 'landingPathBookBody'],
];

const SPOTLIGHTS = [
  {
    id: 'writing',
    kicker: 'landingWritingKicker',
    title: 'landingWritingTitle',
    body: 'landingWritingBody',
    points: ['landingWritingPoint1', 'landingWritingPoint2', 'landingWritingPoint3'],
    Visual: WritingVisual,
  },
  {
    id: 'memoir',
    kicker: 'landingMemoirKicker',
    title: 'landingMemoirTitle',
    body: 'landingMemoirBody',
    points: ['landingMemoirPoint1', 'landingMemoirPoint2', 'landingMemoirPoint3'],
    Visual: MemoirVisual,
  },
  {
    id: 'look-back',
    kicker: 'landingLookBackKicker',
    title: 'landingLookBackTitle',
    body: 'landingLookBackBody',
    points: ['landingLookBackPoint1', 'landingLookBackPoint2', 'landingLookBackPoint3'],
    Visual: LookBackVisual,
  },
  {
    id: 'books',
    kicker: 'landingBooksKicker',
    title: 'landingBooksTitle',
    body: 'landingBooksBody',
    points: ['landingBooksPoint1', 'landingBooksPoint2', 'landingBooksPoint3'],
    Visual: BookVisual,
  },
] as const;

const PRIVACY_ITEMS: readonly (readonly [LandingIconName, string, string])[] = [
  ['lock', 'landingPrivacyEntriesTitle', 'landingPrivacyEntriesBody'],
  ['sparkles', 'landingPrivacyAiTitle', 'landingPrivacyAiBody'],
  ['export', 'landingPrivacyExportTitle', 'landingPrivacyExportBody'],
];

const MORE_ITEMS: readonly (readonly [LandingIconName, string, string])[] = [
  ['diaries', 'landingMoreDiariesTitle', 'landingMoreDiariesBody'],
  ['search', 'landingMoreSearchTitle', 'landingMoreSearchBody'],
  ['link', 'landingMoreLinksTitle', 'landingMoreLinksBody'],
  ['mic', 'landingMoreMediaTitle', 'landingMoreMediaBody'],
  ['cloud', 'landingMoreCloudTitle', 'landingMoreCloudBody'],
  ['history', 'landingMoreHistoryTitle', 'landingMoreHistoryBody'],
  ['access', 'landingMoreAccessTitle', 'landingMoreAccessBody'],
  ['globe', 'landingMoreLanguageTitle', 'landingMoreLanguageBody'],
];

// Signed-out visitors start a journal; signed-in visitors go back to theirs.
function PrimaryAction({ isAuthenticated, onOpenJournal, onSignUp, t }: Readonly<LandingActionProps>) {
  return isAuthenticated ? (
    <button type="button" className="intro-btn primary" onClick={onOpenJournal}>
      {t('landingOpenJournal')}
    </button>
  ) : (
    <button type="button" className="intro-btn primary" onClick={onSignUp}>
      {t('landingStart')}
    </button>
  );
}

function IntroPage({ theme, ...actionProps }: IntroPageProps) {
  const { isAuthenticated, onSignIn, t } = actionProps;
  const isLight = theme === 'light';

  return (
    <div className={`intro-page landing-page ${isLight ? 'light' : 'dark'}`}>
      <LandingHeader {...actionProps} />

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="intro-eyebrow">{t('landingEyebrow')}</p>
            <h1 id="landing-title">
              {t('landingHeroTitle')}{' '}
              <span className="landing-gradient-text">{t('landingHeroTitleAccent')}</span>
            </h1>
            <p className="intro-subtitle">{t('landingSubtitle')}</p>
            <div className="intro-actions">
              <PrimaryAction {...actionProps} />
              <a className="intro-btn secondary" href="#features">
                {t('landingExplore')}
              </a>
            </div>
            <p className="landing-hero-note">{t('landingHeroNote')}</p>
          </div>
          <HeroCollage t={t} />
        </section>

        <ul className="landing-proof">
          {PROOF_ITEMS.map(([icon, titleKey, bodyKey]) => (
            <li key={titleKey}>
              <LandingIcon name={icon} />
              <span className="landing-proof-text">
                <strong>{t(titleKey)}</strong>
                <span>{t(bodyKey)}</span>
              </span>
            </li>
          ))}
        </ul>

        <section id="features" className="landing-section landing-paths" aria-labelledby="landing-paths-title">
          <div className="section-heading">
            <p className="section-kicker">{t('landingPathsKicker')}</p>
            <h2 id="landing-paths-title">{t('landingPathsHeading')}</h2>
          </div>
          <div className="landing-path-grid">
            {PATH_ITEMS.map(([icon, labelKey, titleKey, bodyKey]) => (
              <article className="landing-path" key={titleKey}>
                <span className="landing-path-icon"><LandingIcon name={icon} /></span>
                <p className="landing-path-label">{t(labelKey)}</p>
                <h3>{t(titleKey)}</h3>
                <p>{t(bodyKey)}</p>
              </article>
            ))}
          </div>
        </section>

        {SPOTLIGHTS.map(({ id, kicker, title, body, points, Visual }, index) => (
          <section
            key={kicker}
            id={id}
            className={`landing-spotlight${index % 2 === 1 ? ' reverse' : ''}`}
            aria-labelledby={`landing-${id}-title`}
          >
            <div className="landing-spotlight-copy">
              <p className="section-kicker">{t(kicker)}</p>
              <h2 id={`landing-${id}-title`}>{t(title)}</h2>
              <p>{t(body)}</p>
              <ul className="landing-points">
                {points.map((point) => (
                  <li key={point}>
                    <LandingIcon name="check" />
                    {t(point)}
                  </li>
                ))}
              </ul>
            </div>
            <Visual t={t} />
          </section>
        ))}

        <section id="privacy" className="landing-privacy" aria-labelledby="landing-privacy-title">
          <div className="section-heading">
            <p className="section-kicker">{t('landingPrivacyKicker')}</p>
            <h2 id="landing-privacy-title">{t('landingPrivacyTitle')}</h2>
          </div>
          <div className="landing-privacy-grid">
            {PRIVACY_ITEMS.map(([icon, titleKey, bodyKey]) => (
              <article key={titleKey}>
                <LandingIcon name={icon} />
                <h3>{t(titleKey)}</h3>
                <p>{t(bodyKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-import" aria-labelledby="landing-import-title">
          <span className="landing-import-icon"><LandingIcon name="import" /></span>
          <div>
            <h2 id="landing-import-title">{t('landingImportTitle')}</h2>
            <p>{t('landingImportBody')}</p>
          </div>
          <PrimaryAction {...actionProps} />
        </section>

        <section className="landing-section landing-more" aria-labelledby="landing-more-title">
          <div className="section-heading">
            <p className="section-kicker">{t('landingMoreKicker')}</p>
            <h2 id="landing-more-title">{t('landingMoreHeading')}</h2>
          </div>
          <div className="landing-more-grid">
            {MORE_ITEMS.map(([icon, titleKey, bodyKey]) => (
              <article key={titleKey}>
                <LandingIcon name={icon} />
                <h3>{t(titleKey)}</h3>
                <p>{t(bodyKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta" aria-labelledby="landing-cta-title">
          <p className="section-kicker">{t('landingCtaKicker')}</p>
          <h2 id="landing-cta-title">{t('landingCtaTitle')}</h2>
          <p>{t('landingCtaBody')}</p>
          <div className="intro-actions compact">
            <PrimaryAction {...actionProps} />
            {!isAuthenticated && (
              <button type="button" className="intro-btn secondary" onClick={onSignIn}>
                {t('signIn')}
              </button>
            )}
          </div>
        </section>
      </main>

      <Footer t={t} theme={isLight ? 'light' : 'dark'} />
    </div>
  );
}

export default IntroPage;
