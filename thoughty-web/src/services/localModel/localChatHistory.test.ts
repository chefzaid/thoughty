import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetLocalChats, readLocalChat, writeLocalChat } from './localChatHistory';

const chat = [{ role: 'user' as const, content: 'Why the sea?' }, { role: 'assistant' as const, content: 'Tell me more.' }];

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('entry chats kept in this browser', () => {
  it('keeps each writer’s chat about each entry apart', () => {
    expect(writeLocalChat(7, 44, chat)).toBe(true);
    expect(readLocalChat(7, 44)).toEqual(chat);
    expect(readLocalChat(7, 45)).toEqual([]);
    expect(readLocalChat(8, 44)).toEqual([]);
    expect(readLocalChat(null, 44)).toEqual([]);
    expect(writeLocalChat(null, 44, chat)).toBe(false);
  });

  it('reads only the messages it recognises', () => {
    localStorage.setItem('thoughty.localModelChat.7.44', JSON.stringify([...chat, { role: 'system', content: 'x' }, { role: 'user' }, null, 'text']));
    expect(readLocalChat(7, 44)).toEqual(chat);
    localStorage.setItem('thoughty.localModelChat.7.44', '{"role":"user"}');
    expect(readLocalChat(7, 44)).toEqual([]);
    localStorage.setItem('thoughty.localModelChat.7.44', 'not json');
    expect(readLocalChat(7, 44)).toEqual([]);
  });

  it('drops every chat at sign-out and leaves the rest of this browser’s data', () => {
    writeLocalChat(7, 44, chat);
    writeLocalChat(8, 2, chat);
    localStorage.setItem('thoughty.localModel.7', 'settings');

    forgetLocalChats();

    expect(readLocalChat(7, 44)).toEqual([]);
    expect(readLocalChat(8, 2)).toEqual([]);
    expect(localStorage.getItem('thoughty.localModel.7')).toBe('settings');
  });

  it('keeps nothing, and fails nothing, when this browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    expect(writeLocalChat(7, 44, chat)).toBe(false);
    expect(readLocalChat(7, 44)).toEqual([]);
    expect(() => forgetLocalChats()).not.toThrow();
  });
});
