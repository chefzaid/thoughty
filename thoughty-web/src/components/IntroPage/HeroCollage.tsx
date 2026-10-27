// The hero illustration: a journal entry, a memoir question and the book they become.
import { LandingIcon, type Translate } from './IntroVisuals';
import './HeroCollage.css';

export default function HeroCollage({ t }: Readonly<{ t: Translate }>) {
  return (
    <div className="hero-collage" role="img" aria-label={t('landingVisualLabel')}>
      <div className="collage-entry">
        <div className="collage-entry-head">
          <span className="collage-date">{t('landingVisualDate')}</span>
          <span className="collage-private">
            <LandingIcon name="lock" />
            {t('private')}
          </span>
        </div>
        <strong className="collage-title">{t('landingVisualTitle')}</strong>
        <div className="collage-mood">
          <span className="collage-mood-scale">
            {[1, 2, 3, 4, 5].map((level) => <span key={level} className={level <= 4 ? 'on' : undefined} />)}
          </span>
          {t('landingVisualMood')} · {t('landingVisualFeelings')}
        </div>
        <p>{t('landingVisualBody')}</p>
        <ul className="collage-tasks">
          <li className="done">
            <span className="collage-checkbox"><LandingIcon name="check" /></span>
            {t('landingVisualTaskDone')}
          </li>
          <li>
            <span className="collage-checkbox" />
            {t('landingVisualTaskOpen')}
          </li>
        </ul>
        <div className="collage-tags">
          <span>#{t('landingVisualTagFamily')}</span>
          <span>#{t('landingVisualTagSummer')}</span>
        </div>
      </div>

      <div className="collage-memoir">
        <span className="collage-memoir-label">{t('landingVisualMemoirLabel')}</span>
        <strong>{t('landingVisualMemoirQuestion')}</strong>
        <span className="collage-voice">
          <LandingIcon name="mic" />
          {t('landingVisualMemoirVoice')}
          <span className="collage-wave">
            {[40, 75, 55, 95, 60, 80, 35].map((height) => (
              <span key={height} style={{ height: `${height}%` }} />
            ))}
          </span>
        </span>
      </div>

      <div className="collage-book">
        <img src="/thoughty-logo.svg" alt="" />
        <strong>{t('landingVisualBookTitle')}</strong>
        <span>{t('landingVisualBookMeta')}</span>
        <span className="collage-book-formats">PDF · EPUB</span>
      </div>
    </div>
  );
}
