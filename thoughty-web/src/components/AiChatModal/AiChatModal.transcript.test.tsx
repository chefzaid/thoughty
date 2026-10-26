import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal from './AiChatModal';
import type { Entry } from '../../types';
import { getTranslation, type Language, type TranslationParams } from '../../utils/translations';

const entry: Entry = {
  id: 7,
  content: 'A walk by the river.',
  date: '2025-03-02',
  tags: ['nature', 'calm'],
  visibility: 'private',
  is_favorite: false,
  format: 'plain',
  attachments: [],
  diary_name: 'Default',
};

const history = [
  { role: 'user' as const, content: 'What stands out?' },
  { role: 'assistant' as const, content: 'The quiet.' },
];

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the transcript'));
    reader.readAsText(blob);
  });
}

async function exportTranscript(language: Language, chatEntry: Entry): Promise<string> {
  const user = userEvent.setup();
  const t = (key: string, params?: TranslationParams) => getTranslation(language, key, params);
  render(
    <AiChatModal
      entry={chatEntry}
      isOpen
      onClose={vi.fn()}
      onSend={vi.fn()}
      onLoadHistory={vi.fn().mockResolvedValue(history)}
      t={t}
    />,
  );

  await screen.findByText('The quiet.');
  await user.click(screen.getByRole('button', { name: t('exportChatHistory') }));

  const createObjectURL = vi.mocked(globalThis.URL.createObjectURL);
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce());
  return readBlob(createObjectURL.mock.calls[0]?.[0] as Blob);
}

describe('AiChatModal transcript download', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:chat-export');
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('writes the transcript in English for an English profile', async () => {
    const text = await exportTranscript('en', entry);

    expect(text).toBe([
      'Thoughty AI Chat Transcript',
      '',
      'Entry ID: 7',
      'Date: 2025-03-02',
      'Tags: nature, calm',
      '',
      'Entry:',
      'A walk by the river.',
      '',
      'Conversation:',
      '',
      'User:',
      'What stands out?',
      '',
      'Assistant:',
      'The quiet.',
    ].join('\n'));
  });

  it('writes the transcript in French for a French profile', async () => {
    const text = await exportTranscript('fr', entry);

    expect(text).toBe([
      'Transcription du chat IA de Thoughty',
      '',
      'ID de l’entrée : 7',
      'Date : 2025-03-02',
      'Tags : nature, calm',
      '',
      'Entrée :',
      'A walk by the river.',
      '',
      'Conversation :',
      '',
      'Utilisateur :',
      'What stands out?',
      '',
      'Assistant :',
      'The quiet.',
    ].join('\n'));
  });

  it.each([
    ['en', 'Tags: None'],
    ['fr', 'Tags : aucun'],
  ] as const)('says the entry has no tags in the profile language (%s)', async (language, expected) => {
    const text = await exportTranscript(language, { ...entry, tags: [] });

    expect(text.split('\n')[4]).toBe(expected);
  });
});
