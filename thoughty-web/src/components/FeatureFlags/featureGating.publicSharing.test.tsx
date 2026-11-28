import { fireEvent, render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShareLink, ShareLinksService } from '../../services/api';
import { withFeatureFlags } from '../../test/featureFlags';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import FeedRoute from '../../routes/FeedRoute';
import { BulkActionBar } from '../EntriesList/BulkActionBar';
import NavMenu from '../NavMenu/NavMenu';
import ShareLinkDialog from '../ShareLinks/ShareLinkDialog';
import SharedLinkPage from '../SharedLink/SharedLinkPage';
import EntryForm from '../EntryForm/EntryForm';
import { useEntryForm } from '../../hooks/useEntryActions';
import { createEntriesServiceMock } from '../../hooks/useEntryActions.test-helpers';

vi.mock('../../contexts/AuthContext', async () => (await import('../../hooks/useEntryActions.test-helpers')).authContextMock());
vi.mock('../../services/api', async () => (await import('../../hooks/useEntryActions.test-helpers')).apiModuleMock());

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const sharingOff = withFeatureFlags({ publicSharing: false });

describe('with public sharing switched off', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves the feed and messages out of the navigation', () => {
    render(<NavMenu currentView="journal" onViewChange={vi.fn()} t={(key) => key} />, { wrapper: sharingOff });
    fireEvent.click(screen.getByRole('button', { name: 'navGroupSocial' }));

    expect(screen.queryByRole('button', { name: 'feed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'messages' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'people' })).toBeVisible();
  });

  it('says on the feed page that sharing is paused, instead of asking for the feed', () => {
    render(
      <MemoryRouter initialEntries={['/feed']}>
        <FeedRoute t={t} />
      </MemoryRouter>,
      { wrapper: sharingOff },
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Sharing is turned off for now: the feed and private links are paused.');
  });

  it('makes no new private link, and still lists and revokes the links already made', async () => {
    const link: ShareLink = {
      id: 7, kind: 'entry', targetId: 12, label: 'For Mum', showMood: false, showTags: false, maxViews: null, viewCount: 0,
      lastViewedAt: null, expiresAt: '2099-11-04T09:00:00.000Z', createdAt: '2026-10-28T09:00:00.000Z',
    };
    const service = {
      list: vi.fn().mockResolvedValue({ data: { links: [link], limit: 100, activeCount: 1 }, error: null }),
      create: vi.fn(),
      revoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    } satisfies ShareLinksService;
    render(
      <ShareLinkDialog isOpen target={{ kind: 'entry', id: 12 }} subject="A walk" isDark={false} language="en" service={service} onClose={vi.fn()} t={t} />,
      { wrapper: sharingOff },
    );

    expect(screen.getByRole('note')).toHaveTextContent('Sharing is turned off for now');
    expect(screen.queryByLabelText('Link expires')).not.toBeInTheDocument();
    expect(await screen.findByText('For Mum')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Revoke/ }));
    await waitFor(() => expect(service.revoke).toHaveBeenCalledWith(7));
  });

  it('offers to make entries private in bulk, not public', () => {
    render(
      <BulkActionBar selectedCount={2} allTags={[]} tagMetadata={{}} diaries={[]} isDark language="en" onBulkAction={vi.fn()} onClearSelection={vi.fn()} t={t} />,
      { wrapper: sharingOff },
    );

    expect(screen.queryByRole('button', { name: t('bulkMakePublic') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('bulkMakePrivate') })).toBeInTheDocument();
  });

  it('locks the composer on private and says why', () => {
    render(
      <EntryForm
        newEntryText=""
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
        onSubmit={vi.fn()}
        theme="dark"
        t={t}
      />,
      { wrapper: sharingOff },
    );

    const toggle = screen.getByTitle(t('featureOffPublicVisibility'));
    expect(toggle).toBeDisabled();
  });

  it('saves a new entry private even when the writer’s default is public', async () => {
    const createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 4 });
    await createEntriesServiceMock({ createEntry });
    const queryClient = createTestQueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{sharingOff({ children })}</QueryClientProvider>
    );
    const { result } = renderHook(() => useEntryForm({ defaultVisibility: 'public' }, 1, vi.fn()), { wrapper: Wrapper });

    expect(result.current.visibility).toBe('private');
    act(() => {
      result.current.setNewEntryText('Kept to myself for now');
      result.current.setTags(['quiet']);
      result.current.setVisibility('public');
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
  });

  it('tells a reader opening a link that sharing is paused, not that the link is gone', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 503, code: 'FEATURE_DISABLED', message: 'off', error: 'Service Unavailable' }), { status: 503 }),
    );
    render(<SharedLinkPage token="q3Jm0bX9vN2kR7sT1uW4yZ6aC8eG0iK2mO4qS6uW8yA" language="en" theme="light" fetchImpl={fetchImpl} />);

    expect(await screen.findByRole('heading', { name: 'Sharing is paused' })).toBeInTheDocument();
    expect(screen.getByText(/This one has not been removed/)).toBeInTheDocument();
  });
});
