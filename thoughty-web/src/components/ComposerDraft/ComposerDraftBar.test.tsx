import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import EntryForm from '../EntryForm/EntryForm';
import { getTranslation } from '../../utils/translations';
import { composerDraftSyncMock } from './composerDraft.test-helpers';
import { ComposerDraftOfferBar, ComposerDraftStatusText } from './ComposerDraftBar';
import { formatDraftTime } from './formatDraftTime';
import type { ComposerDraft } from '../../services/api/composerDraftService';

const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
const saved: ComposerDraft = {
  text: 'We walked along the river until the light went, and ![the bridge](attachment:3) came into view',
  title: null, tags: [], format: 'markdown', mood: null, feelings: [], revision: 4, updatedAt: '2026-11-14T18:05:00.000Z',
};

describe('ComposerDraftOfferBar', () => {
  it('offers a draft from another device to continue or discard, its start blurred with the privacy blur', async () => {
    const draft = composerDraftSyncMock({ offer: { kind: 'restore', draft: saved } });
    const user = userEvent.setup();
    render(<ComposerDraftOfferBar draft={draft} composerEmpty language="en" t={en} />);

    const offer = screen.getByRole('group', { name: `Continue your draft from ${formatDraftTime(saved.updatedAt, 'en')}?` });
    const excerpt = screen.getByText(/We walked along the river/);
    expect(excerpt).toHaveClass('privacy-text');
    expect(excerpt).toHaveTextContent('came into view');
    expect(offer).not.toHaveTextContent('attachment:');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(draft.takeSavedDraft).toHaveBeenCalled();
    expect(draft.discardSavedDraft).toHaveBeenCalled();
  });

  it('turns the offer into a choice once the composer holds text, and shows the title over the text', async () => {
    const draft = composerDraftSyncMock({ offer: { kind: 'restore', draft: { ...saved, title: 'By the river', text: 'x'.repeat(300) } } });
    const user = userEvent.setup();
    render(<ComposerDraftOfferBar draft={draft} composerEmpty={false} language="fr" theme="light" t={fr} />);

    expect(screen.getByText(/a été modifié sur un autre appareil/)).toBeInTheDocument();
    expect(screen.getByText('By the river')).toHaveClass('privacy-text');
    await user.click(screen.getByRole('button', { name: 'Prendre cette version' }));
    await user.click(screen.getByRole('button', { name: 'Garder cette version' }));
    expect(draft.takeSavedDraft).toHaveBeenCalled();
    expect(draft.keepThisDraft).toHaveBeenCalled();
  });

  it('cuts a long excerpt, and offers to keep or clear a draft published elsewhere', async () => {
    const long = composerDraftSyncMock({ offer: { kind: 'conflict', draft: { ...saved, text: 'word '.repeat(60) } } });
    const { unmount } = render(<ComposerDraftOfferBar draft={long} composerEmpty={false} language="en" t={en} />);
    expect(screen.getByText(/…$/).textContent).toHaveLength(121);
    unmount();

    const gone = composerDraftSyncMock({ offer: { kind: 'gone', draft: null } });
    const user = userEvent.setup();
    render(<ComposerDraftOfferBar draft={gone} composerEmpty={false} language="en" t={en} />);
    expect(screen.getByText('This draft was published or discarded on another device.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep writing it' }));
    await user.click(screen.getByRole('button', { name: 'Clear it' }));
    expect(gone.keepThisDraft).toHaveBeenCalled();
    expect(gone.clearThisDraft).toHaveBeenCalled();
  });

  it('shows nothing without an offer', () => {
    const { container } = render(<ComposerDraftOfferBar draft={composerDraftSyncMock()} composerEmpty language="en" t={en} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ComposerDraftStatusText', () => {
  it.each([
    ['saving', 'Saving…'],
    ['saved', 'Draft saved'],
    ['offline', 'Offline — saved on this device'],
    ['local', 'Saved on this device; it syncs when it can'],
    ['idle', ''],
  ] as const)('says %s politely', (status, text) => {
    render(<ComposerDraftStatusText status={status} t={en} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('is in French too', () => {
    render(<ComposerDraftStatusText status="offline" theme="light" t={fr} />);
    expect(screen.getByRole('status')).toHaveTextContent('Hors ligne — enregistré sur cet appareil');
  });
});

describe('formatDraftTime', () => {
  it('gives the time alone for today and the date too before', () => {
    const now = new Date(2026, 10, 15, 20, 0);
    expect(formatDraftTime(new Date(2026, 10, 15, 9, 30).toISOString(), 'en', now)).toBe('9:30 AM');
    expect(formatDraftTime(new Date(2026, 10, 14, 9, 30).toISOString(), 'en', now)).toMatch(/Nov 14, 2026/);
    expect(formatDraftTime(new Date(2026, 10, 14, 9, 30).toISOString(), 'not a language', now)).toBeTruthy();
  });
});

describe('EntryForm draft', () => {
  it('shows the offer above the composer and the status by Save, and saves as focus leaves the form', async () => {
    const draft = composerDraftSyncMock({ status: 'saved', offer: { kind: 'restore', draft: saved } });
    const user = userEvent.setup();
    render(
      <>
        <EntryForm
          newEntryText="" setNewEntryText={() => undefined} selectedDate={new Date(2026, 10, 15)} setSelectedDate={() => undefined}
          tags={[]} setTags={() => undefined} visibility="private" setVisibility={() => undefined} format="plain"
          setFormat={() => undefined} allTags={[]} formError="" onSubmit={(event) => event.preventDefault()} t={en} draft={draft}
        />
        <button type="button">Elsewhere</button>
      </>,
    );

    expect(screen.getByTestId('composer-draft-offer')).toBeInTheDocument();
    expect(screen.getByTestId('composer-draft-status')).toHaveTextContent('Draft saved');
    await user.click(screen.getByPlaceholderText(en('whatsOnYourMind')));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(draft.flush).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(draft.flush).toHaveBeenCalledTimes(1);
  });
});
