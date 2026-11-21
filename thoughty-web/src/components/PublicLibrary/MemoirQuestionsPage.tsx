import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { createMemoirService, type MemoirBankChapter } from '../../services/api';
import { getPublicPathForView, type TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { localize } from '../MemoirPage/memoirFormat';
import PublicLibraryShell from './PublicLibraryShell';

interface MemoirQuestionsPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly language: Language;
  readonly isAuthenticated?: boolean;
  readonly onSignUp: () => void;
  readonly onOpenMemoir: () => void;
  readonly onBackHome: () => void;
}

interface ChapterListProps {
  readonly chapters: readonly MemoirBankChapter[];
  readonly language: Language;
}

/** Each chapter with its questions, numbered within the chapter. */
function ChapterList({ chapters, language }: Readonly<ChapterListProps>) {
  return (
    <div className="library-chapters">
      {chapters.map((chapter) => (
        <section key={chapter.id} className="library-card" aria-labelledby={`library-chapter-${chapter.id}`}>
          <h3 id={`library-chapter-${chapter.id}`}>{localize(chapter.title, language)}</h3>
          <ol className="library-questions">
            {chapter.questions.map((question) => (
              <li key={question.id}>{localize(question.text, language)}</li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** The public page of the memoir questions: the year in life order, then the themes, and a way into the memoir. */
function MemoirQuestionsPage({ theme, t, language, isAuthenticated, onSignUp, onOpenMemoir, onBackHome }: Readonly<MemoirQuestionsPageProps>) {
  const { authFetch } = useAuth();
  const memoirService = useMemo(() => createMemoirService(authFetch), [authFetch]);
  const [chapters, setChapters] = useState<MemoirBankChapter[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void memoirService.fetchQuestionBank().then(({ data }) => {
      if (!active) return;
      if (data) setChapters(data.chapters);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [memoirService, attempt]);

  const year = chapters?.filter((chapter) => !chapter.theme) ?? [];
  const themes = chapters?.filter((chapter) => chapter.theme) ?? [];
  const yearCount = year.reduce((count, chapter) => count + chapter.questions.length, 0);

  let content = <p className="library-status" role="status">{t('questionsPageLoading')}</p>;
  if (failed) {
    content = (
      <div className="library-status" role="alert">
        <p>{t('questionsPageError')}</p>
        <button type="button" className="intro-btn secondary" onClick={() => setAttempt((value) => value + 1)}>
          {t('questionsPageRetry')}
        </button>
      </div>
    );
  } else if (chapters) {
    content = (
      <>
        <section className="landing-section" aria-labelledby="library-year-heading">
          <div className="section-heading">
            <h2 id="library-year-heading">{t('questionsPageYearTitle')}</h2>
            <p>{pluralPhrase(t, 'questionsPageYearCount', yearCount, language)}</p>
          </div>
          <ChapterList chapters={year} language={language} />
        </section>
        {themes.length > 0 && (
          <section className="landing-section" aria-labelledby="library-themes-heading">
            <div className="section-heading">
              <h2 id="library-themes-heading">{t('questionsPageThemesTitle')}</h2>
              <p>{t('questionsPageThemesHint')}</p>
            </div>
            <ChapterList chapters={themes} language={language} />
          </section>
        )}
      </>
    );
  }

  return (
    <PublicLibraryShell
      theme={theme}
      t={t}
      meta={{ title: t('questionsPageMetaTitle'), description: t('questionsPageMetaDescription') }}
      eyebrow={t('questionsPageEyebrow')}
      title={t('questionsPageTitle')}
      subtitle={t('questionsPageSubtitle')}
      action={isAuthenticated
        ? { label: t('questionsPageOpen'), onClick: onOpenMemoir }
        : { label: t('questionsPageStart'), onClick: onSignUp }}
      onBackHome={onBackHome}
      closing={{
        title: t('questionsPageCtaTitle'),
        body: t('questionsPageCtaBody'),
        linkHref: getPublicPathForView('journalTemplates'),
        linkLabel: t('questionsPageTemplatesLink'),
      }}
    >
      {content}
    </PublicLibraryShell>
  );
}

export default MemoirQuestionsPage;
