import type { YearReview, YearReviewMood as YearMood } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { monthName } from '../../utils/calendarNames';
import { feelingLabel, moodLabelKey, nearestMoodLevel } from '../../utils/entryMood';
import type { Language } from '../../utils/translations';
import { countPhrase } from './yearReviewFormat';
import './YearReviewMood.css';

const WIDTH = 720;
const HEIGHT = 150;
const COLUMN = WIDTH / 12;

type RecordedMood = NonNullable<YearReview['recordedMood']>;

/** One point of the arc: the month (`YYYY-MM`), its valence from -2 to 2, and what it reads as. */
interface ArcPoint {
  readonly month: string;
  readonly valence: number;
  readonly label: string;
}

interface YearReviewMoodProps {
  readonly mood: YearMood | null;
  /** Moods the writer recorded that year; when present, the arc is drawn from them, without AI. */
  readonly recordedMood?: RecordedMood | null;
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
function segments(readings: readonly ArcPoint[]): Array<Array<[number, number]>> {
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

function MoodChart({ points, labelKey, language, t }: Readonly<{ points: readonly ArcPoint[]; labelKey: string; language: Language; t: TranslationFunction }>) {
  const described = points.map((reading) => `${monthName(Number(reading.month.slice(5, 7)), language)}: ${reading.label}`).join(', ');
  return (
    <>
      <svg className="review-mood-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t(labelKey, { moods: described })}>
        <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="review-mood-axis" />
        {segments(points).map((run) => (
          <polyline key={run.map((point) => point.join(',')).join(' ')} points={run.map((point) => point.join(',')).join(' ')} className="review-mood-line" />
        ))}
        {points.map((reading) => {
          const [x, y] = pointFor(Number(reading.month.slice(5, 7)), reading.valence);
          return <circle key={reading.month} cx={x} cy={y} r="6" className="review-mood-point" />;
        })}
      </svg>
      <ol className="review-mood-months" aria-hidden="true">
        {points.map((reading) => (
          <li key={reading.month}>
            <span className="review-mood-month">{monthName(Number(reading.month.slice(5, 7)), language, 'short')}</span>
            <span>{reading.label}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function formatAverage(value: number, language: Language): string {
  return value.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** The arc from the moods the writer recorded: no AI, nothing sent anywhere. */
function RecordedMoodArc({ recorded, language, t }: Readonly<{ recorded: RecordedMood; language: Language; t: TranslationFunction }>) {
  // Recorded moods run from 1 to 5; the arc is drawn from -2 to 2 around "Okay"
  const points = recorded.months.map((month) => ({
    month: month.month,
    valence: month.average - 3,
    label: t(moodLabelKey(nearestMoodLevel(month.average))),
  }));
  const feelings = recorded.topFeelings.map((feeling) => feelingLabel(feeling.feeling, t)).join(', ');

  return (
    <>
      <p className="review-mood-source review-mood-source-recorded">{t('reviewMoodRecordedSource')}</p>
      <p className="review-mood-summary">
        {t('reviewMoodRecordedSummary', {
          average: formatAverage(recorded.average, language),
          label: t(moodLabelKey(nearestMoodLevel(recorded.average))),
          entries: countPhrase(t, 'reviewEntries', recorded.entries, language),
        })}
      </p>
      <MoodChart points={points} labelKey="reviewMoodRecordedChartLabel" language={language} t={t} />
      {feelings && <p className="review-note">{t('reviewMoodRecordedFeelings', { feelings })}</p>}
    </>
  );
}

/**
 * The mood arc. When the writer recorded moods that year it is drawn from them, without AI;
 * otherwise AI reads it from a sample of entries, only when the writer asks.
 */
function YearReviewMood({ mood, recordedMood = null, aiAvailable, reading, failed, onRead, language, t }: YearReviewMoodProps) {
  if (recordedMood) {
    return (
      <section className="review-card review-mood" aria-labelledby="review-mood-heading">
        <h2 id="review-mood-heading">{t('reviewMoodTitle')}</h2>
        <RecordedMoodArc recorded={recordedMood} language={language} t={t} />
      </section>
    );
  }

  const generatedOn = mood
    ? new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(new Date(mood.generatedAt))
    : '';

  return (
    <section className="review-card review-mood" aria-labelledby="review-mood-heading">
      <h2 id="review-mood-heading">{t('reviewMoodTitle')}</h2>
      {mood ? (
        <>
          <p className="review-mood-source">{t('reviewMoodAiSource')}</p>
          <p className="review-mood-summary">{mood.summary}</p>
          <MoodChart
            points={mood.months.map((month) => ({ month: month.month, valence: month.valence, label: month.mood }))}
            labelKey="reviewMoodChartLabel"
            language={language}
            t={t}
          />
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
      <p className="review-note review-print-hidden">{t('reviewMoodRecordHint')}</p>
    </section>
  );
}

export default YearReviewMood;
