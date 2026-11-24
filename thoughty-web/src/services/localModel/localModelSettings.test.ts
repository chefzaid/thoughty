import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetLocalModelKeys,
  parseLocalModelAddress,
  readLocalModelSettings,
  removeLocalModelSettings,
  writeLocalModelSettings,
} from './localModelSettings';

const ollama = { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '', transcriptionModel: '' };

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('local model address', () => {
  it('takes an http address on this device or any https address, without its trailing slash', () => {
    expect(parseLocalModelAddress(' http://localhost:11434/v1/ ')).toEqual({ baseUrl: 'http://localhost:11434/v1', problem: null });
    expect(parseLocalModelAddress('https://127.0.0.1:8443')).toEqual({ baseUrl: 'https://127.0.0.1:8443', problem: null });
    expect(parseLocalModelAddress('http://LOCALHOST:1234/v1')).toEqual({ baseUrl: 'http://localhost:1234/v1', problem: null });
    expect(parseLocalModelAddress('https://nas.home.example:8443/v1/')).toEqual({ baseUrl: 'https://nas.home.example:8443/v1', problem: null });
    expect(parseLocalModelAddress('https://192.168.1.20/v1')).toEqual({ baseUrl: 'https://192.168.1.20/v1', problem: null });
  });

  it('refuses what is not a plain web address, and plain http to any other device', () => {
    for (const input of ['', 'localhost:11434', 'ftp://localhost/v1', 'http://user:pass@localhost/v1', 'https://user@nas.example/v1', 'http://localhost/v1?x=1', 'https://nas.example/v1#a']) {
      expect(parseLocalModelAddress(input)).toEqual({ baseUrl: null, problem: 'localModelAddressInvalid' });
    }
    for (const input of ['http://192.168.1.20:11434/v1', 'http://api.openai.com/v1', 'http://[::1]:11434/v1', 'http://localhost.example.com/v1']) {
      expect(parseLocalModelAddress(input)).toEqual({ baseUrl: null, problem: 'localModelAddressNeedsHttps' });
    }
  });
});

describe('local model settings', () => {
  it('keeps each writer’s settings apart in this browser, and removes them', () => {
    expect(writeLocalModelSettings(7, ollama)).toBe(true);
    expect(readLocalModelSettings(7)).toEqual(ollama);
    expect(readLocalModelSettings(8)).toBeNull();
    expect(readLocalModelSettings(null)).toBeNull();

    removeLocalModelSettings(7);
    expect(readLocalModelSettings(7)).toBeNull();
  });

  it('reads settings saved before the speech-to-text model was asked, as having none', () => {
    localStorage.setItem('thoughty.localModel.7', '{"baseUrl":"http://localhost:11434/v1","model":"llama3.2","apiKey":""}');
    expect(readLocalModelSettings(7)).toEqual(ollama);

    writeLocalModelSettings(7, { ...ollama, transcriptionModel: 'whisper-1' });
    expect(readLocalModelSettings(7)?.transcriptionModel).toBe('whisper-1');
  });

  it('reads nothing from a stored value it does not recognise', () => {
    for (const stored of ['not json', '{"baseUrl":"http://localhost/v1","model":"m","apiKey":"","transcriptionModel":5}', '{"baseUrl":"http://10.0.0.2/v1","model":"m","apiKey":""}', '{"baseUrl":"https://nas.example/v1/","model":"m","apiKey":""}', '{"baseUrl":"http://localhost/v1","model":" ","apiKey":""}', 'null']) {
      localStorage.setItem('thoughty.localModel.7', stored);
      expect(readLocalModelSettings(7)).toBeNull();
    }
  });

  it('forgets every writer’s key at sign-out, keeping the address and model', () => {
    writeLocalModelSettings(7, { ...ollama, apiKey: 'secret' });
    writeLocalModelSettings(8, ollama);
    localStorage.setItem('thoughty.other', 'kept');

    forgetLocalModelKeys();

    expect(readLocalModelSettings(7)).toEqual(ollama);
    expect(readLocalModelSettings(8)).toEqual(ollama);
    expect(localStorage.getItem('thoughty.other')).toBe('kept');
  });

  it('says when the browser keeps nothing, and carries on when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(writeLocalModelSettings(7, ollama)).toBe(false);
    expect(readLocalModelSettings(7)).toBeNull();
    expect(() => removeLocalModelSettings(7)).not.toThrow();
    expect(() => forgetLocalModelKeys()).not.toThrow();
  });
});
