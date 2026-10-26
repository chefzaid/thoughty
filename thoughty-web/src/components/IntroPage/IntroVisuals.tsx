// Decorative product illustrations for the presentation page, drawn in HTML so
// they follow the theme and the language. The text beside each one says the same.
import type { CSSProperties } from 'react';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const ICON_PATHS = {
  lock: ['M7 11V7a5 5 0 0 1 10 0v4', 'M5 11h14v10H5z'],
  sparkles: ['M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z', 'M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z'],
  export: ['M12 3v12', 'M7 8l5-5 5 5', 'M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5'],
  import: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  access: ['M12 6.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z', 'M5 8.5l7 1.5 7-1.5', 'M12 10v5', 'M8.5 21l3.5-6 3.5 6'],
  pen: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  mic: ['M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v4'],
  book: ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
  diaries: ['M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2.5z', 'M6 21h12', 'M8 7h6'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M21 21l-4.3-4.3'],
  link: ['M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5', 'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5'],
  cloud: ['M17.5 19H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.6 11a4 4 0 0 1-2.1 8z'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z'],
  check: ['M5 12l5 5L20 7'],
} as const;

export type LandingIconName = keyof typeof ICON_PATHS;

export function LandingIcon({ name }: Readonly<{ name: LandingIconName }>) {
  return (
    <svg
      className="landing-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function HeroCollage({ t }: Readonly<{ t: Translate }>) {
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

export function WritingVisual({ t }: Readonly<{ t: Translate }>) {
  return (
    <div className="landing-visual visual-focus" aria-hidden="true">
      <div className="focus-bar">
        <span>{t('focusMode')}</span>
        <kbd>Ctrl+Shift+F</kbd>
      </div>
      <div className="focus-page">
        <p className="focus-earlier">{t('landingWritingVisualText1')}</p>
        <p>
          {t('landingWritingVisualText2')}
          <span className="focus-caret" />
        </p>
      </div>
      <div className="focus-goal">
        <span>{t('focusModeGoalProgress', { written: 312, goal: 500 })}</span>
        <span className="landing-meter"><span style={{ width: '62%' }} /></span>
      </div>
    </div>
  );
}

const MEMOIR_CHAPTERS = [
  ['landingChapterChildhood', 8, 8],
  ['landingChapterGrowingUp', 6, 8],
  ['landingChapterFamily', 4, 7],
  ['landingChapterLove', 0, 7],
  ['landingChapterWork', 0, 8],
] as const;

export function MemoirVisual({ t }: Readonly<{ t: Translate }>) {
  return (
    <div className="landing-visual visual-memoir" aria-hidden="true">
      <div className="memoir-summary">
        <span className="memoir-ring" style={{ '--progress': `${(18 / 52) * 360}deg` } as CSSProperties}>
          <span>18/52</span>
        </span>
        <span className="memoir-summary-text">
          <strong>{t('landingMemoirVisualProgress')}</strong>
          <span>{t('landingMemoirVisualStats')}</span>
        </span>
      </div>
      <ul className="memoir-chapters">
        {MEMOIR_CHAPTERS.map(([key, answered, total]) => (
          <li key={key}>
            <span>{t(key)}</span>
            <span className="landing-meter"><span style={{ width: `${(answered / total) * 100}%` }} /></span>
            <span className="memoir-count">{answered}/{total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Month initials read the same in English and French.
const MOOD_BY_MONTH = [
  ['J', 52], ['F', 48], ['M', 60], ['A', 66], ['M', 72], ['J', 84],
  ['J', 90], ['A', 86], ['S', 70], ['O', 64], ['N', 58], ['D', 74],
] as const;

export function LookBackVisual({ t }: Readonly<{ t: Translate }>) {
  return (
    <div className="landing-visual visual-lookback" aria-hidden="true">
      <div className="lookback-head">
        <strong>{t('landingLookBackVisualMood')}</strong>
        <span>2026</span>
      </div>
      <div className="mood-chart">
        {MOOD_BY_MONTH.map(([month, value]) => (
          <span key={`${month}${value}`} className="mood-column">
            <span className="mood-bar" style={{ height: `${value}%` }} />
            <span className="mood-month">{month}</span>
          </span>
        ))}
      </div>
      <div className="lookback-cards">
        <div className="lookback-streak">
          <span>{t('landingLookBackVisualStreak')}</span>
          <strong>{t('landingLookBackVisualStreakValue', { count: 23 })}</strong>
        </div>
        <div className="lookback-memory">
          <span>{t('landingLookBackVisualOnThisDay')}</span>
          <p>{t('landingLookBackVisualMemory')}</p>
        </div>
      </div>
    </div>
  );
}

const BOOK_CONTENTS = [
  ['landingChapterChildhood', 1],
  ['landingChapterGrowingUp', 34],
  ['landingChapterFamily', 61],
  ['landingChapterLove', 98],
  ['landingChapterWork', 142],
] as const;

export function BookVisual({ t }: Readonly<{ t: Translate }>) {
  return (
    <div className="landing-visual visual-book" aria-hidden="true">
      <div className="book-cover">
        <img src="/thoughty-logo.svg" alt="" />
        <strong>{t('landingVisualBookTitle')}</strong>
        <span>2019 – 2026</span>
      </div>
      <div className="book-contents">
        <span className="book-contents-title">{t('landingBooksVisualContents')}</span>
        <ol>
          {BOOK_CONTENTS.map(([key, page]) => (
            <li key={key}>
              <span>{t(key)}</span>
              <span className="book-page">{page}</span>
            </li>
          ))}
        </ol>
        <div className="book-formats">
          {['PDF', 'EPUB', 'HTML', 'MD'].map((format) => <span key={format}>{format}</span>)}
        </div>
      </div>
    </div>
  );
}
