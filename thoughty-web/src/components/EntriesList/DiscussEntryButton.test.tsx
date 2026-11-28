import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import DiscussEntryButton from './DiscussEntryButton';
import { mockEntries } from './EntriesList.test-utils';

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => ({ fetchFollows: vi.fn().mockResolvedValue({ data: { following: [], followers: [] }, error: null }) }),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function renderButton(props: { onDiscussWithAi?: () => void; withSomeone: boolean }) {
  return render(<DiscussEntryButton entry={mockEntries[1]} isDark language="en" t={t} {...props} />, { wrapper });
}

describe('DiscussEntryButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers two choices, the AI chat and a writer, and closes the menu once one is picked', async () => {
    const user = userEvent.setup();
    const onDiscussWithAi = vi.fn();
    renderButton({ onDiscussWithAi, withSomeone: true });

    const button = screen.getByRole('button', { name: 'Discuss this entry' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Discuss this entry' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Discuss with AI' }));
    expect(onDiscussWithAi).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Discuss with someone' }));
    expect(await screen.findByRole('dialog', { name: 'Discuss with someone' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('is the AI chat alone while public sharing is off, and the writer choice alone while the AI is out', async () => {
    const user = userEvent.setup();
    const onDiscussWithAi = vi.fn();
    const { unmount } = renderButton({ onDiscussWithAi, withSomeone: false });
    await user.click(screen.getByRole('button', { name: 'Discuss with AI' }));
    expect(onDiscussWithAi).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    unmount();

    renderButton({ withSomeone: true });
    const button = screen.getByRole('button', { name: 'Discuss with someone' });
    expect(button).not.toHaveAttribute('aria-haspopup');
    await user.click(button);
    expect(await screen.findByRole('dialog', { name: 'Discuss with someone' })).toBeInTheDocument();
  });

  it('is not there with neither choice', () => {
    const { container } = renderButton({ withSomeone: false });
    expect(container).toBeEmptyDOMElement();
  });
});
