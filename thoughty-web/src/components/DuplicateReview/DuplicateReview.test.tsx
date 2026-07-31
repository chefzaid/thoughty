import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DuplicateReview from './DuplicateReview';

const scanResult = {
  analyzedEntries: 2,
  totalEntries: 45,
  truncated: true,
  groups: [{
    confidence: 92,
    reason: 'Both entries reach the same decision about changing jobs.',
    entries: [{
      id: 11,
      date: '2026-01-01',
      index: 1,
      diaryId: 4,
      content: 'I decided to accept the new role.',
      tags: ['career'],
    }, {
      id: 12,
      date: '2026-01-02',
      index: 2,
      diaryId: 4,
      content: 'The new job is the right choice.',
      tags: ['career', 'decision'],
    }],
  }],
};

const t = (key: string, params?: Record<string, string | number>) => (
  params ? `${key}:${Object.values(params).join('/')}` : key
);

describe('DuplicateReview', () => {
  it('scans the active diary and routes deletion through the provided confirmation action', async () => {
    const user = userEvent.setup();
    const onFindDuplicates = vi.fn().mockResolvedValue(scanResult);
    const onDelete = vi.fn();
    render(
      <DuplicateReview
        diaryId={4}
        theme="dark"
        t={t}
        onFindDuplicates={onFindDuplicates}
        onDelete={onDelete}
        onNavigateToEntry={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'findDuplicates' });
    await user.click(trigger);

    expect(onFindDuplicates).toHaveBeenCalledWith(4);
    expect(await screen.findByText(scanResult.groups[0]!.reason)).toBeVisible();
    expect(screen.getByText('duplicateScanCount:2/45')).toBeVisible();
    expect(screen.getByText('duplicateScanLimited')).toBeVisible();
    expect(screen.getByRole('button', { name: 'close' })).toHaveFocus();

    await user.click(screen.getAllByRole('button', { name: 'deleteDuplicateEntry' })[0]!);

    expect(onDelete).toHaveBeenCalledWith(11);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('opens a matched entry and closes on Escape', async () => {
    const user = userEvent.setup();
    const onNavigateToEntry = vi.fn();
    render(
      <DuplicateReview
        diaryId={null}
        t={t}
        onFindDuplicates={vi.fn().mockResolvedValue(scanResult)}
        onDelete={vi.fn()}
        onNavigateToEntry={onNavigateToEntry}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'findDuplicates' }));
    await user.click(await screen.findAllByRole('button', { name: 'openDuplicateEntry' }).then(
      (buttons) => buttons[1]!,
    ));
    expect(onNavigateToEntry).toHaveBeenCalledWith('2026-01-02', 2);

    await user.click(screen.getByRole('button', { name: 'findDuplicates' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows retrying a failed scan and reports an empty result', async () => {
    const user = userEvent.setup();
    const onFindDuplicates = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ analyzedEntries: 1, totalEntries: 1, truncated: false, groups: [] });
    render(
      <DuplicateReview
        diaryId={1}
        t={t}
        onFindDuplicates={onFindDuplicates}
        onDelete={vi.fn()}
        onNavigateToEntry={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'findDuplicates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('duplicateScanError');
    await user.click(screen.getByRole('button', { name: 'tryAgain' }));

    expect(await screen.findByText('noDuplicatesFound')).toBeVisible();
    expect(onFindDuplicates).toHaveBeenCalledTimes(2);
  });

  it('shows in-flight state, traps focus, and closes from the backdrop', async () => {
    const user = userEvent.setup();
    let resolveScan!: (value: typeof scanResult) => void;
    const pendingScan = new Promise<typeof scanResult>((resolve) => {
      resolveScan = resolve;
    });
    render(
      <DuplicateReview
        diaryId={null}
        theme="light"
        t={t}
        onFindDuplicates={vi.fn().mockReturnValue(pendingScan)}
        onDelete={vi.fn()}
        onNavigateToEntry={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'findDuplicates' }));
    expect(screen.getByText('scanningDuplicates')).toBeVisible();
    resolveScan(scanResult);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('light');
    const closeButton = screen.getByRole('button', { name: 'close' });
    const deleteButtons = screen.getAllByRole('button', { name: 'deleteDuplicateEntry' });
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(deleteButtons.at(-1)).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.click(document.querySelector('.duplicate-review-backdrop')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
