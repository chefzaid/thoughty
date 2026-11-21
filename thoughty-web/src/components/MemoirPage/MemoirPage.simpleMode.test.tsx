import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeDiary } from '../../test/diaryFixture';
import { memoirOverview } from '../../test/memoirFixture';
import { createTestQueryClient } from '../../test/queryClient';
import MemoirPage, { type MemoirPageProps } from './MemoirPage';

const memoirService = { fetchOverview: vi.fn(), leave: vi.fn() };
const lifeErasService = { list: vi.fn() };
vi.mock('../../hooks/useMemoirService', () => ({ useMemoirService: () => memoirService }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => lifeErasService }));

const t = (key: string) => key;

function renderPage(props: Partial<MemoirPageProps> = {}) {
  const handlers = {
    onOpenEntry: vi.fn(),
    onOpenBook: vi.fn(),
    onDiariesChanged: vi.fn(),
    onSimpleModeChange: vi.fn().mockResolvedValue(true),
    onOpenSimpleMode: vi.fn(),
  };
  const { rerender } = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoirPage diaries={[makeDiary({ id: 6, name: 'My memoir' })]} t={t} {...handlers} {...props} />
    </QueryClientProvider>,
  );
  return { ...handlers, rerender };
}

const simpleCard = async () => (await screen.findByRole('heading', { name: 'memoirSimpleModeTitle' })).closest('section')!;

describe('MemoirPage simple mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoirService.fetchOverview.mockResolvedValue({ data: memoirOverview(), error: null });
    lifeErasService.list.mockResolvedValue({ data: { lifeEras: [], limit: 100 }, error: null });
  });

  it('turns simple mode on and off, and opens the simple screen', async () => {
    const { onSimpleModeChange, onOpenSimpleMode } = renderPage();
    const card = await simpleCard();

    const setting = within(card).getByLabelText('memoirSimpleModeSetting');
    expect(setting).not.toBeChecked();
    expect(setting).toHaveAccessibleDescription('memoirSimpleModeDescription');
    let finishSave: (saved: boolean) => void = () => {};
    onSimpleModeChange.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishSave = resolve; }));
    fireEvent.click(setting);
    expect(onSimpleModeChange).toHaveBeenCalledWith(true);
    // Shown at once while it saves, then the saved setting again once the save is refused
    expect(setting).toBeChecked();
    expect(setting).toBeDisabled();
    await act(async () => finishSave(false));
    expect(setting).not.toBeChecked();
    expect(setting).toBeEnabled();

    fireEvent.click(within(card).getByRole('button', { name: 'memoirSimpleModeOpen' }));
    expect(onOpenSimpleMode).toHaveBeenCalled();
  });

  it('shows the setting on while simple mode is on, and turns it off when the memoir stops', async () => {
    memoirService.leave.mockResolvedValue({ data: { success: true }, error: null });
    const { onSimpleModeChange } = renderPage({ simpleMode: true });
    const card = await simpleCard();
    expect(within(card).getByLabelText('memoirSimpleModeSetting')).toBeChecked();

    memoirService.fetchOverview.mockResolvedValue({ data: memoirOverview(null), error: null });
    fireEvent.click(screen.getByRole('button', { name: 'memoirLeave' }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'memoirLeave' }).at(-1)!);
    });
    await waitFor(() => expect(onSimpleModeChange).toHaveBeenCalledWith(false));
    expect(await screen.findByRole('heading', { name: 'memoirIntroTitle' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'memoirSimpleModeTitle' })).not.toBeInTheDocument();
  });

  it('leaves simple mode alone when a memoir stops without it', async () => {
    memoirService.leave.mockResolvedValue({ data: { success: true }, error: null });
    const { onSimpleModeChange } = renderPage();
    await simpleCard();

    fireEvent.click(screen.getByRole('button', { name: 'memoirLeave' }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'memoirLeave' }).at(-1)!);
    });
    await waitFor(() => expect(memoirService.leave).toHaveBeenCalled());
    expect(onSimpleModeChange).not.toHaveBeenCalled();
  });

  it('offers no simple mode card without a way to save it', async () => {
    renderPage({ onSimpleModeChange: undefined });
    expect(await screen.findByRole('heading', { name: 'memoirSettings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'memoirSimpleModeTitle' })).not.toBeInTheDocument();
  });
});
