import type { MemoirChapter, MemoirProgress as Progress } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { localize, type MemoirLanguage } from './memoirFormat';

interface MemoirProgressProps {
  readonly progress: Progress;
  readonly chapters: readonly MemoirChapter[];
  readonly language: MemoirLanguage;
  readonly canMakeBook: boolean;
  readonly onMakeBook: () => void;
  readonly t: TranslationFunction;
}

function MemoirProgress({ progress, chapters, language, canMakeBook, onMakeBook, t }: MemoirProgressProps) {
  const chapterCounts = chapters.map((chapter) => ({
    id: chapter.id,
    title: localize(chapter.title, language),
    answered: chapter.questions.filter((question) => question.answer).length,
    total: chapter.questions.length,
  }));
  const chaptersStarted = chapterCounts.filter((chapter) => chapter.answered > 0).length;

  return (
    <section className="memoir-card memoir-progress" aria-labelledby="memoir-progress-heading">
      <h2 id="memoir-progress-heading">{t('memoirProgressTitle')}</h2>
      <p className="memoir-progress-summary">{t('memoirAnsweredCount', { answered: progress.answered, total: progress.total })}</p>
      <progress
        className="memoir-progress-bar"
        value={progress.answered}
        max={progress.total}
        aria-label={t('memoirAnsweredCount', { answered: progress.answered, total: progress.total })}
      />
      <dl className="memoir-stats">
        <div>
          <dt>{t('memoirWords')}</dt>
          <dd>{progress.words.toLocaleString(language)}</dd>
        </div>
        <div>
          <dt>{t('memoirPages')}</dt>
          <dd>{progress.estimatedPages}</dd>
        </div>
        <div>
          <dt>{t('memoirChaptersStarted')}</dt>
          <dd>{`${chaptersStarted} / ${chapters.length}`}</dd>
        </div>
      </dl>
      <ul className="memoir-chapter-progress">
        {chapterCounts.map((chapter) => (
          <li key={chapter.id}>
            <span>{chapter.title}</span>
            <meter
              min={0}
              max={chapter.total}
              value={chapter.answered}
              aria-label={t('memoirChapterProgress', { chapter: chapter.title, answered: chapter.answered, total: chapter.total })}
            />
            <span className="memoir-chapter-count" aria-hidden="true">{`${chapter.answered}/${chapter.total}`}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="memoir-primary" onClick={onMakeBook} disabled={!canMakeBook}>
        <span className="codicon codicon-book" aria-hidden="true" />
        {t('memoirMakeBook')}
      </button>
    </section>
  );
}

export default MemoirProgress;
