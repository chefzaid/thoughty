import { useMemo } from 'react';

import { getPublicPathForView, type TranslationFunction } from '../../types';
import { getBuiltInEntryTemplates } from '../../utils/entryTemplates';
import type { Language } from '../../utils/translations';
import { pluralPhrase } from '../../utils/pluralPhrase';
import MarkdownRenderer from '../EntryContentRenderer/MarkdownRenderer';
import PublicLibraryShell from './PublicLibraryShell';

interface JournalTemplatesPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly language: Language;
  readonly isAuthenticated?: boolean;
  readonly onSignUp: () => void;
  readonly onOpenJournal: () => void;
  readonly onBackHome: () => void;
}

/** The public page of the built-in templates: each one's prompts as a new entry shows them, and a way into the journal. */
function JournalTemplatesPage({ theme, t, language, isAuthenticated, onSignUp, onOpenJournal, onBackHome }: Readonly<JournalTemplatesPageProps>) {
  const templates = useMemo(() => getBuiltInEntryTemplates(language), [language]);

  return (
    <PublicLibraryShell
      theme={theme}
      t={t}
      meta={{ title: t('templatesPageMetaTitle'), description: t('templatesPageMetaDescription') }}
      eyebrow={t('templatesPageEyebrow')}
      title={t('templatesPageTitle')}
      subtitle={t('templatesPageSubtitle')}
      action={isAuthenticated
        ? { label: t('templatesPageOpen'), onClick: onOpenJournal }
        : { label: t('templatesPageStart'), onClick: onSignUp }}
      onBackHome={onBackHome}
      closing={{
        title: t('templatesPageCtaTitle'),
        body: t('templatesPageCtaBody'),
        linkHref: getPublicPathForView('memoirQuestions', language),
        linkLabel: t('templatesPageQuestionsLink'),
      }}
    >
      <section className="landing-section" aria-label={t('templatesPageListLabel')}>
        <div className="library-templates">
          {templates.map((template) => (
            <article key={template.id} className="library-card" aria-labelledby={`library-${template.id}`}>
              <h2 id={`library-${template.id}`}>{template.name}</h2>
              <div className="library-template-text">
                {template.format === 'markdown'
                  ? <MarkdownRenderer content={template.content} />
                  : <p>{template.content.trim()}</p>}
              </div>
              {template.sealYears !== undefined && (
                <p className="library-note">{pluralPhrase(t, 'templatesPageSeal', template.sealYears, language)}</p>
              )}
              <ul className="library-tags" aria-label={t('templatesPageTagsLabel')}>
                {template.tags.map((tag) => <li key={tag}>#{tag}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </PublicLibraryShell>
  );
}

export default JournalTemplatesPage;
