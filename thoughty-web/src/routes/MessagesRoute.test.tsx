import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { withFeatureFlags } from '../test/featureFlags';
import { getTranslation } from '../utils/translations';
import MessagesRoute from './MessagesRoute';

vi.mock('../components/Messages/MessagesPage', () => ({
  default: ({ conversationId, onOpenConversation }: { conversationId: number | null; onOpenConversation: (id: number | null) => void }) => (
    <>
      <p>open {String(conversationId)}</p>
      <button type="button" onClick={() => onOpenConversation(12)}>open 12</button>
      <button type="button" onClick={() => onOpenConversation(null)}>close</button>
    </>
  ),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

function Location() {
  return <output>{useLocation().search}</output>;
}

function renderAt(path: string, flags = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MessagesRoute t={t} />
      <Location />
    </MemoryRouter>,
    { wrapper: withFeatureFlags(flags) },
  );
}

describe('MessagesRoute', () => {
  it('opens the conversation in the address, and keeps the one opened there', () => {
    renderAt('/messages?conversation=7');
    expect(screen.getByText('open 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'open 12' }));
    expect(screen.getByRole('status')).toHaveTextContent('?conversation=12');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it.each(['/messages', '/messages?conversation=abc', '/messages?conversation=-2', '/messages?conversation=1.5'])(
    'opens no conversation at %s',
    (path) => {
      renderAt(path);
      expect(screen.getByText('open null')).toBeInTheDocument();
    },
  );

  it('says that sharing is paused instead of asking for messages', () => {
    renderAt('/messages?conversation=7', { publicSharing: false });

    expect(screen.getByRole('heading', { level: 1, name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Sharing is turned off for now');
    expect(screen.queryByText('open 7')).not.toBeInTheDocument();
  });
});
