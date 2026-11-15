import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Attachment } from '../../types';
import { withFeatureFlags } from '../../test/featureFlags';
import { getTranslation } from '../../utils/translations';
import AudioTranscript from '../AttachmentDisplay/AudioTranscript';
import { BulkActionBar } from '../EntriesList/BulkActionBar';
import EntryForm from '../EntryForm/EntryForm';
import FilterControls from '../FilterControls/FilterControls';
import { RouteActions } from '../ImportExport/ImportExportPanels';
import MemoirProgress from '../MemoirPage/MemoirProgress';
import FeatureOffSection from '../ProfilePage/FeatureOffSection';
import YearReviewMood from '../YearReview/YearReviewMood';

vi.mock('../TagPicker/TagPicker', () => ({ default: () => <div data-testid="tag-picker" /> }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const aiOff = withFeatureFlags({ ai: false });

describe('with AI switched off', () => {
  it('leaves the AI buttons out of the composer', () => {
    render(
      <EntryForm
        newEntryText="Some words"
        setNewEntryText={vi.fn()}
        selectedDate={new Date('2024-01-15')}
        setSelectedDate={vi.fn()}
        tags={[]}
        setTags={vi.fn()}
        visibility="private"
        setVisibility={vi.fn()}
        format="plain"
        setFormat={vi.fn()}
        allTags={[]}
        formError=""
        onSuggestTags={vi.fn()}
        onFixWriting={vi.fn()}
        onGetInspiration={vi.fn()}
        onSubmit={vi.fn()}
        theme="dark"
        t={t}
      />,
      { wrapper: aiOff },
    );

    expect(screen.queryByRole('button', { name: new RegExp(t('suggestTags')) })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(t('fixWriting')) })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(t('getInspired')) })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(t('save')) })).toBeInTheDocument();
  });

  it('offers no AI rephrase in bulk', () => {
    render(
      <BulkActionBar selectedCount={2} allTags={[]} tagMetadata={{}} diaries={[]} isDark language="en" onBulkAction={vi.fn()} onClearSelection={vi.fn()} t={t} />,
      { wrapper: aiOff },
    );

    expect(screen.queryByRole('button', { name: t('bulkRephrase') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('bulkMakeBook') })).toBeInTheDocument();
  });

  it('offers only word search, and brings a meaning search back to it', () => {
    const setSearchMode = vi.fn();
    render(
      <FilterControls
        search="calm"
        setSearch={vi.fn()}
        searchMode="semantic"
        setSearchMode={setSearchMode}
        searchSort="relevance"
        setSearchSort={vi.fn()}
        semanticSearchStatus="idle"
        semanticSearchResult={null}
        onSemanticSearch={vi.fn()}
        filterTags={[]}
        setFilterTags={vi.fn()}
        filterDateObj={null}
        setFilterDateObj={vi.fn()}
        filterVisibility="all"
        setFilterVisibility={vi.fn()}
        filterFavorites={false}
        setFilterFavorites={vi.fn()}
        filterArchiveStatus="active"
        setFilterArchiveStatus={vi.fn()}
        filterMood=""
        setFilterMood={vi.fn()}
        filterEraId={null}
        setFilterEraId={vi.fn()}
        filterPersonId={null}
        setFilterPersonId={vi.fn()}
        allTags={[]}
        setPage={vi.fn()}
        onOpenHighlights={vi.fn()}
        theme="dark"
        t={t}
      />,
      { wrapper: aiOff },
    );

    expect(screen.queryByRole('group', { name: t('searchMode') })).not.toBeInTheDocument();
    expect(setSearchMode).toHaveBeenCalledWith('keyword');
  });

  it('offers no transcription for a recording, and still shows a transcript already made', () => {
    const recording: Attachment = { id: 3, original_filename: 'voice.mp3', stored_filename: 'voice.mp3', mimetype: 'audio/mpeg', size: 10 };
    const { container } = render(
      <AudioTranscript attachment={recording} attachmentsService={{} as never} isDark t={t} />,
      { wrapper: aiOff },
    );
    expect(container).toBeEmptyDOMElement();

    render(
      <AudioTranscript attachment={{ ...recording, transcript: 'Said before' }} attachmentsService={{} as never} isDark t={t} />,
      { wrapper: aiOff },
    );
    expect(screen.getByText('Said before')).toBeInTheDocument();
  });

  it('says in the year in review that the AI reading of the mood is off, instead of offering it', () => {
    render(
      <YearReviewMood mood={null} aiAvailable reading={false} failed={false} onRead={vi.fn()} language="en" t={t} />,
      { wrapper: aiOff },
    );

    expect(screen.queryByRole('button', { name: t('reviewMoodAction') })).not.toBeInTheDocument();
    expect(screen.getByText(t('featureOffAi'))).toBeInTheDocument();
  });

  it('shows a switched-off profile section with its title and a note', () => {
    render(<FeatureOffSection title={t('aiConfiguration')} message="featureOffAi" isDark t={t} />);

    expect(screen.getByRole('heading', { level: 2, name: t('aiConfiguration') })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('your AI settings are kept');
  });
});

describe('with the book converter switched off', () => {
  const bookOff = withFeatureFlags({ bookConverter: false });

  it('leaves out the book route, the memoir’s book and the bulk book', () => {
    const onSelectSection = vi.fn();
    render(<RouteActions activeSection="export" onSelectSection={onSelectSection} showBook={false} t={t} />);
    expect(screen.queryByRole('button', { name: t('book') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('import') }));
    expect(onSelectSection).toHaveBeenCalledWith('import');

    render(
      <MemoirProgress progress={{ answered: 1, total: 2, words: 10, estimatedPages: 1 }} chapters={[]} language="en" canMakeBook onMakeBook={vi.fn()} t={t} />,
      { wrapper: bookOff },
    );
    expect(screen.queryByRole('button', { name: t('memoirMakeBook') })).not.toBeInTheDocument();

    render(
      <BulkActionBar selectedCount={1} allTags={[]} tagMetadata={{}} diaries={[]} isDark language="en" onBulkAction={vi.fn()} onClearSelection={vi.fn()} t={t} />,
      { wrapper: bookOff },
    );
    expect(screen.queryByRole('button', { name: t('bulkMakeBook') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('bulkRephrase') })).toBeInTheDocument();
  });
});
