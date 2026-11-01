import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    dictatedSnippet,
    dictationErrorKey,
    readNoticeSeen,
    readResults,
    saveNoticeSeen,
    speechRecognitionConstructor,
} from './speechRecognition';

class Standard {}
class Prefixed {}

describe('speechRecognitionConstructor', () => {
    it('prefers the standard name, falls back to the prefixed one, and is null without either', () => {
        expect(speechRecognitionConstructor({ SpeechRecognition: Standard, webkitSpeechRecognition: Prefixed })).toBe(Standard);
        expect(speechRecognitionConstructor({ webkitSpeechRecognition: Prefixed })).toBe(Prefixed);
        expect(speechRecognitionConstructor({})).toBeNull();
        expect(speechRecognitionConstructor({ SpeechRecognition: 'not a constructor' })).toBeNull();
    });

    it('is null in jsdom, which has no speech recognition', () => {
        expect(speechRecognitionConstructor()).toBeNull();
    });
});

describe('readResults', () => {
    const result = (transcript: string, isFinal: boolean) => ({ isFinal, length: 1, 0: { transcript } });

    it('reads only the results that changed, apart into final and interim text', () => {
        const results = [result('already written', true), result(' hello', true), result(' wor', false)];
        expect(readResults({ resultIndex: 1, results })).toEqual({ final: 'hello', interim: 'wor' });
    });

    it('copes with a result without alternatives', () => {
        expect(readResults({ resultIndex: 0, results: [{ isFinal: true, length: 0 }] })).toEqual({ final: '', interim: '' });
    });
});

describe('dictationErrorKey', () => {
    it.each([
        ['not-allowed', 'dictationErrorDenied'],
        ['service-not-allowed', 'dictationErrorService'],
        ['audio-capture', 'dictationErrorNoMicrophone'],
        ['no-speech', 'dictationErrorNoSpeech'],
        ['network', 'dictationErrorNetwork'],
        ['language-not-supported', 'dictationErrorLanguage'],
        ['bad-grammar', 'dictationErrorFailed'],
    ])('names %s', (error, key) => {
        expect(dictationErrorKey(error)).toBe(key);
    });

    it('says nothing when dictation was stopped on purpose', () => {
        expect(dictationErrorKey('aborted')).toBeNull();
    });
});

describe('dictatedSnippet', () => {
    it('separates the words from the text around them with single spaces', () => {
        expect(dictatedSnippet('', '', '  hello   world ')).toBe('hello world');
        expect(dictatedSnippet('I went', '', 'to the sea')).toBe(' to the sea');
        expect(dictatedSnippet('I went ', 'today', 'to the sea')).toBe('to the sea ');
        expect(dictatedSnippet('Line\n', '', 'next')).toBe('next');
    });

    it('keeps punctuation right after the words', () => {
        expect(dictatedSnippet('We swam', '.', 'all day')).toBe(' all day');
        expect(dictatedSnippet('', ' later', 'now')).toBe('now');
    });

    it('is empty for silence', () => {
        expect(dictatedSnippet('text', 'more', '   ')).toBe('');
    });
});

describe('the note on where speech goes', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('is remembered once seen', () => {
        expect(readNoticeSeen()).toBe(false);
        saveNoticeSeen();
        expect(readNoticeSeen()).toBe(true);
    });

    it('shows again when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(() => saveNoticeSeen()).not.toThrow();
        expect(readNoticeSeen()).toBe(false);
    });
});
