import { FormEvent, useState } from 'react';

import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';
import './ContactPage.css';

interface ContactPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
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

function ContactPage({ theme, t, onBackHome }: Readonly<ContactPageProps>) {
  const [submitted, setSubmitted] = useState(false);
  const isLight = theme === 'light';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
  }

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

          <form className="contact-form" onSubmit={handleSubmit}>
            <h2>{t('contactFormTitle')}</h2>
            <label>
              <span>{t('contactNameLabel')}</span>
              <input name="name" autoComplete="name" required />
            </label>
            <label>
              <span>{t('contactEmailLabel')}</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>{t('contactTopicLabel')}</span>
              <select name="topic" defaultValue="support" required>
                <option value="support">{t('contactTopicSupport')}</option>
                <option value="account">{t('contactTopicAccount')}</option>
                <option value="billing">{t('contactTopicBilling')}</option>
                <option value="privacy">{t('contactTopicPrivacy')}</option>
                <option value="feedback">{t('contactTopicFeedback')}</option>
              </select>
            </label>
            <label>
              <span>{t('contactMessageLabel')}</span>
              <textarea name="message" rows={5} required />
            </label>
            <button type="submit" className="intro-btn primary">
              {t('contactSubmit')}
            </button>
            {submitted ? (
              <p className="contact-success" role="status">
                <strong>{t('contactSuccessTitle')}</strong>
                <span>{t('contactSuccessBody')}</span>
              </p>
            ) : null}
          </form>
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
