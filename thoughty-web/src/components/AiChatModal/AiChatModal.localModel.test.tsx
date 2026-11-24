import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal from './AiChatModal';
import { DiaryAiContext } from '../DiaryAi/diaryAiScope';
import { getTranslation } from '../../utils/translations';
import type { Entry } from '../../types';

const entry: Entry = { id: 4, content: 'A letter to my sister', date: '2025-01-15', tags: [], visibility: 'private', diary_id: 2 };
const t = (key: string) => getTranslation('en', key);
const diaries = [{ id: 1, aiMode: 'on' as const }, { id: 2, aiMode: 'local' as const }];

function renderChat(onSend = vi.fn(), chatEntry = entry) {
  const onLoadHistory = vi.fn().mockResolvedValue([{ role: 'user', content: 'Kept in this browser' }]);
  render(
    <DiaryAiContext.Provider value={diaries}>
      <AiChatModal entry={chatEntry} isOpen onClose={vi.fn()} onSend={onSend} onLoadHistory={onLoadHistory} t={t} />
    </DiaryAiContext.Provider>,
  );
  return { onLoadHistory };
}

describe('AiChatModal in a diary on the writer’s own model', () => {
  it('says the chat goes to that model and stays in this browser, with the history kept there', async () => {
    const { onLoadHistory } = renderChat();

    expect(await screen.findByText('Kept in this browser')).toBeInTheDocument();
    expect(onLoadHistory).toHaveBeenCalledWith(4, 2);
    expect(screen.getByRole('note')).toHaveTextContent('This chat goes to your own model and is kept only in this browser, never on Thoughty’s server.');
  });

  it('says why that model gave no reply', async () => {
    renderChat(vi.fn().mockResolvedValue({ problem: 'localModelBlocked' }));

    const input = await screen.findByRole('textbox', { name: t('aiChatMessageLabel') });
    await screen.findByText('Kept in this browser');
    await userEvent.type(input, 'Why?{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Your model server answered but does not allow this site.');
  });

  it('says nothing of this browser for an entry of a diary with AI on', async () => {
    renderChat(vi.fn(), { ...entry, diary_id: 1 });

    await screen.findByText('Kept in this browser');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
