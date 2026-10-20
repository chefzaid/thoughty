import type { YearReviewMood as YearMood } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { monthName } from '../../utils/calendarNames';
import type { Language } from '../../utils/translations';
import { countPhrase } from './yearReviewFormat';
import './YearReviewMood.css';

const WIDTH = 720;
const HEIGHT = 150;
const COLUMN = WIDTH / 12;

interface YearReviewMoodProps {
  readonly mood: YearMood | null;
  readonly aiAvailable: boolean;
  readonly reading: boolean;
  readonly failed: boolean;
  readonly onRead: () => void;
  readonly language: Language;
  readonly t: TranslationFunction;
}

function pointFor(month: number, valence: number): [number, number] {
  return [(month - 1) * COLUMN + COLUMN / 2, HEIGHT / 2 - valence * (HEIGHT / 5)];
}

/** Runs of consecutive months, so a month without a reading leaves a gap in the line. */
function segments(readings: YearMood['months']): Array<Array<[number, number]>> {
  const runs: Array<Array<[number, number]>> = [];
  let previousMonth = -1;
  for (const reading of readings) {
    const month = Number(reading.month.slice(5, 7));
    if (month !== previousMonth + 1 || runs.length === 0) {
      runs.push([]);
    }
    runs.at(-1)?.push(pointFor(month, reading.valence));
    previousMonth = month;
  }
  return runs;
}

function MoodChart({ mood, language, t }: Readonly<{ mood: YearMood; language: Language; t: TranslationFunction }>) {
  const described = mood.months.map((reading) => `${monthName(Number(reading.month.slice(5, 7)), language)}: ${reading.mood}`).join(', ');
  return (
    <>
      <svg className="review-mood-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t('reviewMoodChartLabel', { moods: described })}>
        <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="review-mood-axis" />
        {segments(mood.months).map((run) => (
          <polyline key={run.map((point) => point.join(',')).join(' ')} points={run.map((point) => point.join(',')).join(' ')} className="review-mood-line" />
        ))}
        {mood.months.map((reading) => {
          const [x, y] = pointFor(Number(reading.month.slice(5, 7)), reading.valence);
          return <circle key={reading.month} cx={x} cy={y} r="6" className="review-mood-point" />;
        })}
      </svg>
      <ol className="review-mood-months" aria-hidden="true">
        {mood.months.map((reading) => (
          <li key={reading.month}>
            <span className="review-mood-month">{monthName(Number(reading.month.slice(5, 7)), language, 'short')}</span>
            <span>{reading.mood}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** The mood arc, read with AI only when the writer asks. */
function YearReviewMood({ mood, aiAvailable, reading, failed, onRead, language, t }: YearReviewMoodProps) {
  const generatedOn = mood
    ? new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(mood.generatedAt))
    : '';

  return (
    <section className="review-card review-mood" aria-labelledby="review-mood-heading">
      <h2 id="review-mood-heading">{t('reviewMoodTitle')}</h2>
      {mood ? (
        <>
          <p className="review-mood-summary">{mood.summary}</p>
          <MoodChart mood={mood} language={language} t={t} />
          <p className="review-note">
            {t('reviewMoodGenerated', { date: generatedOn, entries: countPhrase(t, 'reviewEntries', mood.analyzedEntries, language) })}
          </p>
        </>
      ) : (
        <p className="review-note">{t('reviewMoodIntro')}</p>
      )}

      {aiAvailable ? (
        <>
          <p className="review-note review-privacy review-print-hidden">{t('reviewMoodPrivacy')}</p>
          <div className="review-actions review-print-hidden">
            <button type="button" className={mood ? 'review-secondary' : 'review-primary'} disabled={reading} onClick={onRead}>
              {reading ? t('reviewMoodReading') : t(mood ? 'reviewMoodAgain' : 'reviewMoodAction')}
            </button>
          </div>
        </>
      ) : (
        <p className="review-note review-print-hidden">{t('reviewMoodUnavailable')}</p>
      )}
      {failed && <p className="review-error" role="alert">{t('reviewMoodError')}</p>}
    </section>
  );
}

export default YearReviewMood;
